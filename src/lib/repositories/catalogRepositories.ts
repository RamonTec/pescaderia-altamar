import type { SupabaseClient } from '@supabase/supabase-js'
import type { IClienteRepository, IProductoRepository } from './interfaces'
import type { Cliente, Producto } from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase de los repositorios (LSP: sustituibles
 * por mocks u otra fuente sin cambiar los servicios).
 *
 * El repositorio de proveedores vive en `proveedorRepository.ts`; este
 * archivo solo lo re-exporta para no romper imports existentes.
 */

function makeProductoRepository(
  db: SupabaseClient = createClient()
): IProductoRepository {
  return {
    async list() {
      const { data, error } = await db.from('productos').select('*').order('nombre')
      if (error) throw error
      return data as Producto[]
    },
    async getById(id) {
      const { data, error } = await db.from('productos').select('*').eq('id', id).single()
      if (error) throw error
      return data as Producto
    },
    async create(input) {
      const { data, error } = await db.from('productos').insert(input).select().single()
      if (error) throw error
      return data as Producto
    },
    async update(id, input) {
      const { data, error } = await db.from('productos').update(input).eq('id', id).select().single()
      if (error) throw error
      return data as Producto
    },
    async delete(id) {
      const { error } = await db.from('productos').delete().eq('id', id)
      if (error) throw error
    },
  }
}

function makeClienteRepository(db: SupabaseClient = createClient()): IClienteRepository {
  return {
    async list() {
      const { data, error } = await db.from('clientes').select('*').order('nombre')
      if (error) throw error
      return data as Cliente[]
    },
    async getById(id) {
      const { data, error } = await db.from('clientes').select('*').eq('id', id).single()
      if (error) throw error
      return data as Cliente
    },
    async create(input) {
      const { data, error } = await db.from('clientes').insert(input).select().single()
      if (error) throw error
      return data as Cliente
    },
    async update(id, input) {
      const { data, error } = await db.from('clientes').update(input).eq('id', id).select().single()
      if (error) throw error
      return data as Cliente
    },
    async delete(id) {
      const { error } = await db.from('clientes').delete().eq('id', id)
      if (error) throw error
    },
  }
}

export const productoRepository = makeProductoRepository()
export const clienteRepository = makeClienteRepository()

export { makeProductoRepository, makeClienteRepository }

export { makeProveedorRepository, proveedorRepository } from './proveedorRepository'
