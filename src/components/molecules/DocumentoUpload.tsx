'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Fade from '@mui/material/Fade'
import LinearProgress from '@mui/material/LinearProgress'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { RowActionsMenu } from '@/components/molecules/RowActionsMenu'
import type { DocumentoStore, DocumentoItem } from '@/lib/documentoStore'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

export interface DocumentoUploadProps<TTipo extends string = string> {
  store: DocumentoStore<TTipo>
  tipo: TTipo
  label: string
  accept?: string
  representanteId?: string
  /** Estado junto a la etiqueta (`EstadoChip` "Falta"). */
  estado?: React.ReactNode
  /**
   * Deshabilita subir, reemplazar, eliminar y soltar archivos (p. ej.
   * mientras el formulario dueño guarda). "Ver" sigue funcionando.
   */
  disabled?: boolean
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
 * repositorio concreto vía `DocumentoStore`. Cada documento cargado es una
 * fila (ícono, nombre, tamaño, "Ver" y `⋮` con "Reemplazar" y "Eliminar"),
 * sin cajas anidadas ni papelera suelta; la zona para soltar archivos solo
 * aparece si no hay archivo. Soporta arrastrar y soltar,
 * validación de tipo/tamaño antes de subir, compresión de fotos en el cliente,
 * miniatura/ícono, y reemplazo real (sube el nuevo y luego borra el anterior).
 */
export function DocumentoUpload<TTipo extends string = string>({
  store,
  tipo,
  label,
  accept,
  representanteId,
  estado,
  disabled = false,
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

  const bloqueado = disabled || uploading

  const handleFile = async (file: File | null) => {
    if (!file || bloqueado) return
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
    if (bloqueado) return
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

  const elegirArchivo = () => inputRef.current?.click()

  return (
    <Box sx={{ display: 'grid', gap: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography variant="label" component="div">
          {label}
        </Typography>
        {estado}
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture="environment"
        hidden
        disabled={bloqueado}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {uploading ? <LinearProgress aria-label={`Subiendo ${label}`} /> : null}

      {loading ? (
        <Skeleton variant="rounded" height={48} />
      ) : docs.length === 0 ? (
        // La zona para soltar solo aparece cuando no hay archivo.
        <Box
          onDragOver={(e) => {
            e.preventDefault()
            if (!bloqueado) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            handleFile(e.dataTransfer.files?.[0] ?? null)
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
            px: 2,
            py: 1.5,
            border: '1px dashed',
            borderColor: dragOver && !bloqueado ? 'text.primary' : 'divider',
            borderRadius: '6px',
            bgcolor: dragOver && !bloqueado ? 'background.subtle' : 'transparent',
            transition: (t) => t.transitions.create(['border-color', 'background-color']),
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
            Arrastra un archivo aquí o
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CloudUploadOutlinedIcon />}
            loading={uploading}
            loadingPosition="start"
            disabled={disabled}
            onClick={elegirArchivo}
          >
            Subir
          </Button>
        </Box>
      ) : (
        <Fade in timeout={200}>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid' }}>
            {docs.map((doc) => (
              <Box
                component="li"
                key={doc.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 48, minWidth: 0 }}
              >
                {esImagenDoc(doc) && urls[doc.id] ? (
                  <Box
                    component="img"
                    src={urls[doc.id]}
                    alt=""
                    sx={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                  />
                ) : (
                  <PictureAsPdfOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
                )}
                <Box sx={{ minWidth: 0, flexGrow: 1, display: 'grid' }}>
                  <Typography variant="body2" noWrap>
                    {nombreArchivo(doc)}
                  </Typography>
                  {doc.tamano_bytes ? (
                    <Typography variant="caption" color="text.secondary">
                      {tamanoLegible(doc.tamano_bytes)}
                    </Typography>
                  ) : null}
                </Box>
                {urls[doc.id] ? (
                  <Button
                    size="small"
                    variant="text"
                    component="a"
                    href={urls[doc.id]}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver
                  </Button>
                ) : null}
                <RowActionsMenu
                  label={`documento de ${label}`}
                  pending={uploading}
                  actions={[
                    { label: 'Reemplazar', onClick: elegirArchivo, disabled: bloqueado },
                    {
                      label: 'Eliminar',
                      onClick: () => void handleDelete(doc),
                      destructive: true,
                      disabled: bloqueado,
                    },
                  ]}
                />
              </Box>
            ))}
          </Box>
        </Fade>
      )}
    </Box>
  )
}

function tamanoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function esImagenDoc(doc: DocumentoItem): boolean {
  return doc.mime_type != null && doc.mime_type in TIPOS_IMAGEN
}
