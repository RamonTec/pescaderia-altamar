'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import { EstadoChip } from '@/components/atoms/EstadoChip'
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

interface Item {
  key: string
  tipo: TipoDocumentoProveedor
  label: string
  representanteId?: string
  presente: boolean
}

/**
 * Documentos que pide la ficha según el tipo de persona: una lista de
 * `DocumentoUpload` sin cajas anidadas. Solo el que falta lleva estado
 * (`EstadoChip` `warning` "Falta"): el cargado no necesita chip.
 */
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

  const accept = 'image/jpeg,image/png,image/webp,application/pdf'

  return (
    <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
      {items.map((item) => (
        <DocumentoUpload
          key={item.key}
          store={makeStore(item.representanteId)}
          tipo={item.tipo}
          label={item.label}
          representanteId={item.representanteId}
          estado={item.presente ? null : <EstadoChip tono="warning" label="Falta" />}
          disabled={disabled}
          accept={accept}
        />
      ))}
      <DocumentoUpload
        store={makeStore()}
        tipo="otro"
        label="Otros documentos"
        disabled={disabled}
        accept={accept}
      />
    </Box>
  )
}
