'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'
import { DocumentoUpload } from './DocumentoUpload'
import type { TipoDocumentoProveedor } from '@/types/domain'
import type { DocumentoStore } from '@/lib/documentoStore'

export interface DocumentosRequeridosProps {
  tipoPersona: 'natural' | 'juridica'
  representantes: { id: string; nombre: string; cedula: string }[]
  makeStore: (representanteId?: string) => DocumentoStore<TipoDocumentoProveedor>
  /** Set de tipos de documento ya presentes (para marcar ✓/⚠). */
  tiposPresentes: Set<TipoDocumentoProveedor>
  representanteConCedula: Set<string>
  /** Bloquea subir/reemplazar/eliminar mientras el formulario dueño guarda. */
  disabled?: boolean
}

const LABEL_TIPO: Record<TipoDocumentoProveedor, string> = {
  cedula: 'Cédula',
  rif: 'RIF',
  acta_constitutiva: 'Acta constitutiva',
  otro: 'Otro',
}

interface Item {
  key: string
  tipo: TipoDocumentoProveedor
  label: string
  representanteId?: string
  presente: boolean
}

export function DocumentosRequeridos({
  tipoPersona,
  representantes,
  makeStore,
  tiposPresentes,
  representanteConCedula,
  disabled = false,
}: DocumentosRequeridosProps) {
  const items: Item[] = []

  if (tipoPersona === 'natural') {
    items.push(
      { key: 'cedula', tipo: 'cedula', label: 'Cédula', presente: tiposPresentes.has('cedula') },
      { key: 'rif', tipo: 'rif', label: 'RIF', presente: tiposPresentes.has('rif') }
    )
  } else {
    items.push({ key: 'rif', tipo: 'rif', label: 'RIF', presente: tiposPresentes.has('rif') })
    items.push({
      key: 'acta',
      tipo: 'acta_constitutiva',
      label: 'Acta constitutiva',
      presente: tiposPresentes.has('acta_constitutiva'),
    })
    representantes.forEach((r) => {
      items.push({
        key: `cedula-${r.id}`,
        tipo: 'cedula',
        label: `Cédula de ${r.nombre}`,
        representanteId: r.id,
        presente: representanteConCedula.has(r.id),
      })
    })
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {items.map((item) => (
          <Box key={item.key} sx={{ display: 'grid', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {item.presente ? (
                <CheckCircleOutlinedIcon color="success" fontSize="small" />
              ) : (
                <ErrorOutlineOutlinedIcon color="warning" fontSize="small" />
              )}
              <Typography variant="subtitle2">{item.label}</Typography>
            </Box>
            <DocumentoUpload
              store={makeStore(item.representanteId)}
              tipo={item.tipo}
              label={LABEL_TIPO[item.tipo]}
              representanteId={item.representanteId}
              disabled={disabled}
              accept="image/jpeg,image/png,image/webp,application/pdf"
            />
          </Box>
        ))}
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Typography variant="h6">Otros documentos</Typography>
          <DocumentoUpload
            store={makeStore()}
            tipo="otro"
            label="Otro documento"
            disabled={disabled}
            accept="image/jpeg,image/png,image/webp,application/pdf"
          />
        </Grid>
      </Grid>
    </Box>
  )
}
