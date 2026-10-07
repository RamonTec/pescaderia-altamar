import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConfigNegocio,
  Contrato,
  DatosContratoPdf,
  ElegibilidadContrato,
  EstadoContrato,
  ParteContrato,
  TipoContrato,
} from '@/types/domain'
import {
  ContratoActivoDuplicadoError,
  type ContratoActivoOrigen,
  type IContratoArchivoRepository,
  type IContratoRepository,
  type OrigenContrato,
  type PaginaContratos,
} from '@/lib/repositories/interfaces'
import { makeContratoRepository } from '@/lib/repositories/contratoRepository'
import { makeContratoArchivoRepository } from '@/lib/repositories/contratoArchivoRepository'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { makeCompraRepository } from '@/lib/repositories/compraRepository'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { makeRepresentanteLegalRepository } from '@/lib/repositories/representanteLegalRepository'
import { makeRepresentanteProveedorRepository } from '@/lib/repositories/representanteProveedorRepository'
import { makeConfigNegocioRepository } from '@/lib/repositories/configRepository'
import { numeroFactura } from '@/lib/repositories/carteraRepository'
import { createClient } from '@/lib/supabase/server'
import { fechaHoy } from '@/lib/format'
import { sumarDias } from '@/lib/cartera/estado'
import { transicionValida, type FiltrosContratos } from '@/lib/contratoValidation'
import { fechaCorta, nombreArchivoContrato, numeroContrato } from '@/lib/contratos/textos'
import { requireAdmin } from './authService'
import { reactPdfContratoRenderer, type IContratoPdfRenderer } from './contratoPdfService'

/**
 * ContratoService (06-contratos): único que usa los repositorios de
 * contratos. Todas las funciones exigen admin.
 *
 * Generar:
 *   1. Valida (reglas 1, 2, 7 y 9 de la spec).
 *   2. Arma `DatosContratoPdf` con los valores guardados del origen (snapshot:
 *      nunca consulta la tasa vigente) y los días del propio contrato.
 *   3. Reserva el número, renderiza, sube `{tipo}/{yyyy}/{id}.pdf` (sin upsert)
 *      e inserta la fila. Si algo falla después de subir, borra el archivo.
 *
 * La factura o la compra nunca se modifican.
 */

export const PAGE_SIZE_CONTRATOS = 25
const TTL_URL_FIRMADA_S = 60
const TOLERANCIA_SALDO = 0.000001

const MSG_SOLO_ADMIN = 'Solo un administrador puede gestionar contratos'
const MSG_DOCUMENTO_ANULADO = 'Documento anulado'
const MSG_DATOS_NEGOCIO =
  'Completa los datos del negocio (razón social, RIF, dirección y teléfono) en Catálogos › Configuración'

const ESTADO_TEXTO: Record<EstadoContrato, string> = {
  generado: 'generado',
  enviado: 'enviado',
  firmado: 'firmado',
  anulado: 'anulado',
}

/** Error de regla de negocio; `campo` permite marcarlo en el formulario. */
export class ContratoError extends Error {
  constructor(
    message: string,
    readonly campo?: 'dias_credito' | 'notas'
  ) {
    super(message)
    this.name = 'ContratoError'
  }
}

interface Contexto {
  db: SupabaseClient
  contratos: IContratoRepository
  archivos: IContratoArchivoRepository
  renderer: IContratoPdfRenderer
}

async function contexto(): Promise<Contexto> {
  if (!(await requireAdmin())) throw new ContratoError(MSG_SOLO_ADMIN)
  const db = await createClient()
  return {
    db,
    contratos: makeContratoRepository(db),
    archivos: makeContratoArchivoRepository(db),
    renderer: reactPdfContratoRenderer,
  }
}

const redondea6 = (n: number) => Math.round(n * 1e6) / 1e6
const num = (v: unknown) => Number(v ?? 0)

/* ============================ Elegibilidad ============================ */

function elegibilidad(
  origenes: OrigenContrato[],
  activos: ContratoActivoOrigen[],
  clave: 'factura_id' | 'compra_id'
): Map<string, ElegibilidadContrato> {
  const activoPorOrigen = new Map<string, ContratoActivoOrigen>()
  for (const c of activos) {
    const id = c[clave]
    if (id) activoPorOrigen.set(id, c)
  }
  const resultado = new Map<string, ElegibilidadContrato>()
  for (const o of origenes) {
    // Contado: sin opciones de contrato (no entra en el mapa).
    if (o.condicion !== 'credito') continue
    const activo = activoPorOrigen.get(o.id)
    const contratoActivo = activo ? { id: activo.id, numero: activo.numero, estado: activo.estado } : undefined
    if (o.estado === 'anulada') {
      resultado.set(o.id, { puedeGenerar: false, motivo: MSG_DOCUMENTO_ANULADO, contratoActivo })
    } else if (contratoActivo) {
      resultado.set(o.id, { puedeGenerar: false, contratoActivo })
    } else {
      resultado.set(o.id, { puedeGenerar: true })
    }
  }
  return resultado
}

/** Elegibilidad de un lote de facturas en dos consultas (origen + contratos activos), no N+1. */
export async function elegibilidadFacturas(ids: string[]): Promise<Map<string, ElegibilidadContrato>> {
  const { contratos } = await contexto()
  const unicos = [...new Set(ids)]
  const [origenes, activos] = await Promise.all([
    contratos.origenesFacturas(unicos),
    contratos.activosPorFacturas(unicos),
  ])
  return elegibilidad(origenes, activos, 'factura_id')
}

/** Elegibilidad de un lote de compras en dos consultas (origen + contratos activos), no N+1. */
export async function elegibilidadCompras(ids: string[]): Promise<Map<string, ElegibilidadContrato>> {
  const { contratos } = await contexto()
  const unicos = [...new Set(ids)]
  const [origenes, activos] = await Promise.all([
    contratos.origenesCompras(unicos),
    contratos.activosPorCompras(unicos),
  ])
  return elegibilidad(origenes, activos, 'compra_id')
}

/* ============================== Generar ============================== */

export interface OpcionesGenerar {
  dias_credito: number
  notas: string | null
}

function validarDias(dias: number) {
  if (!Number.isInteger(dias) || dias < 0 || dias > 365) {
    throw new ContratoError('Los días de crédito deben ser un entero entre 0 y 365', 'dias_credito')
  }
}

function negocioDeConfig(config: ConfigNegocio | null): DatosContratoPdf['negocio'] {
  const razon_social = config?.razon_social?.trim()
  const rif = config?.rif?.trim()
  const direccion = config?.direccion?.trim()
  const telefono = config?.telefono?.trim()
  if (!razon_social || !rif || !direccion || !telefono) throw new ContratoError(MSG_DATOS_NEGOCIO)
  return {
    nombre_comercial: config?.nombre_comercial?.trim() || null,
    razon_social,
    rif,
    direccion,
    telefono,
  }
}

function validarContraparte(nombre: string | null | undefined, rifCi: string | null | undefined): string {
  if (!rifCi?.trim()) {
    throw new ContratoError(`Registra el RIF o la cédula de ${nombre ?? 'la contraparte'} antes de generar el contrato`)
  }
  return rifCi.trim()
}

function mensajeContratoActivo(documento: string, activo: Pick<Contrato, 'numero' | 'estado'>): string {
  return `${documento} ya tiene el contrato ${numeroContrato(activo.numero)} (${ESTADO_TEXTO[activo.estado]}). Anúlalo antes de generar otro.`
}

/** Render → subida → insert; borra el PDF si el insert falla. */
async function emitir(
  ctx: Contexto,
  datos: Omit<DatosContratoPdf, 'numero' | 'fecha_emision'> & { fecha_emision: string },
  fila: { factura_id: string | null; compra_id: string | null },
  documentoTexto: string,
  activoActual: () => Promise<ContratoActivoOrigen | undefined>
): Promise<Contrato> {
  const id = crypto.randomUUID()
  const numero = await ctx.contratos.siguienteNumero()
  const bytes = await ctx.renderer.render({ ...datos, numero })
  const ruta = `${datos.tipo}/${datos.fecha_emision.slice(0, 4)}/${id}.pdf`

  await ctx.archivos.subir(ruta, bytes)
  try {
    return await ctx.contratos.create({
      id,
      numero,
      tipo: datos.tipo,
      factura_id: fila.factura_id,
      compra_id: fila.compra_id,
      fecha: datos.fecha_emision,
      dias_credito: datos.dias_credito,
      url_storage: ruta,
      notas: datos.notas,
    })
  } catch (e) {
    // Sin PDF huérfano: el archivo se sube antes de insertar la fila.
    await ctx.archivos.eliminar(ruta).catch((err) => console.error('[contratos] no se pudo borrar', ruta, err))
    if (e instanceof ContratoActivoDuplicadoError) {
      const activo = await activoActual()
      throw new ContratoError(
        activo ? mensajeContratoActivo(documentoTexto, activo) : `${documentoTexto} ya tiene un contrato activo. Anúlalo antes de generar otro.`
      )
    }
    throw traducirErrorBase(e)
  }
}

/** Errores del trigger (`23514`) y de permisos a mensajes de dominio. */
function traducirErrorBase(e: unknown): unknown {
  const pg = e as { code?: string; message?: string }
  if (pg?.code === '23514' && pg.message) return new ContratoError(pg.message)
  if (pg?.code === '42501') return new ContratoError(MSG_SOLO_ADMIN)
  return e
}

function parte(
  p: { nombre: string; tipo_persona: ParteContrato['tipo_persona']; direccion: string | null; telefono: string | null },
  rifCi: string,
  representantes: { nombre: string; cedula: string; cargo: string | null }[]
): ParteContrato {
  return {
    nombre: p.nombre,
    tipo_persona: p.tipo_persona,
    rif_ci: rifCi,
    direccion: p.direccion?.trim() || null,
    telefono: p.telefono?.trim() || null,
    representantes: representantes.map((r) => ({ nombre: r.nombre, cedula: r.cedula, cargo: r.cargo })),
  }
}

export async function generarDesdeFactura(facturaId: string, opciones: OpcionesGenerar): Promise<Contrato> {
  const ctx = await contexto()
  validarDias(opciones.dias_credito)

  const factura = await makeFacturaRepository(ctx.db).getById(facturaId)
  if (!factura) throw new ContratoError('La factura no existe')
  const documentoTexto = `La factura ${numeroFactura(factura.numero)}`

  // Regla 1: crédito y no anulada.
  if (factura.condicion !== 'credito') throw new ContratoError('Solo las facturas a crédito admiten contrato')
  if (factura.estado === 'anulada') throw new ContratoError('La factura está anulada: no admite contrato')

  // Regla 2: un contrato activo por origen.
  const activoActual = async () => (await ctx.contratos.activosPorFacturas([facturaId]))[0]
  const activo = await activoActual()
  if (activo) throw new ContratoError(mensajeContratoActivo(documentoTexto, activo))

  // Regla 7: datos obligatorios.
  const [config, cliente, representantes] = await Promise.all([
    makeConfigNegocioRepository(ctx.db).get(),
    makeClienteRepository(ctx.db).getById(factura.cliente_id),
    makeRepresentanteLegalRepository(ctx.db).listByCliente(factura.cliente_id),
  ])
  const negocio = negocioDeConfig(config)
  if (!cliente) throw new ContratoError('El cliente de la factura no existe')
  const rifCi = validarContraparte(cliente.nombre, cliente.rif_ci)

  // Snapshot: valores guardados de la factura, sin consultar tasas.
  const total = num(factura.total_usd)
  const pagado = num(factura.pagado_usd)
  const creditos = redondea6(
    factura.notas_credito.filter((n) => n.estado === 'emitida').reduce((s, n) => s + num(n.total_usd), 0)
  )
  const saldo = redondea6(total - pagado - creditos)
  const fechaOrigen = String(factura.fecha).slice(0, 10)

  return emitir(
    ctx,
    {
      tipo: 'venta_credito',
      fecha_emision: fechaHoy(),
      dias_credito: opciones.dias_credito,
      // Regla 9: mismo cálculo que el trigger (fecha del origen + días).
      fecha_vencimiento: sumarDias(fechaOrigen, opciones.dias_credito),
      notas: opciones.notas,
      negocio,
      contraparte: parte(cliente, rifCi, representantes),
      documento: {
        numero: numeroFactura(factura.numero),
        fecha: fechaOrigen,
        referencia: factura.id.slice(0, 8),
        moneda: null,
      },
      items: factura.items.map((i) => ({
        codigo: i.producto?.codigo ?? null,
        producto: i.producto?.nombre ?? 'Producto',
        peso_kg: num(i.peso_kg),
        precio_usd_kg: num(i.precio_usd_kg),
        subtotal_usd: redondea6(num(i.peso_kg) * num(i.precio_usd_kg)),
      })),
      totales: {
        subtotal_usd: num(factura.subtotal_usd),
        iva_pct: num(factura.iva_pct),
        iva_usd: num(factura.iva_usd),
        total_usd: total,
        pagado_usd: pagado,
        creditos_usd: creditos,
        saldo_usd: saldo > TOLERANCIA_SALDO ? saldo : 0,
      },
      tasa: {
        tasa_origen: factura.tasa_origen,
        tasa_fuente: factura.tasa_fuente,
        tasa_referencial: factura.tasa_referencial === null ? null : num(factura.tasa_referencial),
        tasa_snapshot: num(factura.tasa_snapshot),
      },
    },
    { factura_id: facturaId, compra_id: null },
    documentoTexto,
    activoActual
  )
}

export async function generarDesdeCompra(compraId: string, opciones: OpcionesGenerar): Promise<Contrato> {
  const ctx = await contexto()
  validarDias(opciones.dias_credito)

  const compra = await makeCompraRepository(ctx.db).getById(compraId)
  if (!compra) throw new ContratoError('La compra no existe')
  const fechaOrigen = String(compra.fecha).slice(0, 10)
  const documentoTexto = `La compra del ${fechaCorta(fechaOrigen)}`

  if (compra.condicion !== 'credito') throw new ContratoError('Solo las compras a crédito admiten contrato')
  if (compra.estado === 'anulada') throw new ContratoError('La compra está anulada: no admite contrato')

  const activoActual = async () => (await ctx.contratos.activosPorCompras([compraId]))[0]
  const activo = await activoActual()
  if (activo) throw new ContratoError(mensajeContratoActivo(documentoTexto, activo))

  const [config, proveedor, representantes] = await Promise.all([
    makeConfigNegocioRepository(ctx.db).get(),
    makeProveedorRepository(ctx.db).getById(compra.proveedor_id),
    makeRepresentanteProveedorRepository(ctx.db).listByProveedor(compra.proveedor_id),
  ])
  const negocio = negocioDeConfig(config)
  if (!proveedor) throw new ContratoError('El proveedor de la compra no existe')
  const rifCi = validarContraparte(proveedor.nombre, proveedor.rif_ci)

  const total = num(compra.subtotal_usd)
  const pagado = num(compra.pagado_usd)
  const saldo = redondea6(total - pagado)

  return emitir(
    ctx,
    {
      tipo: 'compra_credito',
      fecha_emision: fechaHoy(),
      dias_credito: opciones.dias_credito,
      fecha_vencimiento: sumarDias(fechaOrigen, opciones.dias_credito),
      notas: opciones.notas,
      negocio,
      contraparte: parte(proveedor, rifCi, representantes),
      documento: { numero: null, fecha: fechaOrigen, referencia: compra.id.slice(0, 8), moneda: compra.moneda },
      items: compra.items.map((i) => ({
        codigo: i.producto?.codigo ?? null,
        producto: i.producto?.nombre ?? 'Producto',
        peso_kg: num(i.peso_kg),
        precio_usd_kg: num(i.costo_usd_kg),
        subtotal_usd: redondea6(num(i.peso_kg) * num(i.costo_usd_kg)),
      })),
      totales: {
        subtotal_usd: total,
        iva_pct: null,
        iva_usd: null,
        total_usd: total,
        pagado_usd: pagado,
        creditos_usd: 0,
        saldo_usd: saldo > TOLERANCIA_SALDO ? saldo : 0,
      },
      tasa: {
        tasa_origen: compra.tasa_origen,
        tasa_fuente: compra.tasa_fuente,
        tasa_referencial: compra.tasa_referencial === null ? null : num(compra.tasa_referencial),
        tasa_snapshot: num(compra.tasa_snapshot),
      },
    },
    { factura_id: null, compra_id: compraId },
    documentoTexto,
    activoActual
  )
}

/* ====================== Listado, estado y entrega ====================== */

const TIPO_FILTRO: Record<'venta' | 'compra', TipoContrato> = {
  venta: 'venta_credito',
  compra: 'compra_credito',
}

export async function listar(filtros: FiltrosContratos): Promise<PaginaContratos> {
  const { contratos } = await contexto()
  return contratos.list({
    tipo: filtros.tipo ? TIPO_FILTRO[filtros.tipo] : undefined,
    estado: filtros.estado,
    q: filtros.q,
    page: Math.max(0, filtros.pagina - 1),
    pageSize: PAGE_SIZE_CONTRATOS,
  })
}

export async function cambiarEstado(id: string, estado: EstadoContrato): Promise<Contrato> {
  const { contratos } = await contexto()
  const actual = await contratos.getById(id)
  if (!actual) throw new ContratoError('El contrato no existe')
  if (!transicionValida(actual.estado, estado)) {
    throw new ContratoError(
      `El contrato ${numeroContrato(actual.numero)} está ${ESTADO_TEXTO[actual.estado]}: no puede pasar a ${ESTADO_TEXTO[estado]}`
    )
  }
  try {
    return await contratos.updateEstado(id, estado)
  } catch (e) {
    throw traducirErrorBase(e)
  }
}

/** Contrato por id (para revalidar la ficha de la contraparte tras un cambio). */
export async function obtener(id: string): Promise<Contrato | null> {
  const { contratos } = await contexto()
  return contratos.getById(id)
}

/** URL firmada al vuelo (TTL 60 s); nunca se guarda. `null` si el contrato no existe. */
export async function urlFirmada(id: string, opciones: { descargar: boolean }): Promise<string | null> {
  const { contratos, archivos } = await contexto()
  const contrato = await contratos.getById(id)
  if (!contrato) return null
  return archivos.urlFirmada(
    contrato.url_storage,
    TTL_URL_FIRMADA_S,
    opciones.descargar ? nombreArchivoContrato(contrato.numero) : undefined
  )
}
