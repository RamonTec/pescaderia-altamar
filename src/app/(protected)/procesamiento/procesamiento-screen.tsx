'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import { PageHeader } from '@/components/molecules/PageHeader'
import {
  ProcesamientosTable,
  type ProcesoFila,
} from '@/components/organisms/ProcesamientosTable'
import { ProcesamientoForm, type CrudoConStock } from '@/components/organisms/ProcesamientoForm'
import type { Producto } from '@/types/domain'

export function ProcesamientoScreen({
  filas,
  crudos,
  procesados,
  esAdmin,
}: {
  filas: ProcesoFila[]
  crudos: CrudoConStock[]
  procesados: Producto[]
  esAdmin: boolean
}) {
  const [nuevoAbierto, setNuevoAbierto] = React.useState(false)

  return (
    <>
      <PageHeader title="Procesamiento">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNuevoAbierto(true)}>
          Nuevo procesamiento
        </Button>
      </PageHeader>

      <ProcesamientosTable filas={filas} esAdmin={esAdmin} onNuevo={() => setNuevoAbierto(true)} />

      <ProcesamientoForm
        key={nuevoAbierto ? 'abierto' : 'cerrado'}
        open={nuevoAbierto}
        onClose={() => setNuevoAbierto(false)}
        crudos={crudos}
        procesados={procesados}
      />
    </>
  )
}
