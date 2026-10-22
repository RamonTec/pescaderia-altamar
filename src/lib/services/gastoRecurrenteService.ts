import type { GastoRecurrente } from '@/types/domain'
import type {
  GastoRecurrenteCambios,
  GastoRecurrenteNuevo,
  IGastoRecurrenteRepository,
  ResultadoGeneracionRecurrente,
} from '@/lib/repositories/interfaces'
import { makeGastoRecurrenteRepository } from '@/lib/repositories/gastoRecurrenteRepository'
import { makeCategoriaGastoRepository } from '@/lib/repositories/categoriaGastoRepository'
import { makeEmpleadoRepository } from '@/lib/repositories/empleadoRepository'
import { createClient } from '@/lib/supabase/server'
import type { GastoRecurrenteValues } from '@/lib/gastoRecurrenteValidation'
import { requireAdmin } from './authService'
import { MSG_SOLO_ADMIN_GASTOS } from './categoriaGastoService'

/**
 * GastoRecurrenteService (20-gastos, Fase C): gestión de plantillas de gastos
 * recurrentes y generación idempotente de gastos pendientes.
 * Todas las funciones exigen rol administrador.
 */

export class GastoRecurrenteError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'GastoRecurrenteError'
  }
}

interface PgErrorLike {
  code?: string
  hint?: string
  message?: string
}

const CAMPO_POR_HINT: Record<string, string> = {
  categoria_inactiva: 'categoria_id',
  categoria_nomina_requiere_empleado: 'empleado_id',
  empleado_requiere_nomina: 'empleado_id',
  empleado_inactivo: 'empleado_id',
  fecha_futura: 'fecha_inicio',
}

function traducir(e: unknown): never {
  const pg = (e ?? {}) as PgErrorLike
  if (pg.hint && CAMPO_POR_HINT[pg.hint]) {
    throw new GastoRecurrenteError(pg.message ?? 'Error de validación', CAMPO_POR_HINT[pg.hint])
  }
  if (pg.message) {
    throw new GastoRecurrenteError(pg.message)
  }
  throw e
}

async function contexto(): Promise<{
  repo: IGastoRecurrenteRepository
  categorias: ReturnType<typeof makeCategoriaGastoRepository>
  empleados: ReturnType<typeof makeEmpleadoRepository>
}> {
  if (!(await requireAdmin())) throw new GastoRecurrenteError(MSG_SOLO_ADMIN_GASTOS)
  const db = await createClient()
  return {
    repo: makeGastoRecurrenteRepository(db),
    categorias: makeCategoriaGastoRepository(db),
    empleados: makeEmpleadoRepository(db),
  }
}

const textoONull = (s: string | null | undefined) => (!s || s.trim() === '' ? null : s.trim())

/** Lista todas las plantillas de gastos recurrentes (activas e inactivas). */
export async function listarRecurrentes(): Promise<GastoRecurrente[]> {
  const { repo } = await contexto()
  return repo.list()
}

/** Obtiene una plantilla de gasto recurrente por id. */
export async function getRecurrente(id: string): Promise<GastoRecurrente | null> {
  const { repo } = await contexto()
  return repo.getById(id)
}

/** Crea una nueva plantilla de gasto recurrente. */
export async function crearRecurrente(input: GastoRecurrenteValues): Promise<GastoRecurrente> {
  const { repo, categorias, empleados } = await contexto()

  // Validación de categoría
  const cats = await categorias.list()
  const cat = cats.find((c) => c.id === input.categoria_id)
  if (!cat || !cat.activo) {
    throw new GastoRecurrenteError('La categoría seleccionada no existe o está inactiva', 'categoria_id')
  }

  // Validación de nómina ⇔ empleado
  if (cat.clave === 'nomina') {
    if (!input.empleado_id) {
      throw new GastoRecurrenteError('Una plantilla de Nómina requiere indicar el empleado', 'empleado_id')
    }
    const emp = await empleados.getById(input.empleado_id)
    if (!emp || !emp.activo) {
      throw new GastoRecurrenteError('El empleado seleccionado está inactivo o no existe', 'empleado_id')
    }
  } else if (input.empleado_id) {
    throw new GastoRecurrenteError('Solo las plantillas de Nómina pueden asociar un empleado', 'empleado_id')
  }

  const datos: GastoRecurrenteNuevo = {
    nombre: input.nombre.trim(),
    categoria_id: input.categoria_id,
    empleado_id: input.empleado_id ?? null,
    descripcion: input.descripcion.trim(),
    beneficiario: textoONull(input.beneficiario),
    moneda: input.moneda,
    monto: input.monto !== null && input.monto !== undefined ? input.monto : null,
    frecuencia: input.frecuencia,
    dia_mes: input.frecuencia === 'mensual' && input.dia_mes ? input.dia_mes : null,
    fecha_inicio: input.fecha_inicio,
    fecha_fin: textoONull(input.fecha_fin),
    metodo_pago: input.metodo_pago ?? null,
    activo: input.activo ?? true,
  }

  try {
    return await repo.create(datos)
  } catch (e) {
    traducir(e)
  }
}

/** Edita una plantilla de gasto recurrente existente. */
export async function editarRecurrente(id: string, input: GastoRecurrenteValues): Promise<GastoRecurrente> {
  const { repo, categorias, empleados } = await contexto()

  const actual = await repo.getById(id)
  if (!actual) throw new GastoRecurrenteError('La plantilla recurrente no existe')

  const cats = await categorias.list()
  const cat = cats.find((c) => c.id === input.categoria_id)
  if (!cat || !cat.activo) {
    throw new GastoRecurrenteError('La categoría seleccionada no existe o está inactiva', 'categoria_id')
  }

  if (cat.clave === 'nomina') {
    if (!input.empleado_id) {
      throw new GastoRecurrenteError('Una plantilla de Nómina requiere indicar el empleado', 'empleado_id')
    }
    const emp = await empleados.getById(input.empleado_id)
    if (!emp || !emp.activo) {
      throw new GastoRecurrenteError('El empleado seleccionado está inactivo o no existe', 'empleado_id')
    }
  } else if (input.empleado_id) {
    throw new GastoRecurrenteError('Solo las plantillas de Nómina pueden asociar un empleado', 'empleado_id')
  }

  const cambios: GastoRecurrenteCambios = {
    nombre: input.nombre.trim(),
    categoria_id: input.categoria_id,
    empleado_id: input.empleado_id ?? null,
    descripcion: input.descripcion.trim(),
    beneficiario: textoONull(input.beneficiario),
    moneda: input.moneda,
    monto: input.monto !== null && input.monto !== undefined ? input.monto : null,
    frecuencia: input.frecuencia,
    dia_mes: input.frecuencia === 'mensual' && input.dia_mes ? input.dia_mes : null,
    fecha_inicio: input.fecha_inicio,
    fecha_fin: textoONull(input.fecha_fin),
    metodo_pago: input.metodo_pago ?? null,
    activo: input.activo,
  }

  try {
    return await repo.update(id, cambios)
  } catch (e) {
    traducir(e)
  }
}

/** Activa o desactiva una plantilla recurrente. */
export async function cambiarEstadoRecurrente(id: string, activo: boolean): Promise<GastoRecurrente> {
  const { repo } = await contexto()
  try {
    return await repo.update(id, { activo })
  } catch (e) {
    traducir(e)
  }
}

/**
 * Genera gastos pendientes para todas las plantillas activas hasta la fecha
 * indicada (o hasta hoy por defecto). Idempotente (P4).
 */
export async function generarPendientes(hasta?: string): Promise<ResultadoGeneracionRecurrente> {
  const { repo } = await contexto()
  try {
    return await repo.generar(hasta)
  } catch (e) {
    traducir(e)
  }
}
