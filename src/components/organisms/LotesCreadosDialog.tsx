'use client'

import * as React from 'react'
import Link from 'next/link'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { AppDialog } from '@/components/organisms/AppDialog'
import { CopyableText } from '@/components/molecules/CopyableText'
import { formatKg } from '@/lib/format'
import type { LoteCreado } from '@/types/domain'

export interface LotesCreadosDialogProps {
  /** Lotes recién creados; `null` cierra el diálogo. */
  lotes: LoteCreado[] | null
  /** Nombre de cada producto por id. */
  nombresProducto: Record<string, string>
  onClose: () => void
  /** "Compra registrada" / "Procesamiento registrado". */
  subtitle?: string
}

/**
 * Códigos de los lotes que acaba de crear una compra o un procesamiento
 * (07-lotes), grandes y con botón copiar, para rotular cada recipiente de
 * la cava. Cada código enlaza a la ficha del lote.
 */
export function LotesCreadosDialog({
  lotes,
  nombresProducto,
  onClose,
  subtitle,
}: LotesCreadosDialogProps) {
  const open = lotes != null
  const lista = lotes ?? []
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="sm"
      title={lista.length === 1 ? 'Lote creado' : 'Lotes creados'}
      subtitle={subtitle ?? 'Rotula cada recipiente con su código'}
      cancelLabel={null}
      autoFocusFirstField={false}
      primaryAction={
        <Button variant="contained" onClick={onClose}>
          Listo
        </Button>
      }
    >
      {lista.length === 0 ? (
        <Alert severity="info">
          Ningún producto de esta operación controla stock: no se crearon lotes.
        </Alert>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
          {lista.map((l) => (
            <Box
              component="li"
              key={l.lote_id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                px: 2,
                py: 1.5,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                columnGap: 2,
                rowGap: 0.5,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" noWrap>
                  {nombresProducto[l.producto_id] ?? 'Producto'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatKg(l.peso_kg)} ·{' '}
                  <Box
                    component={Link}
                    href={`/inventario/lotes/${l.lote_id}`}
                    onClick={onClose}
                    sx={{ color: 'primary.main' }}
                  >
                    Ver lote
                  </Box>
                </Typography>
              </Box>
              <CopyableText
                value={l.codigo}
                variant="h5"
                copiedMessage={`Código ${l.codigo} copiado`}
              />
            </Box>
          ))}
        </Box>
      )}
    </AppDialog>
  )
}
