import type { SupabaseClient } from '@supabase/supabase-js'
import type { IContratoArchivoRepository } from './interfaces'

/**
 * PDFs de contratos en el bucket privado `contratos` (06-contratos). Mismo
 * patrón que `documentoProveedorRepository`: solo se guarda la ruta y la URL
 * firmada se genera al vuelo. Sin `upsert`: el PDF es inmutable.
 */

const BUCKET = 'contratos'

export function makeContratoArchivoRepository(db: SupabaseClient): IContratoArchivoRepository {
  return {
    async subir(ruta, bytes) {
      const { error } = await db.storage.from(BUCKET).upload(ruta, bytes, {
        contentType: 'application/pdf',
        upsert: false,
      })
      if (error) throw error
    },

    async eliminar(ruta) {
      const { error } = await db.storage.from(BUCKET).remove([ruta])
      if (error) throw error
    },

    async urlFirmada(ruta, ttlSegundos, nombreDescarga) {
      const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(ruta, ttlSegundos, nombreDescarga ? { download: nombreDescarga } : undefined)
      if (error) throw error
      return data.signedUrl
    },
  }
}
