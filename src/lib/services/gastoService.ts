import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CategoriaGasto,
  EstadoGasto,
  Gasto,
  GastoDetalle,
  GastoPorCategoria,
  RangoFechas,
  ResumenGastos,
} from '@/types/domain'
import type {
  GastoNuevo,
  ICategoriaGastoRepository,
  IEmpleadoRepository,
  IGastoRepository,
} from '@/lib/repositories/interfaces'
import { makeGastoRepository } from '@/lib/repositories/gastoRepository'
import { makeCategoriaGastoRepository } from '@/lib/repositories/categoriaGastoRepository'
import { makeEmpleadoRepository } from '@/lib/repositories/empleadoRepository'
import { createClient } from '@/lib/supabase/server'
import type {
  AnularGastoValues,
  DescartarGastoValues,
  EditarGastoValues,
  FiltroEstadoGasto,
  GastoFormValues,
  PagoNominaValues,
} from '@/lib/gastoValidation'
import { entradaTasaDe } from '@/lib/tasaValidation'
import { MSG_TASA_SIN_REFERENCIAL } from '@/lib/validationMessages'
import { montoUsdGasto, redondea6Gasto } from '@/lib/gastos/montos'
import { periodosSeSolapan } from '@/lib/gastos/periodos'
import { requireAdmin } from './authService'
import { MSG_SOLO_ADMIN_GASTOS } from './categoriaGastoService'
import { resolverTasaOperacion } from './tasaService'

/**
 * GastoService (20-gastos): único que usa los repositorios de gastos. Todas
 * las funciones exigen admin antes de tocar las tablas.
 *
 * - Alta manual: nace `confirmado`; la tasa se resuelve en el servidor con
 *   `resolverTasaOperacion` para la fecha del gasto (nunca se confía en la
 *   referencial del cliente) y `monto_usd` sale de `montoUsdGasto` (misma
 *   regla y redondeo que el check `gastos_monto_usd`). En USD también se
 *   guarda la tasa (equivalente en Bs, como compras).
 * - Confirmado (P1 = b): solo cambian descripción, beneficiario, referencia y
 *   notas; el importe se corrige anulando y registrando de nuevo.
 * - Nunca se borra: se anula con motivo (o se descarta un pendiente).
 * - Nómina (Fase B): un pago es un gasto de la categoría de sistema Nómina
 *   con empleado activo y período (`registrarPagoNomina`); el alta común no
 *   admite Nómina. Un período solapado con otro pago confirmado del mismo
 *   empleado se avisa, no se bloquea.
 * - Los totales suman solo `monto_usd` de los `confirmado` (P2: por `fecha`).
 */

/** Error de regla de negocio; `campo` permite marcarlo en el formulario. */
export class GastoError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'GastoError'
  }
}

interface PgErrorLike {
  code?: string
  hint?: string
  message?: string
}

/** `hint` de `gastos_guard` → campo del formulario (`null` = al `Alert`). */
const CAMPO_POR_HINT: Record<string, string | null> = {
  fecha_futura: 'fecha',
  categoria_inactiva: 'categoria_id',
  categoria_nomina_requiere_empleado: 'empleado_id',
  empleado_requiere_nomina: 'categoria_id',
  empleado_inactivo: 'empleado_id',
  periodo_requerido: 'periodo_desde',
  motivo_requerido: 'motivo',
  transicion_invalida: null,
  gasto_inmutable: null,
}

/** Traduce los errores de `gastos_guard` (P0001 + `hint`) a `GastoError` con su campo. */
function traducir(e: unknown): never {
  const pg = (e ?? {}) as PgErrorLike
  if (pg.code === 'P0001' && pg.hint && pg.hint in CAMPO_POR_HINT) {
    throw new GastoError(pg.message ?? 'Operación no permitida', CAMPO_POR_HINT[pg.hint] ?? undefined)
  }
  if (pg.code === '23514' && pg.message?.includes('gastos_monto_usd')) {
    throw new GastoError('El monto en USD no coincide con el monto y la tasa', 'monto')
  }
  throw e
}

interface Contexto {
  db: SupabaseClient
  gastos: IGastoRepository
  categorias: ICategoriaGastoRepository
  empleados: IEmpleadoRepository
}

async function contexto(): Promise<Contexto> {
  if (!(await requireAdmin())) throw new GastoError(MSG_SOLO_ADMIN_GASTOS)
  const db = await createClient()
  return {
    db,
    gastos: makeGastoRepository(db),
    categorias: makeCategoriaGastoRepository(db),
    empleados: makeEmpleadoRepository(db),
  }
}

/** Mensaje del alta común si se elige Nómina (va por «Pago de nómina»). */
export const MSG_NOMINA_POR_PAGO = 'Los pagos de nómina se registran con «Pago de nómina» (empleado y período)'

const textoONull = (s: string) => (s.trim() === '' ? null : s.trim())

/**
 * Tasa resuelta en el servidor + columnas de importe del gasto. La
 * referencial se guarda igual al snapshot (check `gastos_tasa_coherente`).
 */
async function importeDe(
  v: GastoFormValues,
  db: SupabaseClient
): Promise<{ columnas: Pick<GastoNuevo, 'monto' | 'tasa_snapshot' | 'tasa_origen' | 'tasa_fuente' | 'tasa_referencial' | 'monto_usd'>; aviso?: 'referencial_cambio' }> {
  const resultado = await resolverTasaOperacion(entradaTasaDe(v), v.fecha, db)
  if (resultado.error === 'sin_referencial' || !resultado.tasa_operacion) {
    throw new GastoError(MSG_TASA_SIN_REFERENCIAL, 'tasa')
  }
  const t = resultado.tasa_operacion
  const tasa = redondea6Gasto(t.tasa_snapshot)
  const monto = redondea6Gasto(v.monto)
  return {
    columnas: {
      monto,
      tasa_snapshot: tasa,
      tasa_origen: t.tasa_origen,
      tasa_fuente: t.tasa_fuente,
      tasa_referencial:
        t.tasa_origen === 'referencial' ? tasa : t.tasa_referencial === null ? null : redondea6Gasto(t.tasa_referencial),
      monto_usd: montoUsdGasto(v.moneda, monto, tasa),
    },
    aviso: resultado.aviso,
  }
}

/** Categoría activa (y su padre activo) del catálogo; mensaje en su campo. */
function exigirCategoriaActiva(categorias: readonly CategoriaGasto[], id: string): CategoriaGasto {
  const cat = categorias.find((c) => c.id === id)
  if (!cat) throw new GastoError('La categoría no existe', 'categoria_id')
  const padre = cat.categoria_padre_id ? categorias.find((c) => c.id === cat.categoria_padre_id) : null
  if (!cat.activo || (padre && !padre.activo)) {
    throw new GastoError(`La categoría ${cat.nombre} está inactiva`, 'categoria_id')
  }
  return cat
}

function columnasDescriptivas(
  v: GastoFormValues,
  empleadoId: string | null = null,
  recurrenteId: string | null = null
): Omit<GastoNuevo, 'monto' | 'tasa_snapshot' | 'tasa_origen' | 'tasa_fuente' | 'tasa_referencial' | 'monto_usd'> {
  return {
    empleado_id: empleadoId,
    recurrente_id: recurrenteId,
    fecha: v.fecha,
    categoria_id: v.categoria_id,
    descripcion: v.descripcion.trim(),
    beneficiario: textoONull(v.beneficiario),
    moneda: v.moneda,
    metodo_pago: v.metodo_pago,
    referencia: textoONull(v.referencia),
    notas: textoONull(v.notas),
    periodo_desde: v.periodo_desde || null,
    periodo_hasta: v.periodo_hasta || null,
  }
}

/** Alta manual: nace `confirmado`. */
export async function registrarGasto(v: GastoFormValues): Promise<{ gasto: Gasto; aviso?: 'referencial_cambio' }> {
  const { db, gastos, categorias } = await contexto()
  const cat = exigirCategoriaActiva(await categorias.list(), v.categoria_id)
  if (cat.clave === 'nomina') throw new GastoError(MSG_NOMINA_POR_PAGO, 'categoria_id')
  const { columnas, aviso } = await importeDe(v, db)
  try {
    const gasto = await gastos.create({ ...columnasDescriptivas(v), ...columnas })
    return { gasto, aviso }
  } catch (e) {
    traducir(e)
  }
}

/** Pagos confirmados del empleado cuyo período se solapa con `[desde, hasta]`. */
async function solapadosDe(
  gastos: IGastoRepository,
  empleadoId: string,
  desde: string,
  hasta: string
): Promise<Gasto[]> {
  const pagos = await gastos.list({ empleadoId, estados: ['confirmado'] })
  return pagos.filter(
    (g) =>
      g.periodo_desde !== null &&
      g.periodo_hasta !== null &&
      periodosSeSolapan({ desde, hasta }, { desde: g.periodo_desde, hasta: g.periodo_hasta })
  )
}

/**
 * Pagos confirmados del empleado con período solapado (aviso del formulario
 * de nómina; no bloquea).
 */
export async function pagosSolapados(empleadoId: string, desde: string, hasta: string): Promise<Gasto[]> {
  const { gastos } = await contexto()
  return solapadosDe(gastos, empleadoId, desde, hasta)
}

/**
 * Pago de nómina (Fase B): nace `confirmado` en la categoría de sistema
 * Nómina (la fija el servidor), con empleado activo y período. El monto lo
 * precarga la UI con `montoNominaPeriodo` (P3) y es editable. Devuelve los
 * pagos confirmados con período solapado: se avisa, no se bloquea.
 */
export async function registrarPagoNomina(
  v: PagoNominaValues
): Promise<{ gasto: Gasto; aviso?: 'referencial_cambio'; solapados: Gasto[] }> {
  const { db, gastos, categorias, empleados } = await contexto()
  const nomina = (await categorias.list()).find((c) => c.clave === 'nomina')
  if (!nomina) throw new GastoError('No existe la categoría Nómina')
  const empleado = await empleados.getById(v.empleado_id)
  if (!empleado) throw new GastoError('El empleado no existe', 'empleado_id')
  if (!empleado.activo) {
    throw new GastoError(`${empleado.nombre} está inactivo: no recibe pagos nuevos`, 'empleado_id')
  }
  const valores: GastoFormValues = { ...v, categoria_id: nomina.id }
  const solapados = await solapadosDe(gastos, empleado.id, v.periodo_desde, v.periodo_hasta)
  const { columnas, aviso } = await importeDe(valores, db)
  try {
    const gasto = await gastos.create({ ...columnasDescriptivas(valores, empleado.id), ...columnas })
    return { gasto, aviso, solapados }
  } catch (e) {
    traducir(e)
  }
}

/**
 * Confirma un pendiente (Fase C) con los datos finales: la tasa se resuelve
 * para la fecha final del gasto.
 */
export async function confirmarGasto(
  id: string,
  v: GastoFormValues
): Promise<{ gasto: Gasto; aviso?: 'referencial_cambio' }> {
  const { db, gastos, categorias } = await contexto()
  const actual = await gastos.getById(id)
  if (!actual) throw new GastoError('El gasto no existe')
  if (actual.estado !== 'pendiente') throw new GastoError('Solo se confirman gastos pendientes')
  exigirCategoriaActiva(await categorias.list(), v.categoria_id)
  const { columnas, aviso } = await importeDe(v, db)
  try {
    const gasto = await gastos.update(id, {
      ...columnasDescriptivas(v, actual.empleado_id, actual.recurrente_id),
      ...columnas,
      estado: 'confirmado',
    })
    return { gasto, aviso }
  } catch (e) {
    traducir(e)
  }
}

/** P1 (b): solo descripción, beneficiario, referencia y notas de un confirmado. */
export async function editarGasto(v: EditarGastoValues): Promise<Gasto> {
  const { gastos } = await contexto()
  const actual = await gastos.getById(v.id)
  if (!actual) throw new GastoError('El gasto no existe')
  if (actual.estado !== 'confirmado') {
    throw new GastoError(`Un gasto ${actual.estado} no se edita`)
  }
  try {
    return await gastos.update(v.id, {
      descripcion: v.descripcion.trim(),
      beneficiario: textoONull(v.beneficiario),
      referencia: textoONull(v.referencia),
      notas: textoONull(v.notas),
    })
  } catch (e) {
    traducir(e)
  }
}

/** `confirmado → anulado` con motivo 5–500: deja de contar en reportes. */
export async function anularGasto(v: AnularGastoValues): Promise<Gasto> {
  const { gastos } = await contexto()
  const actual = await gastos.getById(v.id)
  if (!actual) throw new GastoError('El gasto no existe')
  if (actual.estado !== 'confirmado') throw new GastoError('Solo se anulan gastos confirmados')
  try {
    return await gastos.anular(v.id, v.motivo.trim())
  } catch (e) {
    traducir(e)
  }
}

/** `pendiente → descartado` (motivo opcional): el período no se regenera. */
export async function descartarGasto(v: DescartarGastoValues): Promise<Gasto> {
  const { gastos } = await contexto()
  const actual = await gastos.getById(v.id)
  if (!actual) throw new GastoError('El gasto no existe')
  if (actual.estado !== 'pendiente') throw new GastoError('Solo se descartan gastos pendientes')
  try {
    return await gastos.descartar(v.id, textoONull(v.motivo))
  } catch (e) {
    traducir(e)
  }
}

/** Estados de cada filtro de `?estado=`. */
export const ESTADOS_POR_FILTRO: Record<FiltroEstadoGasto, EstadoGasto[] | null> = {
  confirmado: ['confirmado'],
  pendiente: ['pendiente'],
  cerrados: ['anulado', 'descartado'],
  todos: null,
}

/** Ids de una categoría y de sus subcategorías (filtro "categoría"). */
export function idsDeCategoria(categorias: readonly CategoriaGasto[], id: string): string[] {
  return [id, ...categorias.filter((c) => c.categoria_padre_id === id).map((c) => c.id)]
}

/** Gastos del rango (por `fecha`, P2), de cualquier estado salvo que se filtre. */
export async function listarGastos(filtros: {
  rango: RangoFechas
  estado?: FiltroEstadoGasto
  categoriaId?: string | null
  /** Pagos de nómina de un empleado (ficha, Fase B). */
  empleadoId?: string | null
}): Promise<Gasto[]> {
  const { gastos, categorias } = await contexto()
  const estados = filtros.estado ? ESTADOS_POR_FILTRO[filtros.estado] : null
  const categoriaIds = filtros.categoriaId
    ? idsDeCategoria(await categorias.list(), filtros.categoriaId)
    : undefined
  return gastos.list({
    desde: filtros.rango.desde,
    hasta: filtros.rango.hasta,
    estados: estados ?? undefined,
    categoriaIds,
    empleadoId: filtros.empleadoId ?? undefined,
  })
}

export async function getGastoDetalle(id: string): Promise<GastoDetalle | null> {
  const { gastos } = await contexto()
  return gastos.getDetalle(id)
}

/**
 * Totales de gastos confirmados por categoría de primer nivel y subcategoría
 * (función pura; el mismo shape que la RPC `dashboard_gastos` de la Fase D).
 */
export function resumirGastos(lista: readonly Gasto[], categorias: readonly CategoriaGasto[]): ResumenGastos {
  const porId = new Map(categorias.map((c) => [c.id, c]))
  const grupos = new Map<string, GastoPorCategoria>()
  let total = 0
  let n = 0
  for (const g of lista) {
    if (g.estado !== 'confirmado' || g.monto_usd === null) continue
    total += g.monto_usd
    n++
    const cat = porId.get(g.categoria_id)
    const padre = cat?.categoria_padre_id ? porId.get(cat.categoria_padre_id) : undefined
    const raiz = padre ?? cat
    const sub = padre ? cat : undefined
    const clave = `${raiz?.id ?? g.categoria_id}|${sub?.id ?? ''}`
    const fila = grupos.get(clave) ?? {
      categoria_id: raiz?.id ?? g.categoria_id,
      categoria: raiz?.nombre ?? '—',
      es_sistema: raiz?.es_sistema ?? false,
      subcategoria_id: sub?.id ?? null,
      subcategoria: sub?.nombre ?? null,
      total_usd: 0,
      n_gastos: 0,
    }
    fila.total_usd += g.monto_usd
    fila.n_gastos++
    grupos.set(clave, fila)
  }
  const redondear = (x: number) => redondea6Gasto(x)
  return {
    total_usd: redondear(total),
    n_gastos: n,
    por_categoria: [...grupos.values()]
      .map((f) => ({ ...f, total_usd: redondear(f.total_usd) }))
      .sort((a, b) => b.total_usd - a.total_usd),
  }
}

/** Resumen de los confirmados del rango: total USD, n.º y por categoría. */
export async function resumenGastos(rango: RangoFechas): Promise<ResumenGastos> {
  const { gastos, categorias } = await contexto()
  const [lista, cats] = await Promise.all([
    gastos.list({ desde: rango.desde, hasta: rango.hasta, estados: ['confirmado'] }),
    categorias.list(),
  ])
  return resumirGastos(lista, cats)
}
