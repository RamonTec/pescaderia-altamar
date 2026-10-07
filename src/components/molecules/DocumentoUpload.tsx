'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'
import Fade from '@mui/material/Fade'
import LinearProgress from '@mui/material/LinearProgress'
import CloudUploadIcon from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import type { DocumentoStore, DocumentoItem } from '@/lib/documentoStore'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface DocumentoUploadProps<TTipo extends string = string> {
  store: DocumentoStore<TTipo>
  tipo: TTipo
  label: string
  accept?: string
  representanteId?: string
}

const MAX_BYTES = 5 * 1024 * 1024
const LADO_MAYOR = 1600
const CALIDAD_JPEG = 0.8
const TIPOS_IMAGEN: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function esImagen(file: File): boolean {
  return file.type in TIPOS_IMAGEN
}

/** Compresión en el cliente con canvas: lado mayor 1600px, JPEG 0.8. Sin dependencias. */
async function comprimirImagen(file: File): Promise<File> {
  if (!esImagen(file)) return file

  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, LADO_MAYOR / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  ctx.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG)
  )
  if (!blob || blob.size >= file.size) return file

  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {
    type: 'image/jpeg',
  })
}

function nombreArchivo(item: DocumentoItem): string {
  return item.nombre_original ?? item.url_storage.split('/').pop() ?? 'documento'
}

/**
 * Subir/ver/reemplazar un documento (cédula/RIF/acta). Desacoplado del
 * repositorio concreto vía `DocumentoStore`. Soporta arrastrar y soltar,
 * validación de tipo/tamaño antes de subir, compresión de fotos en el cliente,
 * miniatura/ícono, y reemplazo real (sube el nuevo y luego borra el anterior).
 */
export function DocumentoUpload<TTipo extends string = string>({
  store,
  tipo,
  label,
  accept,
  representanteId,
}: DocumentoUploadProps<TTipo>) {
  const notify = useNotify()
  const confirm = useConfirm()

  const [docs, setDocs] = React.useState<DocumentoItem<TTipo>[]>([])
  const [urls, setUrls] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    const list = await store.list()
    const propios = list.filter((d) => d.tipo === tipo)
    const mapa: Record<string, string> = {}
    await Promise.all(
      propios.map(async (d) => {
        const url = await store.getUrl(d.id)
        if (url) mapa[d.id] = url
      })
    )
    return { propios, mapa }
  }, [store, tipo])

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

  const validarAntesDeSubir = (file: File): string | null => {
    if (file.size > MAX_BYTES) {
      return `El archivo excede el límite de 5 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`
    }
    if (accept) {
      const permitidos = accept.split(',').map((a) => a.trim())
      const coincide = permitidos.some(
        (p) => p === file.type || (p.startsWith('.') && file.name.endsWith(p))
      )
      if (!coincide) {
        return `Tipo de archivo no permitido. Usa ${accept.replaceAll(',', ', ')}`
      }
    }
    return null
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    const error = validarAntesDeSubir(file)
    if (error) {
      notify.error(error)
      return
    }

    setUploading(true)
    try {
      const comprimido = await comprimirImagen(file)
      const nuevo = await store.upload(comprimido, { tipo, representanteId })

      // Reemplazo real: se sube el nuevo y luego se borra el anterior.
      for (const d of docs) {
        if (d.id !== nuevo.id) {
          await store.remove(d.id).catch(() => {})
        }
      }

      notify.success(`Documento "${label}" subido`)
      const { propios, mapa } = await load()
      setDocs(propios)
      setUrls(mapa)
    } catch {
      notify.error('No se pudo subir el documento')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      setDragOver(false)
    }
  }

  const handleDelete = async (doc: DocumentoItem<TTipo>) => {
    const ok = await confirm({
      title: 'Eliminar documento',
      message: `¿Eliminar este documento de ${label}?`,
      confirmLabel: 'Eliminar',
      destructive: true,
    })
    if (!ok) return
    try {
      await store.remove(doc.id)
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
          accept={accept}
          capture="environment"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </Box>

      {uploading ? <LinearProgress /> : null}

      <Box
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          handleFile(e.dataTransfer.files?.[0] ?? null)
        }}
        sx={{
          border: '1px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 2,
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          transition: (t) => t.transitions.create(['border-color', 'background-color']),
        }}
      >
        {loading ? (
          <Skeleton variant="rounded" height={56} sx={{ m: 1 }} />
        ) : docs.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
            Sin documentos. Arrastra y suelta un archivo aquí o usa &quot;Subir&quot;.
          </Typography>
        ) : (
          <Fade in timeout={200}>
            <Box sx={{ display: 'grid', gap: 1, p: 1 }}>
              {docs.map((doc) => (
                <Box
                  key={doc.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    px: 1.5,
                    py: 0.75,
                  }}
                >
                  {esImagenDoc(doc) && urls[doc.id] ? (
                    <Box
                      component="img"
                      src={urls[doc.id]}
                      alt={nombreArchivo(doc)}
                      sx={{
                        width: 40,
                        height: 40,
                        objectFit: 'cover',
                        borderRadius: 1,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'text.secondary',
                        flexShrink: 0,
                      }}
                    >
                      <PictureAsPdfOutlinedIcon />
                    </Box>
                  )}
                  <Typography
                    variant="body2"
                    sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {nombreArchivo(doc)}
                  </Typography>
                  {urls[doc.id] ? (
                    <Link href={urls[doc.id]} target="_blank" rel="noreferrer" variant="body2">
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
              ))}
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  )
}

function esImagenDoc(doc: DocumentoItem): boolean {
  return doc.mime_type != null && doc.mime_type in TIPOS_IMAGEN
}
