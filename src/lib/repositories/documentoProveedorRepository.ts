import type { SupabaseClient } from '@supabase/supabase-js'
import type { IDocumentoProveedorRepository } from './interfaces'
import type { DocumentoProveedor, TipoDocumentoProveedor } from '@/types/domain'
import type { DocumentoStore } from '@/lib/documentoStore'
import { createClient } from '@/lib/supabase/client'

const BUCKET = 'documentos-proveedores'
const SIGNED_URL_TTL = 3600

function buildPath(
  proveedorId: string,
  tipo: TipoDocumentoProveedor,
  file: File,
  representanteId?: string
): string {
  const ext = file.name.split('.').pop() ?? 'bin'
  const prefijo = representanteId ? `${tipo}-${representanteId}` : tipo
  return `proveedores/${proveedorId}/${prefijo}-${Date.now()}.${ext}`
}

export function makeDocumentoProveedorRepository(
  db: SupabaseClient = createClient()
): IDocumentoProveedorRepository {
  return {
    async listByProveedor(proveedorId) {
      const { data, error } = await db
        .from('documentos_proveedor')
        .select('*')
        .eq('proveedor_id', proveedorId)
        .order('created_at')
      if (error) throw error
      return data as DocumentoProveedor[]
    },
    async create(proveedorId, tipo, file, options) {
      const path = buildPath(proveedorId, tipo, file, options?.representanteId)
      const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
        upsert: true,
      })
      if (uploadError) throw uploadError

      const { data, error } = await db
        .from('documentos_proveedor')
        .insert({
          proveedor_id: proveedorId,
          tipo,
          representante_id: options?.representanteId ?? null,
          url_storage: path,
          nombre_original: file.name,
          mime_type: file.type,
          tamano_bytes: file.size,
        })
        .select()
        .single()
      if (error) throw error
      return data as DocumentoProveedor
    },
    async getUrlDescarga(id) {
      const { data, error } = await db
        .from('documentos_proveedor')
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
        .from('documentos_proveedor')
        .select('url_storage')
        .eq('id', id)
        .single()
      if (fetchError) throw fetchError

      const { error } = await db.from('documentos_proveedor').delete().eq('id', id)
      if (error) throw error

      if (data?.url_storage) {
        await db.storage.from(BUCKET).remove([data.url_storage])
      }
    },
  }
}

export const documentoProveedorRepository = makeDocumentoProveedorRepository()

/**
 * Adaptador `DocumentoStore` para proveedores, con metadatos del archivo.
 * `representanteId` se pasa en el meta solo para la cédula de un representante.
 */
export function makeProveedorDocumentoStore(
  proveedorId: string,
  representanteId?: string,
  db: SupabaseClient = createClient()
): DocumentoStore<TipoDocumentoProveedor> {
  const repo = makeDocumentoProveedorRepository(db)
  return {
    async list() {
      const docs = await repo.listByProveedor(proveedorId)
      return docs.map((d) => ({
        id: d.id,
        tipo: d.tipo,
        url_storage: d.url_storage,
        nombre_original: d.nombre_original,
        mime_type: d.mime_type,
        tamano_bytes: d.tamano_bytes,
      }))
    },
    async upload(file, meta) {
      const doc = await repo.create(proveedorId, meta.tipo, file, {
        representanteId: meta.representanteId,
      })
      return {
        id: doc.id,
        tipo: doc.tipo,
        url_storage: doc.url_storage,
        nombre_original: doc.nombre_original,
        mime_type: doc.mime_type,
        tamano_bytes: doc.tamano_bytes,
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
