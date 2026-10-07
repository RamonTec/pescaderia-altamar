import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanalRecordatorioId, Cliente, RecordatorioCobro } from '@/types/domain'
import type { DocumentoCartera } from '@/lib/cartera/types'
import { estadoCartera, estaAbierto, ordenarPorGravedad } from '@/lib/cartera/estado'
import {
  construirRecordatorio,
  type DatosNegocio,
  type DatosRecordatorio,
  type MensajeCorreo,
  type MensajeWhatsApp,
} from '@/lib/cartera/recordatorios/plantillas'
import { CANALES, obtenerCanal, type Disponibilidad } from '@/lib/cartera/recordatorios/canales'
import {
  facturaADocumentoCartera,
  makeCarteraRepository,
} from '@/lib/repositories/carteraRepository'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { makeConfigNegocioRepository } from '@/lib/repositories/configRepository'
import { makeRecordatorioRepository } from '@/lib/repositories/recordatorioRepository'
import { createClient } from '@/lib/supabase/server'
import { fechaHoy } from '@/lib/format'
import { getRol } from './authService'
import { DIAS_AVISO_DEFAULT } from './carteraService'
import { getTasaVigente } from './tasaService'

/**
 * RecordatorioService (SRP): recordatorios de cobro (09-cuentas-por-cobrar).
 *
 * Valida (admin, cliente activo, facturas del cliente con saldo, canal
 * disponible), arma el mensaje, lo entrega por el canal (Strategy en
 * `lib/cartera/recordatorios/canales`), registra el envío y avisa si ya hubo
 * un recordatorio en las últimas 24 h. No conoce los canales concretos:
 * agregar uno no modifica este servicio.
 */

export class RecordatorioError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'RecordatorioError'
  }
}

const NOMBRE_COMERCIAL_DEFAULT = 'Altamar Sea Food'
const VENTANA_AVISO_MS = 24 * 60 * 60 * 1000

export interface AvisoRecordatorioReciente {
  fecha: string
  canal: CanalRecordatorioId
}

export interface PreparacionRecordatorio {
  cliente: Pick<Cliente, 'id' | 'nombre' | 'telefono' | 'email'>
  /** Documentos con saldo del cliente, ordenados por gravedad. */
  documentos: DocumentoCartera[]
  /** Ids preseleccionados (todos los que tienen saldo; la UI permite desmarcar). */
  seleccion: string[]
  canales: Record<CanalRecordatorioId, Disponibilidad>
  /** Datos para que la UI rearme el mensaje al cambiar la selección (plantillas puras). */
  datos: Omit<DatosRecordatorio, 'documentos'>
  /** Mensajes de la selección inicial. */
  mensajes: { whatsapp: MensajeWhatsApp; email: MensajeCorreo }
  /** Ya hubo un recordatorio (no fallido) en las últimas 24 h. */
  aviso: AvisoRecordatorioReciente | null
}

export interface EnviarRecordatorioInput {
  clienteId: string
  facturaIds: string[]
  /** Texto final (editado por el usuario): es lo que se registra. */
  texto: string
  asunto?: string
}

export interface ResultadoRecordatorio {
  id: string
  canal: CanalRecordatorioId
  estado: RecordatorioCobro['estado']
  url?: string
  error?: string | null
}

async function exigirAdmin() {
  if ((await getRol()) !== 'admin') {
    throw new RecordatorioError('Solo un administrador puede enviar recordatorios')
  }
}

interface Contexto {
  cliente: Cliente
  abiertos: DocumentoCartera[]
  datos: Omit<DatosRecordatorio, 'documentos'>
}

async function cargarContexto(clienteId: string, db: SupabaseClient): Promise<Contexto> {
  const [cliente, config, facturas] = await Promise.all([
    makeClienteRepository(db).getById(clienteId),
    makeConfigNegocioRepository(db).get(),
    makeCarteraRepository(db).documentosPorCliente(clienteId),
  ])
  if (!cliente) throw new RecordatorioError('El cliente no existe')
  if (!cliente.activo) throw new RecordatorioError('El cliente está inactivo')

  const hoy = fechaHoy()
  const diasAviso = Number(config?.dias_aviso_por_vencer ?? DIAS_AVISO_DEFAULT)

  // El equivalente en Bs es informativo: sin tasa, el mensaje va solo en USD.
  let tasaBs: number | null = null
  try {
    const vigente = await getTasaVigente(hoy, config?.fuente_tasa_default ?? 'bcv', 'USD', db)
    tasaBs = vigente ? Number(vigente.tasa.valor_bs) : null
  } catch {
    tasaBs = null
  }

  const negocio: DatosNegocio = {
    nombre_comercial: config?.nombre_comercial?.trim() || NOMBRE_COMERCIAL_DEFAULT,
    instrucciones_pago: config?.instrucciones_pago ?? null,
    email_respuesta: config?.email_respuesta ?? null,
  }

  const abiertos = ordenarPorGravedad(
    facturas
      .map(facturaADocumentoCartera)
      .filter((d) => estaAbierto(estadoCartera(d, hoy, diasAviso))),
    hoy,
    diasAviso
  ).map((d) => ({ ...d, contraparte: null }))

  return {
    cliente,
    abiertos,
    datos: { negocio, destinatario: { nombre: cliente.nombre }, hoy, diasAviso, tasaBs },
  }
}

function disponibilidades(cliente: Cliente): Record<CanalRecordatorioId, Disponibilidad> {
  const out = {} as Record<CanalRecordatorioId, Disponibilidad>
  for (const canal of Object.values(CANALES)) {
    out[canal.id] = canal.disponible(cliente)
  }
  return out
}

async function avisoReciente(
  clienteId: string,
  db: SupabaseClient
): Promise<AvisoRecordatorioReciente | null> {
  const ultimo = await makeRecordatorioRepository(db).ultimoPorCliente(clienteId)
  if (!ultimo) return null
  const edad = Date.now() - new Date(ultimo.created_at).getTime()
  return edad < VENTANA_AVISO_MS ? { fecha: ultimo.created_at, canal: ultimo.canal } : null
}

/** Documentos seleccionados: deben ser del cliente y tener saldo. */
function seleccionar(abiertos: DocumentoCartera[], facturaIds: string[]): DocumentoCartera[] {
  const ids = [...new Set(facturaIds)]
  if (ids.length === 0) {
    throw new RecordatorioError('Selecciona al menos una factura pendiente o vencida', 'facturaIds')
  }
  const porId = new Map(abiertos.map((d) => [d.id, d]))
  const docs = ids.map((id) => porId.get(id))
  if (docs.some((d) => !d)) {
    throw new RecordatorioError(
      'Alguna factura ya no está pendiente o no pertenece al cliente. Vuelve a abrir el recordatorio.',
      'facturaIds'
    )
  }
  return docs as DocumentoCartera[]
}

/**
 * Datos para el diálogo: documentos con saldo, disponibilidad de cada canal,
 * mensajes armados para la selección inicial y aviso de 24 h.
 */
export async function prepararRecordatorio(
  clienteId: string,
  facturaIds?: string[],
  db?: SupabaseClient
): Promise<PreparacionRecordatorio> {
  await exigirAdmin()
  const client = db ?? (await createClient())
  const [ctx, aviso] = await Promise.all([
    cargarContexto(clienteId, client),
    avisoReciente(clienteId, client),
  ])
  if (ctx.abiertos.length === 0) {
    throw new RecordatorioError('El cliente no tiene facturas pendientes ni vencidas')
  }
  const docs = facturaIds?.length ? seleccionar(ctx.abiertos, facturaIds) : ctx.abiertos
  const datos: DatosRecordatorio = { ...ctx.datos, documentos: docs }
  return {
    cliente: {
      id: ctx.cliente.id,
      nombre: ctx.cliente.nombre,
      telefono: ctx.cliente.telefono,
      email: ctx.cliente.email,
    },
    documentos: ctx.abiertos,
    seleccion: docs.map((d) => d.id),
    canales: disponibilidades(ctx.cliente),
    datos: ctx.datos,
    mensajes: {
      whatsapp: construirRecordatorio(datos, 'whatsapp'),
      email: construirRecordatorio(datos, 'email'),
    },
    aviso,
  }
}

/**
 * Entrega un recordatorio por el canal indicado y lo registra (con sus
 * facturas). El HTML del correo se rearma aquí con los documentos
 * validados; el texto y el asunto son los que editó el usuario.
 */
export async function enviarRecordatorio(
  canalId: CanalRecordatorioId,
  input: EnviarRecordatorioInput,
  db?: SupabaseClient
): Promise<ResultadoRecordatorio> {
  await exigirAdmin()
  const client = db ?? (await createClient())
  const ctx = await cargarContexto(input.clienteId, client)
  const docs = seleccionar(ctx.abiertos, input.facturaIds)

  const texto = input.texto.trim()
  if (!texto) throw new RecordatorioError('El mensaje no puede quedar vacío', 'texto')

  const canal = obtenerCanal(canalId)
  const disponible = canal.disponible(ctx.cliente)
  if (!disponible.ok) throw new RecordatorioError(disponible.motivo, 'canal')

  const armado = construirRecordatorio({ ...ctx.datos, documentos: docs }, canalId)
  const asunto = armado.canal === 'email' ? input.asunto?.trim() || armado.asunto : undefined

  const resultado = await canal.entregar({
    destino: disponible.destino,
    texto,
    asunto,
    html: armado.canal === 'email' ? armado.html : undefined,
    responderA: ctx.datos.negocio.email_respuesta,
  })

  const id = await makeRecordatorioRepository(client).registrar(
    {
      id: crypto.randomUUID(),
      cliente_id: ctx.cliente.id,
      canal: canalId,
      destinatario: disponible.destino,
      asunto: asunto ?? null,
      mensaje: texto,
      estado: resultado.estado,
      error: resultado.error ?? null,
      proveedor_id_mensaje: resultado.proveedorIdMensaje ?? null,
    },
    docs.map((d) => d.id)
  )

  return { id, canal: canalId, estado: resultado.estado, url: resultado.url, error: resultado.error }
}

/** WhatsApp: el navegador ya abrió `wa.me`; aquí se registra como `generado`. */
export function registrarRecordatorio(input: EnviarRecordatorioInput, db?: SupabaseClient) {
  return enviarRecordatorio('whatsapp', input, db)
}

/** Correo por Resend: queda `enviado` o `fallido` (con el error legible). */
export function enviarCorreo(input: EnviarRecordatorioInput, db?: SupabaseClient) {
  return enviarRecordatorio('email', input, db)
}

/**
 * Reintenta un correo fallido con el mismo texto y asunto. Crea un registro
 * nuevo (el fallido queda en el historial). Solo incluye las facturas que
 * todavía tienen saldo.
 */
export async function reintentarCorreo(
  recordatorioId: string,
  db?: SupabaseClient
): Promise<ResultadoRecordatorio> {
  await exigirAdmin()
  const client = db ?? (await createClient())
  const previo = await makeRecordatorioRepository(client).getById(recordatorioId)
  if (!previo) throw new RecordatorioError('El recordatorio no existe')
  if (previo.canal !== 'email' || previo.estado !== 'fallido') {
    throw new RecordatorioError('Solo se puede reintentar un correo fallido')
  }
  const ctx = await cargarContexto(previo.cliente_id, client)
  const abiertos = new Set(ctx.abiertos.map((d) => d.id))
  const facturaIds = previo.factura_ids.filter((id) => abiertos.has(id))
  if (facturaIds.length === 0) {
    throw new RecordatorioError('Las facturas de este recordatorio ya no tienen saldo pendiente')
  }
  return enviarRecordatorio(
    'email',
    {
      clienteId: previo.cliente_id,
      facturaIds,
      texto: previo.mensaje ?? '',
      asunto: previo.asunto ?? undefined,
    },
    client
  )
}

/** Historial de recordatorios del cliente (el texto llega `null` al operador). */
export async function historialDeCliente(
  clienteId: string,
  db?: SupabaseClient
): Promise<RecordatorioCobro[]> {
  const client = db ?? (await createClient())
  return makeRecordatorioRepository(client).listByCliente(clienteId)
}
