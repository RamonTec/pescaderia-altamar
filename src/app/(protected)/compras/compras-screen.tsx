'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ComprasTable, type CompraFila } from '@/components/organisms/ComprasTable'
import { CompraForm } from '@/components/organisms/CompraForm'
import { PagoProveedorDialog } from '@/components/organisms/PagoProveedorDialog'
import type { TasaSugerida } from '@/lib/services/compraService'
import type { Producto, Proveedor } from '@/types/domain'

export function ComprasScreen({
  compras,
  proveedores,
  productos,
  tasaSugerida,
  esAdmin,
}: {
  compras: CompraFila[]
  proveedores: Proveedor[]
  productos: Producto[]
  tasaSugerida: TasaSugerida | null
  esAdmin: boolean
}) {
  const [nuevaAbierta, setNuevaAbierta] = React.useState(false)
  const [pagando, setPagando] = React.useState<CompraFila | null>(null)

  return (
    <>
      <PageHeader title="Compras">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNuevaAbierta(true)}>
          Nueva compra
        </Button>
      </PageHeader>

      <ComprasTable
        compras={compras}
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
        tasaSugerida={tasaSugerida}
      />

      {esAdmin ? (
        <PagoProveedorDialog
          key={pagando?.id ?? 'cerrado'}
          compra={pagando}
          tasaDelDia={tasaSugerida?.bs_por_usd ?? null}
          onClose={() => setPagando(null)}
        />
      ) : null}
    </>
  )
}
