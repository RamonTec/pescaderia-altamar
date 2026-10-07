import type {
  DocumentoProveedor,
  Proveedor,
  RepresentanteProveedor,
  EstadoDocumental,
  TipoMetodoPago,
} from '@/types/domain'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { makeRepresentanteProveedorRepository } from '@/lib/repositories/representanteProveedorRepository'
import { makeMetodoPagoProveedorRepository } from '@/lib/repositories/metodoPagoProveedorRepository'
import { createClient } from '@/lib/supabase/server'
import { getRol } from './authService'
import { getSaldoPendiente as getSaldoProveedor } from './proveedorBalanceService'
import { evaluarDocumentacion as evaluarDoc } from '@/lib/evaluarDocumentacion'

/**
 * ProveedorService (SRP): reglas de negocio de control de proveedores.
 * Los repositorios solo acceden a datos; aquí vive la validación y la
 * autorización (bloqueo/desbloqueo son acciones de admin).
 */

export class AccionNoAutorizadaError extends Error {
  constructor() {
    super('Esta acción solo puede realizarla un administrador')
    this.name = 'AccionNoAutorizadaError'
  }
}

export interface RepresentanteProveedorInput {
  id?: string
  nombre: string
  cedula: string
  cargo: string
  telefono: string
}

export interface MetodoPagoProveedorInput {
  id?: string
  tipo: TipoMetodoPago
  banco_codigo: string | null
  numero_cuenta: string | null
  tipo_cuenta: 'corriente' | 'ahorro' | null
  telefono: string | null
  email: string | null
  titular: string | null
  titular_rif_ci: string | null
  preferido: boolean
}

export interface ProveedorCreateInput {
  nombre: string
  tipo_persona: 'natural' | 'juridica'
  rif_ci: string
  telefono: string
  email: string
  direccion: string
  contacto_nombre: string
  contacto_telefono: string
  notas: string
  representantes: RepresentanteProveedorInput[]
  metodosPago: MetodoPagoProveedorInput[]
}

function limpia(value: string | null | undefined): string | null {
  const t = (value ?? '').trim()
  return t === '' ? null : t
}

/**
 * Sincroniza una colección hija (representantes o métodos de pago) con un
 * patrón de diff: borra los que ya no vienen, actualiza los que traen id,
 * crea los nuevos.
 */
async function sincronizarHijos<T extends { id?: string }>(
  existentes: { id: string }[],
  enviados: T[],
  update: (id: string, data: Omit<T, 'id'>) => Promise<unknown>,
  create: (data: Omit<T, 'id'>) => Promise<unknown>,
  delete_: (id: string) => Promise<unknown>
): Promise<void> {
  const idsEnviados = new Set(enviados.filter((e) => e.id).map((e) => e.id as string))

  for (const e of existentes) {
    if (!idsEnviados.has(e.id)) {
      await delete_(e.id)
    }
  }

  for (const item of enviados) {
    const { id, ...rest } = item
    if (id) {
      await update(id, rest)
    } else {
      await create(rest)
    }
  }
}

async function sincronizarRepresentantes(
  proveedorId: string,
  representantes: RepresentanteProveedorInput[]
): Promise<void> {
  const db = await createClient()
  const repo = makeRepresentanteProveedorRepository(db)
  const existentes = await repo.listByProveedor(proveedorId)

  const activos = representantes
    .filter((r) => r.nombre.trim())
    .map((r) => ({
      id: r.id,
      nombre: r.nombre.trim(),
      cedula: r.cedula.trim(),
      cargo: limpia(r.cargo),
      telefono: limpia(r.telefono),
    }))

  await sincronizarHijos(
    existentes,
    activos,
    (id, data) => repo.update(id, data),
    (data) => repo.create({ ...data, proveedor_id: proveedorId }),
    (id) => repo.delete(id)
  )
}

async function sincronizarMetodosPago(
  proveedorId: string,
  metodos: MetodoPagoProveedorInput[]
): Promise<void> {
  const db = await createClient()
  const repo = makeMetodoPagoProveedorRepository(db)
  const existentes = await repo.listByProveedor(proveedorId)

  const limpios = metodos.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    banco_codigo: limpia(m.banco_codigo),
    numero_cuenta: limpia(m.numero_cuenta),
    tipo_cuenta: m.tipo_cuenta,
    telefono: limpia(m.telefono),
    email: limpia(m.email),
    titular: limpia(m.titular),
    titular_rif_ci: limpia(m.titular_rif_ci),
    preferido: m.preferido,
  }))

  await sincronizarHijos(
    existentes,
    limpios,
    (id, data) => repo.update(id, data),
    (data) => repo.create({ ...data, proveedor_id: proveedorId }),
    (id) => repo.delete(id)
  )
}

export async function crearProveedor(input: ProveedorCreateInput): Promise<Proveedor> {
  const db = await createClient()
  const repo = makeProveedorRepository(db)

  const proveedor = await repo.create({
    nombre: input.nombre.trim(),
    tipo_persona: input.tipo_persona,
    rif_ci: input.rif_ci.trim().toUpperCase(),
    telefono: limpia(input.telefono),
    email: limpia(input.email),
    direccion: limpia(input.direccion),
    contacto_nombre: limpia(input.contacto_nombre),
    contacto_telefono: limpia(input.contacto_telefono),
    notas: limpia(input.notas),
  })

  await sincronizarRepresentantes(proveedor.id, input.representantes)
  await sincronizarMetodosPago(proveedor.id, input.metodosPago)
  return proveedor
}

export async function actualizarProveedor(
  id: string,
  input: ProveedorCreateInput
): Promise<Proveedor> {
  const db = await createClient()
  const repo = makeProveedorRepository(db)

  const proveedor = await repo.update(id, {
    nombre: input.nombre.trim(),
    tipo_persona: input.tipo_persona,
    rif_ci: input.rif_ci.trim().toUpperCase(),
    telefono: limpia(input.telefono),
    email: limpia(input.email),
    direccion: limpia(input.direccion),
    contacto_nombre: limpia(input.contacto_nombre),
    contacto_telefono: limpia(input.contacto_telefono),
    notas: limpia(input.notas),
  })

  await sincronizarRepresentantes(id, input.representantes)
  await sincronizarMetodosPago(id, input.metodosPago)
  return proveedor
}

export async function desactivar(id: string): Promise<Proveedor> {
  const db = await createClient()
  return makeProveedorRepository(db).update(id, { activo: false })
}

export async function activar(id: string): Promise<Proveedor> {
  const db = await createClient()
  return makeProveedorRepository(db).update(id, { activo: true })
}

export async function bloquear(id: string, motivo: string): Promise<Proveedor> {
  if ((await getRol()) !== 'admin') throw new AccionNoAutorizadaError()

  const motivoLimpio = motivo.trim()
  if (!motivoLimpio) {
    throw new Error('El motivo de bloqueo es obligatorio')
  }

  const db = await createClient()
  return makeProveedorRepository(db).update(id, {
    bloqueado: true,
    motivo_bloqueo: motivoLimpio,
  })
}

export async function desbloquear(id: string): Promise<Proveedor> {
  if ((await getRol()) !== 'admin') throw new AccionNoAutorizadaError()

  const db = await createClient()
  return makeProveedorRepository(db).update(id, {
    bloqueado: false,
    motivo_bloqueo: null,
  })
}

/**
 * Documentación requerida (indicador, no bloquea nada).
 *   - Natural: cédula + RIF.
 *   - Jurídica: RIF + acta constitutiva + cédula de cada representante.
 * Función pura, sin I/O.
 */
export function evaluarDocumentacion(
  proveedor: Pick<Proveedor, 'tipo_persona'>,
  representantes: RepresentanteProveedor[],
  documentos: DocumentoProveedor[]
): EstadoDocumental {
  return evaluarDoc(proveedor, representantes, documentos)
}

/**
 * Saldo pendiente del proveedor. La lógica vive en 04-inventario
 * (proveedorBalanceService); este módulo la consume.
 */
export async function getSaldoPendiente(proveedorId: string): Promise<number | null> {
  return getSaldoProveedor(proveedorId)
}
