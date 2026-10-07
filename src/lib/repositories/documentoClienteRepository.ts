import type { SupabaseClient } from '@supabase/supabase-js'
import type { IDocumentoClienteRepository } from './interfaces'
import type { DocumentoCliente, TipoDocumentoCliente } from '@/types/domain'
import type { DocumentoStore } from '@/lib/documentoStore'
import { createClient } from '@/lib/supabase/client'

const BUCKET = 'documentos-clientes'
const SIGNED_URL_TTL = 3600

function buildPath(clienteId: string, tipo: TipoDocumentoCliente, file: File): string {
  const ext = file.name.split('.').pop() ?? 'bin'
  return `clientes/${clienteId}/${tipo}-${Date.now()}.${ext}`
}

/**
 * Adaptador `DocumentoStore` para el módulo de clientes. Permite que el
 * componente genérico `DocumentoUpload` trabaje con documentos de cliente
 * sin conocer el repositorio concreto.
 */
export function makeClienteDocumentoStore(
  clienteId: string,
  db: SupabaseClient = createClient()
): DocumentoStore<TipoDocumentoCliente> {
  const repo = makeDocumentoClienteRepository(db)
  return {
    async list() {
      const docs = await repo.listByCliente(clienteId)
      return docs.map((d) => ({
        id: d.id,
        tipo: d.tipo,
        url_storage: d.url_storage,
        nombre_original: null,
        mime_type: null,
        tamano_bytes: null,
      }))
    },
    async upload(file, meta) {
      const doc = await repo.create(clienteId, meta.tipo, file)
      return {
        id: doc.id,
        tipo: doc.tipo,
        url_storage: doc.url_storage,
        nombre_original: file.name,
        mime_type: file.type,
        tamano_bytes: file.size,
      }
    },
    async getUrl(id) {
      return repo.getUrlDescarga(id)
    },
    async remove(id) {
      await repo.delete(id)
    },
  }
}

export function makeDocumentoClienteRepository(
  db: SupabaseClient = createClient()
): IDocumentoClienteRepository {
  return {
    async listByCliente(clienteId) {
      const { data, error } = await db
        .from('documentos_cliente')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at')
      if (error) throw error
      return data as DocumentoCliente[]
    },
    async create(clienteId, tipo, file) {
      const path = buildPath(clienteId, tipo, file)
      const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
        upsert: true,
      })
      if (uploadError) throw uploadError

      const { data, error } = await db
        .from('documentos_cliente')
        .insert({ cliente_id: clienteId, tipo, url_storage: path })
        .select()
        .single()
      if (error) throw error
      return data as DocumentoCliente
    },
    async getUrlDescarga(id) {
      const { data, error } = await db
        .from('documentos_cliente')
        .select('url_storage')
        .eq('id', id)
        .single()
      if (error) return null

      const { data: signed, error: signError } = await db.storage
        .from(BUCKET)
        .createSignedUrl(data.url_storage, SIGNED_URL_TTL)
      if (signError) return null
      return signed.signedUrl
    },
    async delete(id) {
      const { data, error: fetchError } = await db
        .from('documentos_cliente')
        .select('url_storage')
        .eq('id', id)
        .single()
      if (fetchError) throw fetchError

      const { error } = await db.from('documentos_cliente').delete().eq('id', id)
      if (error) throw error

      if (data?.url_storage) {
        await db.storage.from(BUCKET).remove([data.url_storage])
      }
    },
  }
}

export const documentoClienteRepository = makeDocumentoClienteRepository()
