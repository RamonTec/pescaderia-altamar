'use client'

import * as React from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import { useTheme } from '@mui/material/styles'
import { MetodoPagoCard } from './MetodoPagoCard'
import type { ProveedorFormValues, MetodoPagoFormValues } from '@/lib/proveedorValidation'

function vacio(tipo: MetodoPagoFormValues['tipo']): MetodoPagoFormValues {
  const base = {
    id: undefined,
    preferido: false,
    banco_codigo: '',
    numero_cuenta: '',
    tipo_cuenta: null as 'corriente' | 'ahorro' | null,
    telefono: '',
    email: '',
    titular: '',
    titular_rif_ci: '',
  }
  return { ...base, tipo } as MetodoPagoFormValues
}

/**
 * Lista de métodos de pago del proveedor como tarjetas. Botón "Agregar método"
 * abre un menú de 3 opciones; cada tarjeta entra/sale con Collapse.
 */
export function MetodosPagoFieldArray() {
  const { control } = useFormContext<ProveedorFormValues>()
  const theme = useTheme()
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metodosPago',
  })

  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null)

  const handleAdd = (tipo: MetodoPagoFormValues['tipo']) => {
    append(vacio(tipo))
    setAnchor(null)
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Métodos de pago</Typography>
        <Button
          size="small"
          startIcon={<AddOutlinedIcon />}
          onClick={(e) => setAnchor(e.currentTarget)}
        >
          Agregar método
        </Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          <MenuItem onClick={() => handleAdd('transferencia')}>Transferencia</MenuItem>
          <MenuItem onClick={() => handleAdd('pago_movil')}>Pago Móvil</MenuItem>
          <MenuItem onClick={() => handleAdd('zelle')}>Zelle</MenuItem>
        </Menu>
      </Box>

      {fields.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Sin métodos de pago. No es obligatorio agregar uno.
        </Typography>
      ) : (
        fields.map((field, index) => (
          <Collapse key={field.id} in timeout={theme.transitions.duration.standard}>
            <MetodoPagoCard
              index={index}
              metodo={field as unknown as MetodoPagoFormValues}
              onRemove={() => remove(index)}
            />
          </Collapse>
        ))
      )}
    </Box>
  )
}
