'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import { PageHeader } from '@/components/molecules/PageHeader'
import { ProveedoresTable } from '@/components/organisms/ProveedoresTable'
import type { ProveedorResumen } from '@/lib/repositories/interfaces'
import type { DatosEdicionProveedor } from './useProveedorAcciones'
import { useProveedorAcciones } from './useProveedorAcciones'

/** Representantes y documentos que el listado ya trajo del servidor. */
function datosEdicionDe(p: ProveedorResumen): DatosEdicionProveedor {
  return {
    representantes: p.representantes_proveedor.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      cedula: r.cedula,
    })),
    tiposDocumento: new Set(p.documentos_proveedor.map((d) => d.tipo)),
    representanteConCedula: new Set(
      p.documentos_proveedor.filter((d) => d.representante_id).map((d) => d.representante_id!)
    ),
  }
}

export function ProveedoresScreen({
  proveedores,
  esAdmin,
  saldos,
}: {
  proveedores: ProveedorResumen[]
  esAdmin: boolean
  /** Saldo pendiente real por id de proveedor (04-inventario); sin entrada = $0. */
  saldos: Record<string, number>
}) {
  const { acciones, dialogos, estaPendiente } = useProveedorAcciones()

  return (
    <>
      <PageHeader
        title="Proveedores"
        primaryAction={{
          label: 'Nuevo proveedor',
          icon: <AddOutlinedIcon />,
          onClick: acciones.nuevo,
        }}
      />

      {/* xs: espacio para que el Fab "Nuevo proveedor" no tape la última tarjeta. */}
      <Box sx={{ pb: { xs: 10, sm: 0 } }}>
        <ProveedoresTable
          proveedores={proveedores}
          saldos={saldos}
          esAdmin={esAdmin}
          estaPendiente={estaPendiente}
          onNuevo={acciones.nuevo}
          onEdit={(p) => acciones.editar(p, 0, datosEdicionDe(p))}
          onBloquear={acciones.bloquear}
          onDesbloquear={acciones.desbloquear}
          onDesactivar={acciones.desactivar}
          onActivar={acciones.activar}
        />
      </Box>

      {dialogos}
    </>
  )
}