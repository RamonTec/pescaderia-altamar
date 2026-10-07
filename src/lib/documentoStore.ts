import type { TipoDocumentoCliente, TipoDocumentoProveedor } from '@/types/domain'

/**
 * Contrato genérico de persistencia de documentos para el componente
 * `DocumentoUpload`. Desacopla el upload de un repositorio concreto
 * (clientes o proveedores), de modo que el mismo componente sirva a ambos.
 */
export interface DocumentoItem<TTipo extends string = string> {
  id: string
  tipo: TTipo
  url_storage: string
  nombre_original: string | null
  mime_type: string | null
  tamano_bytes: number | null
}

export interface DocumentoUploadMeta<TTipo extends string = string> {
  tipo: TTipo
  /** Se llena solo cuando el documento es la cédula de un representante. */
  representanteId?: string
}

export interface DocumentoStore<TTipo extends string = string> {
  list(): Promise<DocumentoItem<TTipo>[]>
  upload(file: File, meta: DocumentoUploadMeta<TTipo>): Promise<DocumentoItem<TTipo>>
  getUrl(id: string): Promise<string | null>
  remove(id: string): Promise<void>
}

export type TipoDocumento = TipoDocumentoCliente | TipoDocumentoProveedor
