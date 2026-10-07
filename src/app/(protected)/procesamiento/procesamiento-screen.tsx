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
import { LotesCreadosDialog } from '@/components/organisms/LotesCreadosDialog'
import type { Lote, LoteCreado, Producto } from '@/types/domain'

export function ProcesamientoScreen({
  filas,
  crudos,
  procesados,
  lotes,
  diasAlertaLote,
  esAdmin,
}: {
  filas: ProcesoFila[]
  crudos: CrudoConStock[]
  procesados: Producto[]
  lotes: Lote[]
  diasAlertaLote: number | null
  esAdmin: boolean
}) {
  const [nuevoAbierto, setNuevoAbierto] = React.useState(false)
  const [lotesCreados, setLotesCreados] = React.useState<LoteCreado[] | null>(null)
  const nombresProducto = React.useMemo(
    () => Object.fromEntries(procesados.map((p) => [p.id, p.nombre])),
    [procesados]
  )

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
        lotes={lotes}
        diasAlertaLote={diasAlertaLote}
        onCreated={setLotesCreados}
      />

      <LotesCreadosDialog
        lotes={lotesCreados}
        nombresProducto={nombresProducto}
        subtitle="Procesamiento registrado · rotula el recipiente con su código"
        onClose={() => setLotesCreados(null)}
      />
    </>
  )
}
