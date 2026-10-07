'use client'

import * as React from 'react'

import AddIcon from '@mui/icons-material/Add'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ComprasTable, type CompraFila } from '@/components/organisms/ComprasTable'
import { CompraForm } from '@/components/organisms/CompraForm'
import { PagoProveedorDialog } from '@/components/organisms/PagoProveedorDialog'
import { LotesCreadosDialog } from '@/components/organisms/LotesCreadosDialog'
import type { TasaSelectorConfig } from '@/components/organisms/TasaSelector'
import type { LoteCreado, Producto, Proveedor } from '@/types/domain'

export function ComprasScreen({
  compras,
  total,
  proveedores,
  productos,
  configTasas,
  esAdmin,
}: {
  compras: CompraFila[]
  total: number
  proveedores: Proveedor[]
  productos: Producto[]
  configTasas: TasaSelectorConfig
  esAdmin: boolean
}) {
  const [nuevaAbierta, setNuevaAbierta] = React.useState(false)
  const [pagando, setPagando] = React.useState<CompraFila | null>(null)
  const [lotesCreados, setLotesCreados] = React.useState<LoteCreado[] | null>(null)
  const nombresProducto = React.useMemo(
    () => Object.fromEntries(productos.map((p) => [p.id, p.nombre])),
    [productos]
  )

  return (
    <>
      <PageHeader
        title="Compras"
        primaryAction={{
          label: 'Nueva compra',
          icon: <AddIcon />,
          onClick: () => setNuevaAbierta(true),
        }}
      />

      <ComprasTable
        compras={compras}
        total={total}
        esAdmin={esAdmin}
        onPagar={setPagando}
        onNueva={() => setNuevaAbierta(true)}
      />

      <CompraForm
        key={nuevaAbierta ? 'abierta' : 'cerrada'}
        open={nuevaAbierta}
        onClose={() => setNuevaAbierta(false)}
        proveedores={proveedores}
        productos={productos}
        configTasas={configTasas}
        onCreated={setLotesCreados}
      />

      <LotesCreadosDialog
        lotes={lotesCreados}
        nombresProducto={nombresProducto}
        subtitle="Compra registrada · rotula cada recipiente con su código"
        onClose={() => setLotesCreados(null)}
      />

      {esAdmin ? (
        <PagoProveedorDialog
          key={pagando?.id ?? 'cerrado'}
          compra={pagando}
          configTasas={configTasas}
          onClose={() => setPagando(null)}
        />
      ) : null}
    </>
  )
}