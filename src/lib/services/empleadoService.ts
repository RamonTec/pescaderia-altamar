import type { CostoEmpleado, Empleado, RangoFechas } from '@/types/domain'
import type { IEmpleadoRepository } from '@/lib/repositories/interfaces'
import { makeEmpleadoRepository } from '@/lib/repositories/empleadoRepository'
import { createClient } from '@/lib/supabase/server'
import type { ActivarEmpleadoValues, EmpleadoFormValues } from '@/lib/empleadoValidation'
import { MSG_EMPLEADO_CEDULA_DUPLICADA } from '@/lib/validationMessages'
import { redondea6Gasto, resumirCostoEmpleado } from '@/lib/gastos/montos'
import { mesesDelRango } from '@/lib/gastos/periodos'
import { requireAdmin } from './authService'
import { MSG_SOLO_ADMIN_GASTOS } from './categoriaGastoService'

/**
 * EmpleadoService (20-gastos, Fase B): empleados para los pagos de nómina.
 * Único que usa `IEmpleadoRepository`; todas las funciones exigen admin
 * antes de tocar la tabla. Se desactivan, no se borran (un inactivo no
 * recibe pagos nuevos). El costo suma solo pagos `confirmado` por `fecha`
 * (P2): anulados fuera.
 */

/** Error de regla de negocio; `campo` permite marcarlo en el formulario. */
export class EmpleadoError extends Error {
  constructor(
    message: string,
    readonly campo?: 'nombre' | 'cedula' | 'cargo' | 'salario_base' | 'moneda' | 'notas'
  ) {
    super(message)
    this.name = 'EmpleadoError'
  }
}

interface PgErrorLike {
  code?: string
  message?: string
}

/** `23505` de la cédula y checks de la tabla → error con su campo. */
function traducir(e: unknown): never {
  const pg = (e ?? {}) as PgErrorLike
  if (pg.code === '23505' && pg.message?.includes('cedula')) {
    throw new EmpleadoError(MSG_EMPLEADO_CEDULA_DUPLICADA, 'cedula')
  }
  if (pg.code === '23514' && pg.message?.includes('empleados_cedula_formato')) {
    throw new EmpleadoError('Cédula inválida (V-/E- + números)', 'cedula')
  }
  throw e
}

async function contexto(): Promise<IEmpleadoRepository> {
  if (!(await requireAdmin())) throw new EmpleadoError(MSG_SOLO_ADMIN_GASTOS)
  return makeEmpleadoRepository(await createClient())
}

const textoONull = (s: string) => (s.trim() === '' ? null : s.trim())

/** Todos los empleados (activos e inactivos), por nombre. */
export async function listarEmpleados(): Promise<Empleado[]> {
  return (await contexto()).list()
}

export async function getEmpleado(id: string): Promise<Empleado | null> {
  return (await contexto()).getById(id)
}

/** Alta (sin `id`) o edición. La cédula duplicada va al campo `cedula`. */
export async function guardarEmpleado(v: EmpleadoFormValues): Promise<Empleado> {
  const repo = await contexto()
  const datos = {
    nombre: v.nombre.trim(),
    cedula: v.cedula,
    cargo: textoONull(v.cargo),
    salario_base: redondea6Gasto(v.salario_base),
    moneda: v.moneda,
    notas: textoONull(v.notas),
  }
  try {
    if (!v.id) return await repo.create(datos)
    if (!(await repo.getById(v.id))) throw new EmpleadoError('El empleado no existe')
    return await repo.update(v.id, datos)
  } catch (e) {
    if (e instanceof EmpleadoError) throw e
    traducir(e)
  }
}

/** Activar o desactivar. Desactivar no toca los pagos hechos. */
export async function cambiarActivoEmpleado(v: ActivarEmpleadoValues): Promise<Empleado> {
  const repo = await contexto()
  if (!(await repo.getById(v.id))) throw new EmpleadoError('El empleado no existe')
  return repo.update(v.id, { activo: v.activo })
}

/**
 * Costo del empleado en el rango: Σ `monto_usd` de sus pagos confirmados,
 * n.º de pagos, promedio mensual (meses calendario que toca el rango) y
 * equivalente en Bs a la tasa de cada pago (Σ `monto_usd × tasa_snapshot`).
 */
export async function getCostoEmpleado(id: string, rango: RangoFechas): Promise<CostoEmpleado> {
  const repo = await contexto()
  const pagos = await repo.costo(id, rango)
  const meses = mesesDelRango(rango.desde, rango.hasta)
  return { empleado_id: id, rango, meses, ...resumirCostoEmpleado(pagos, meses) }
}

/** USD pagado (confirmado) a cada empleado en el rango: `{ [empleado_id]: total }`. */
export async function pagadoPorEmpleado(rango: RangoFechas): Promise<Record<string, number>> {
  const repo = await contexto()
  const totales: Record<string, number> = {}
  for (const p of await repo.pagosDelRango(rango)) {
    totales[p.empleado_id] = (totales[p.empleado_id] ?? 0) + p.monto_usd
  }
  for (const k of Object.keys(totales)) totales[k] = redondea6Gasto(totales[k])
  return totales
}
