import { randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Cliente,
  Cotizacion,
  CotizacionDetalle,
  CotizacionInput,
  CotizacionListado,
  Producto,
} from '@/types/domain'
import type { FiltroEstadoCotizacionRepo, ICotizacionRepository } from '@/lib/repositories/interfaces'
import { makeCotizacionRepository } from '@/lib/repositories/cotizacionRepository'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { createClient } from '@/lib/supabase/server'
import { ivaPctVenta } from '@/lib/facturas/iva'
import { estadoEfectivo } from '@/lib/cotizaciones/estado'
import { parseBusquedaNumero } from '@/lib/cotizaciones/numero'
import { fechaHoy } from '@/lib/format'
import { urlPublica } from '@/lib/cotizaciones/enlace'
import { mensajeWhatsAppCotizacion } from '@/lib/cotizaciones/mensaje'
import { getUsuarioActual } from './authService'
import { getConfigNegocio } from './configService'

/**
 * CotizacionService (21-cotizaciones): único que usa `ICotizacionRepository`.
 * Toda función exige sesión con perfil (admin u operador, P4) antes de tocar
 * Supabase.
 *
 * - Guardar: el `iva_pct` lo resuelve aquí con `ivaPctVenta` según el
 *   interruptor (P1, % vigente de config; sin tasas). Los importes los
 *   calcula la RPC `guardar_cotizacion` (fuente de verdad).
 * - Estados: `marcarEnviada` (no-op si no es borrador), `aceptar`,
 *   `rechazar` y `anular`; las transiciones las valida `cotizaciones_guard`.
 * - Renovar = guardar con fecha de hoy y validez nueva (recalcula IVA).
 * - Duplicar = `CotizacionForm` en modo `duplicar`, precargado con
 *   `valoresDesdeDetalle` (fecha de hoy, sin enlace) → `guardarCotizacion(null, …)`.
 * - Errores de la base (`P0001` + `hint`) → `CotizacionError` con su campo.
 */

export const MSG_SIN_SESION_COTIZACION = 'Inicia sesión para trabajar con cotizaciones'

/** Error de regla de negocio; `campo` permite marcarlo en el formulario. */
export class CotizacionError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'CotizacionError'
  }
}

interface PgErrorLike {
  code?: string
  hint?: string
  message?: string
  details?: string
}

/** `hint` de la RPC / el guard → campo del formulario (`null` = al `Alert`). */
const CAMPO_POR_HINT: Record<string, string | null> = {
  cliente_requerido: 'cliente_id',
  producto_inactivo: null, // el campo exacto viene en `details` (`items.N.producto_id`)
  peso_invalido: null,
  precio_invalido: null,
  descuento_mayor_subtotal: 'descuento_usd',
  fecha_futura: 'fecha',
  validez_invalida: 'validez_dias',
  sin_lineas: 'items',
  demasiadas_lineas: 'items',
  iva_invalido: null,
  cotizacion_inmutable: null,
  cotizacion_inexistente: null,
  cotizacion_vencida: null,
  transicion_invalida: null,
  usar_guardar_cotizacion: null,
  // Fase D (P8)
  cotizacion_convertida: null,
  pedido_requiere_aceptada: null,
  fecha_entrega_requerida: 'fecha_entrega',
}

export function traducir(e: unknown): never {
  const pg = (e ?? {}) as PgErrorLike
  if (pg.code === 'P0001' && pg.hint && pg.hint in CAMPO_POR_HINT) {
    const campo = CAMPO_POR_HINT[pg.hint] ?? (pg.details?.startsWith('items.') ? pg.details : undefined)
    throw new CotizacionError(pg.message ?? 'Operación no permitida', campo)
  }
  throw e
}

export interface Contexto {
  db: SupabaseClient
  cotizaciones: ICotizacionRepository
}

export async function contexto(): Promise<Contexto> {
  const usuario = await getUsuarioActual()
  if (!usuario?.rol) throw new CotizacionError(MSG_SIN_SESION_COTIZACION)
  const db = await createClient()
  return { db, cotizaciones: makeCotizacionRepository(db) }
}

const textoONull = (s: string | null | undefined) => {
  const t = (s ?? '').trim()
  return t === '' ? null : t
}

/* ============================ Lectura ============================ */

export interface FiltrosCotizaciones {
  estado: FiltroEstadoCotizacionRepo
  q?: string
  desde?: string
  hasta?: string
  /** 1-based. */
  pagina: number
  limite: number
}

/** Texto de búsqueda: sin acentos y en minúsculas; un teléfono, solo dígitos. */
function normalizarTexto(q: string): string {
  const t = q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return /^[\d\s.\-()+]+$/.test(t) ? t.replace(/\D/g, '') : t
}

export async function listarCotizaciones(
  filtros: FiltrosCotizaciones
): Promise<{ rows: CotizacionListado[]; total: number }> {
  const { cotizaciones } = await contexto()
  const q = filtros.q?.trim() ?? ''
  const numero = q ? (parseBusquedaNumero(q) ?? undefined) : undefined
  // `cot123` busca solo el número; `123` busca número o dígitos del teléfono.
  const texto = q && !/^\s*cot/i.test(q) ? normalizarTexto(q) : undefined
  return cotizaciones.listar({
    estado: filtros.estado,
    numero,
    texto,
    desde: filtros.desde,
    hasta: filtros.hasta,
    pagina: Math.max(0, filtros.pagina - 1),
    tamano: filtros.limite,
  })
}

export async function getCotizacion(id: string): Promise<CotizacionDetalle | null> {
  const { cotizaciones } = await contexto()
  return cotizaciones.getDetalle(id)
}

/** Lo que necesita `CotizacionForm`: catálogos, % de IVA y defaults de config. */
export interface CatalogoCotizacion {
  /** Clientes activos. */
  clientes: Cliente[]
  /** Todos los productos (el formulario ofrece los activos y muestra los de la cotización). */
  productos: Producto[]
  iva_pct: number
  validez_dias: number
  terminos: string
}

export async function getCatalogoCotizacion(): Promise<CatalogoCotizacion> {
  const { db } = await contexto()
  const [clientes, productos, config] = await Promise.all([
    makeClienteRepository(db).list(),
    makeProductoRepository(db).list(),
    getConfigNegocio(db),
  ])
  return {
    clientes: clientes.filter((c) => c.activo),
    productos: productos.map((p) => ({
      ...p,
      precio_referencia_usd_kg: p.precio_referencia_usd_kg === null ? null : Number(p.precio_referencia_usd_kg),
    })),
    iva_pct: Number(config?.iva_pct ?? 16),
    validez_dias: Number(config?.cotizacion_validez_dias ?? 7),
    terminos: config?.cotizacion_terminos ?? '',
  }
}

/* ============================ Escritura ============================ */

/**
 * Crea (`id` nulo) o edita una cotización. `con_iva` = sí → `iva_pct`
 * vigente de config; no → 0 (P1).
 */
export async function guardarCotizacion(id: string | null, v: CotizacionInput): Promise<string> {
  const { db, cotizaciones } = await contexto()
  const config = await getConfigNegocio(db)
  const ivaPct = ivaPctVenta(v.con_iva, Number(config?.iva_pct ?? 16))
  const libre = !v.cliente_id
  try {
    return await cotizaciones.guardar(
      id,
      {
        fecha: v.fecha,
        validez_dias: v.validez_dias,
        cliente_id: v.cliente_id,
        cliente_nombre: libre ? textoONull(v.cliente_nombre) : null,
        cliente_telefono: libre ? textoONull(v.cliente_telefono) : null,
        iva_pct: ivaPct,
        descuento_usd: v.descuento_usd,
        notas_cliente: textoONull(v.notas_cliente),
        notas_internas: textoONull(v.notas_internas),
        terminos: textoONull(v.terminos),
      },
      v.items.map((i) => ({
        producto_id: i.producto_id,
        peso_kg: i.peso_kg,
        precio_usd_kg: i.precio_usd_kg,
        nota: textoONull(i.nota),
      }))
    )
  } catch (e) {
    traducir(e)
  }
}

async function exigir(cotizaciones: ICotizacionRepository, id: string): Promise<Cotizacion> {
  const c = await cotizaciones.getById(id)
  if (!c) throw new CotizacionError('La cotización no existe')
  return c
}

/** Borrador → enviada (al compartir, P10). No-op en cualquier otro estado. */
export async function marcarEnviada(id: string): Promise<Cotizacion> {
  const { cotizaciones } = await contexto()
  const c = await exigir(cotizaciones, id)
  if (c.estado !== 'borrador') return c
  try {
    return await cotizaciones.cambiarEstado(id, { estado: 'enviada' })
  } catch (e) {
    traducir(e)
  }
}

export async function aceptar(id: string): Promise<Cotizacion> {
  const { cotizaciones } = await contexto()
  const c = await exigir(cotizaciones, id)
  if (estadoEfectivo(c, fechaHoy()) === 'vencida') {
    throw new CotizacionError('La cotización está vencida: renuévala antes de marcarla aceptada')
  }
  try {
    return await cotizaciones.cambiarEstado(id, { estado: 'aceptada' })
  } catch (e) {
    traducir(e)
  }
}

export async function rechazar(id: string, motivo: string | null): Promise<Cotizacion> {
  const { cotizaciones } = await contexto()
  try {
    return await cotizaciones.cambiarEstado(id, { estado: 'rechazada', motivo_rechazo: textoONull(motivo) })
  } catch (e) {
    traducir(e)
  }
}

export async function anular(id: string, motivo: string | null): Promise<Cotizacion> {
  const { cotizaciones } = await contexto()
  try {
    return await cotizaciones.cambiarEstado(id, { estado: 'anulada', motivo_anulacion: textoONull(motivo) })
  } catch (e) {
    traducir(e)
  }
}

/**
 * Renueva una cotización abierta (o vencida): fecha de hoy y validez nueva,
 * con el resto de los datos de `v`; recalcula el IVA con el % vigente.
 */
export async function renovar(id: string, v: CotizacionInput): Promise<string> {
  return guardarCotizacion(id, { ...v, fecha: fechaHoy() })
}

/* ============================ Enlace público (Fase C) ============================ */

/** Token de 32 caracteres `base64url` (192 bits), generado en el servidor (P7). */
function nuevoToken(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Base absoluta de los enlaces: `SITE_URL` (debe estar en Vercel con el
 * dominio de producción); si falta, el `origin` de la petición
 * (`x-forwarded-host`/`x-forwarded-proto`), y se registra en consola.
 */
export async function baseUrlPublica(): Promise<string> {
  const site = process.env.SITE_URL?.trim()
  if (site) return site
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  console.warn('[cotizaciones] SITE_URL no está configurada: el enlace usa el origin de la petición')
  return `${proto}://${host}`
}

export interface EnlaceCotizacion {
  token: string
  url: string
}

/** Crea el enlace si no hay uno (si ya existe, devuelve el actual). */
export async function crearEnlace(id: string): Promise<EnlaceCotizacion> {
  const { cotizaciones } = await contexto()
  const c = await exigir(cotizaciones, id)
  if (c.token_publico) return { token: c.token_publico, url: urlPublica(c.token_publico, await baseUrlPublica()) }
  try {
    const actualizada = await cotizaciones.cambiarToken(id, nuevoToken())
    const token = actualizada.token_publico as string
    return { token, url: urlPublica(token, await baseUrlPublica()) }
  } catch (e) {
    traducir(e)
  }
}

/** Reemplaza el token: el enlace anterior deja de funcionar al instante. */
export async function regenerarEnlace(id: string): Promise<EnlaceCotizacion> {
  const { cotizaciones } = await contexto()
  try {
    const actualizada = await cotizaciones.cambiarToken(id, nuevoToken())
    const token = actualizada.token_publico as string
    return { token, url: urlPublica(token, await baseUrlPublica()) }
  } catch (e) {
    traducir(e)
  }
}

/** Pone el token en `null`: el enlace deja de mostrar la cotización. */
export async function revocarEnlace(id: string): Promise<void> {
  const { cotizaciones } = await contexto()
  try {
    await cotizaciones.cambiarToken(id, null)
  } catch (e) {
    traducir(e)
  }
}

export interface EnvioCotizacion {
  url: string
  /** Mensaje de WhatsApp prellenado (editable en el diálogo). */
  mensaje: string
  /** Teléfono del cliente (registrado o libre); el navegador arma el `wa.me`. */
  telefono: string | null
}

/**
 * Prepara el diálogo «Compartir» (P10): crea el enlace si falta y arma el
 * mensaje. Una vencida no se comparte (el enlace no la mostraría, P7): hay
 * que renovarla. Una anulada no tiene enlace.
 */
export async function prepararEnvio(id: string): Promise<EnvioCotizacion> {
  const { db, cotizaciones } = await contexto()
  const d = await cotizaciones.getDetalle(id)
  if (!d) throw new CotizacionError('La cotización no existe')
  if (d.estado === 'anulada') throw new CotizacionError('Una cotización anulada no se comparte')
  if (estadoEfectivo(d, fechaHoy()) === 'vencida') {
    throw new CotizacionError('Renueva la cotización antes de compartirla')
  }
  const { url } = await crearEnlace(id)
  const config = await getConfigNegocio(db)
  const cliente = d.cliente?.nombre ?? d.cliente_nombre ?? 'cliente'
  return {
    url,
    mensaje: mensajeWhatsAppCotizacion({
      cliente,
      numero: d.numero,
      nombreComercial: config?.nombre_comercial ?? null,
      totalUsd: d.total_usd,
      fechaVencimiento: d.fecha_vencimiento,
      url,
    }),
    telefono: d.cliente ? d.cliente.telefono : d.cliente_telefono,
  }
}
