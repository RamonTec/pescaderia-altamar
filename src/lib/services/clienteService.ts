import type { Cliente, TipoPersona } from '@/types/domain'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { makeRepresentanteLegalRepository } from '@/lib/repositories/representanteLegalRepository'
import { createClient } from '@/lib/supabase/server'
import { getRol } from './authService'

/**
 * ClienteService (SRP): reglas de negocio de captación de clientes.
 * Los repositorios solo acceden a datos; aquí vive la validación y la
 * autorización (bloqueo/desbloqueo son acciones de admin).
 */

const RIF_CI_RE = /^[VEJG]-\d{6,10}(-\d)?$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class ClienteValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClienteValidationError'
  }
}

export class AccionNoAutorizadaError extends Error {
  constructor() {
    super('Esta acción solo puede realizarla un administrador')
    this.name = 'AccionNoAutorizadaError'
  }
}

/** Valida formato de RIF/cédula (V-/E-/J- + números). */
export function validarRifCi(valor: string): boolean {
  return RIF_CI_RE.test(valor.trim())
}

/** Cédula de representante legal: V-/E- + números. */
export function validarCedula(valor: string): boolean {
  return /^[VE]-\d{6,10}$/.test(valor.trim())
}

export function validarEmail(valor: string): boolean {
  return EMAIL_RE.test(valor.trim())
}

export interface RepresentanteInput {
  id?: string
  nombre: string
  cedula: string
  cargo: string
  telefono: string
}

export interface ClienteCreateInput {
  nombre: string
  tipo_persona: TipoPersona
  rif_ci: string
  telefono: string
  email: string
  direccion: string
  notas: string
  limite_credito_usd: number | null
  representantes: RepresentanteInput[]
}

function validarInput(input: ClienteCreateInput): void {
  if (!input.nombre.trim()) throw new ClienteValidationError('El nombre es obligatorio')
  if (!validarRifCi(input.rif_ci)) {
    throw new ClienteValidationError('Formato de RIF/Cédula inválido (V-/E-/J- + números)')
  }
  if (input.email.trim() && !validarEmail(input.email)) {
    throw new ClienteValidationError('Email inválido')
  }
  if (input.tipo_persona === 'juridica') {
    const validos = input.representantes.filter((r) => r.nombre.trim() && r.cedula.trim())
    if (validos.length === 0) {
      throw new ClienteValidationError(
        'Un cliente persona jurídica debe tener al menos un representante legal'
      )
    }
    for (const r of validos) {
      if (!validarCedula(r.cedula)) {
        throw new ClienteValidationError(`Cédula inválida del representante "${r.nombre}"`)
      }
    }
  }
}

async function sincronizarRepresentantes(
  clienteId: string,
  representantes: RepresentanteInput[]
): Promise<void> {
  const db = await createClient()
  const repo = makeRepresentanteLegalRepository(db)
  const existentes = await repo.listByCliente(clienteId)

  const idsEnviados = new Set(
    representantes.filter((r) => r.id).map((r) => r.id as string)
  )

  for (const e of existentes) {
    if (!idsEnviados.has(e.id)) {
      await repo.delete(e.id)
    }
  }

  for (const r of representantes) {
    if (!r.nombre.trim()) continue
    if (r.id) {
      await repo.update(r.id, {
        nombre: r.nombre,
        cedula: r.cedula,
        cargo: r.cargo || null,
        telefono: r.telefono || null,
      })
    } else {
      await repo.create({
        cliente_id: clienteId,
        nombre: r.nombre,
        cedula: r.cedula,
        cargo: r.cargo || null,
        telefono: r.telefono || null,
      })
    }
  }
}

export async function crearCliente(input: ClienteCreateInput): Promise<Cliente> {
  validarInput(input)
  const db = await createClient()
  const repo = makeClienteRepository(db)

  const cliente = await repo.create({
    nombre: input.nombre.trim(),
    tipo_persona: input.tipo_persona,
    rif_ci: input.rif_ci.trim(),
    telefono: input.telefono.trim() || null,
    email: input.email.trim() || null,
    direccion: input.direccion.trim() || null,
    notas: input.notas.trim() || null,
    limite_credito_usd: input.limite_credito_usd,
  })

  await sincronizarRepresentantes(cliente.id, input.representantes)
  return cliente
}

export async function actualizarCliente(
  id: string,
  input: ClienteCreateInput
): Promise<Cliente> {
  validarInput(input)
  const db = await createClient()
  const repo = makeClienteRepository(db)

  const cliente = await repo.update(id, {
    nombre: input.nombre.trim(),
    tipo_persona: input.tipo_persona,
    rif_ci: input.rif_ci.trim(),
    telefono: input.telefono.trim() || null,
    email: input.email.trim() || null,
    direccion: input.direccion.trim() || null,
    notas: input.notas.trim() || null,
    limite_credito_usd: input.limite_credito_usd,
  })

  await sincronizarRepresentantes(id, input.representantes)
  return cliente
}

export async function desactivar(id: string): Promise<Cliente> {
  const db = await createClient()
  return makeClienteRepository(db).update(id, { activo: false })
}

export async function activar(id: string): Promise<Cliente> {
  const db = await createClient()
  return makeClienteRepository(db).update(id, { activo: true })
}

export async function bloquear(id: string, motivo: string): Promise<Cliente> {
  if ((await getRol()) !== 'admin') throw new AccionNoAutorizadaError()

  const motivoLimpio = motivo.trim()
  if (!motivoLimpio) {
    throw new ClienteValidationError('El motivo de bloqueo es obligatorio')
  }

  const db = await createClient()
  return makeClienteRepository(db).update(id, {
    bloqueado: true,
    motivo_bloqueo: motivoLimpio,
  })
}

export async function desbloquear(id: string): Promise<Cliente> {
  if ((await getRol()) !== 'admin') throw new AccionNoAutorizadaError()

  const db = await createClient()
  return makeClienteRepository(db).update(id, {
    bloqueado: false,
    motivo_bloqueo: null,
  })
}

/**
 * Un cliente jurídico debe tener al menos un representante legal.
 * Lanza error si no lo tiene.
 */
export async function validarRepresentantes(clienteId: string): Promise<void> {
  const db = await createClient()
  const cliente = await makeClienteRepository(db).getById(clienteId)
  if (!cliente || cliente.tipo_persona !== 'juridica') return

  const representantes = await makeRepresentanteLegalRepository(db).listByCliente(
    clienteId
  )
  if (representantes.length === 0) {
    throw new ClienteValidationError(
      'Un cliente persona jurídica debe tener al menos un representante legal'
    )
  }
}

/**
 * Saldo pendiente del cliente. La lógica real vive en 05-ventas
 * (ClienteBalanceService); este módulo la consume. Devuelve null hasta
 * que ese servicio exista — la UI muestra "—".
 */
export async function getSaldoPendiente(clienteId: string): Promise<number | null> {
  void clienteId
  return null
}
