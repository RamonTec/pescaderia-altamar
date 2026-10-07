'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import type { DocumentoCliente, TipoDocumentoCliente } from '@/types/domain'
import { documentoClienteRepository } from '@/lib/repositories/documentoClienteRepository'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface DocumentoUploadProps {
  clienteId: string
  tipo: TipoDocumentoCliente
  label: string
}

const TIPO_LABEL: Record<TipoDocumentoCliente, string> = {
  cedula: 'Cédula',
  rif: 'RIF',
  otro: 'Otro',
}

/**
 * Subir/ver/reemplazar un documento (cédula/RIF) de un cliente.
 * Solo guarda la ruta en Storage; para ver/descargar genera signed URL.
 */
export function DocumentoUpload({ clienteId, tipo, label }: DocumentoUploadProps) {
  const notify = useNotify()
  const confirm = useConfirm()

  const [docs, setDocs] = React.useState<DocumentoCliente[]>([])
  const [urls, setUrls] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    const list = await documentoClienteRepository.listByCliente(clienteId)
    const propios = list.filter((d) => d.tipo === tipo)
    const mapa: Record<string, string> = {}
    await Promise.all(
      propios.map(async (d) => {
        const url = await documentoClienteRepository.getUrlDescarga(d.id)
        if (url) mapa[d.id] = url
      })
    )
    return { propios, mapa }
  }, [clienteId, tipo])

  React.useEffect(() => {
    let active = true
    load()
      .then(({ propios, mapa }) => {
        if (!active) return
        setDocs(propios)
        setUrls(mapa)
      })
      .catch(() => {
        if (active) notify.error('No se pudieron cargar los documentos')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [load, notify])

  const handleFile = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      await documentoClienteRepository.create(clienteId, tipo, file)
      notify.success(`Documento "${label}" subido`)
      const { propios, mapa } = await load()
      setDocs(propios)
      setUrls(mapa)
    } catch {
      notify.error('No se pudo subir el documento')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleDelete = async (doc: DocumentoCliente) => {
    const ok = await confirm({
      title: 'Eliminar documento',
      message: `¿Eliminar este documento de ${label}?`,
      confirmLabel: 'Eliminar',
      destructive: true,
    })
    if (!ok) return
    try {
      await documentoClienteRepository.delete(doc.id)
      notify.success('Documento eliminado')
      const { propios, mapa } = await load()
      setDocs(propios)
      setUrls(mapa)
    } catch {
      notify.error('No se pudo eliminar el documento')
    }
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {label}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={
            uploading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />
          }
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {docs.length > 0 ? 'Reemplazar' : 'Subir'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </Box>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Cargando…
        </Typography>
      ) : docs.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Sin documentos de {TIPO_LABEL[tipo]}.
        </Typography>
      ) : (
        docs.map((doc) => (
          <Box
            key={doc.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              px: 1.5,
              py: 0.5,
            }}
          >
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              {doc.url_storage.split('/').pop()}
            </Typography>
            {urls[doc.id] ? (
              <Link
                href={urls[doc.id]}
                target="_blank"
                rel="noreferrer"
                variant="body2"
              >
                Ver
              </Link>
            ) : null}
            <IconButton
              aria-label="Eliminar documento"
              color="error"
              size="small"
              onClick={() => handleDelete(doc)}
            >
              <DeleteOutlinedIcon />
            </IconButton>
          </Box>
        ))
      )}
    </Box>
  )
}
