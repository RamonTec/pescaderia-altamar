'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Fade from '@mui/material/Fade'
import type { GridColDef } from '@mui/x-data-grid'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import { CopyableText } from '@/components/molecules/CopyableText'
import { CreditoResumen } from '@/components/molecules/CreditoResumen'
import { DocumentoUpload } from '@/components/molecules/DocumentoUpload'
import { EmptyState } from '@/components/molecules/EmptyState'
import { FichaDato, FichaDatos, FichaSeccion } from '@/components/molecules/FichaSeccion'
import { FichaHeader } from '@/components/molecules/FichaHeader'
import type { RowAction } from '@/components/molecules/RowActionsMenu'
import { StatusChips } from '@/components/molecules/StatusChips'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import {
  EstadoChip,
  colEstado,
  colFecha,
  colMonto,
  type EstadoDef,
} from '@/components/organisms/appDataGridColumns'
import { makeClienteDocumentoStore } from '@/lib/repositories/documentoClienteRepository'
import { formatFecha, formatUsd } from '@/lib/format'
import type {
  Cliente,
  EstadoDoc,
  EstadoPedido,
  Factura,
  Pedido,
  RepresentanteLegal,
} from '@/types/domain'
import { useClienteAcciones } from '../useClienteAcciones'

const ESTADO_FACTURA: Record<EstadoDoc, EstadoDef> = {
  abierta: { label: 'Por cobrar', color: 'warning' },
  pagada: { label: 'Pagada', color: 'success' },
  anulada: { label: 'Anulada', color: 'default' },
}

const ESTADO_PEDIDO: Record<EstadoPedido, EstadoDef> = {
  pendiente: { label: 'Pendiente', color: 'warning' },
  entregado: { label: 'Entregado', color: 'primary' },
  facturado: { label: 'Facturado', color: 'success' },
  anulado: { label: 'Anulado', color: 'default' },
}

const COLUMNAS_FACTURAS: GridColDef<Factura>[] = [
  { field: 'numero', headerName: 'N.º', minWidth: 90, flex: 0.6 },
  colFecha<Factura>('fecha', 'Fecha', { flex: 1 }),
  colMonto<Factura>('total_usd', 'Total', { flex: 1 }),
  colEstado<Factura>('estado', 'Estado', ESTADO_FACTURA, { flex: 1 }),
]

const COLUMNAS_PEDIDOS: GridColDef<Pedido>[] = [
  colFecha<Pedido>('fecha', 'Fecha', { flex: 1 }),
  colFecha<Pedido>('fecha_entrega', 'Entrega', { flex: 1 }),
  colEstado<Pedido>('estado', 'Estado', ESTADO_PEDIDO, { flex: 1 }),
]

/**
 * Ficha del cliente. Todo llega por props desde `page.tsx` (servidor); aquí
 * solo se compone y se disparan las acciones (`useClienteAcciones`).
 */
export function ClienteFicha({
  cliente,
  saldo,
  esAdmin,
  representantes,
  facturas,
  pedidos,
}: {
  cliente: Cliente
  saldo: number | null
  esAdmin: boolean
  representantes: RepresentanteLegal[]
  facturas: Factura[]
  pedidos: Pedido[]
}) {
  const router = useRouter()
  const { acciones, dialogos, estaPendiente } = useClienteAcciones({
    onCambio: () => router.refresh(),
  })
  const pendiente = estaPendiente(cliente.id)
  const juridica = cliente.tipo_persona === 'juridica'
  const documentoStore = React.useMemo(() => makeClienteDocumentoStore(cliente.id), [cliente.id])

  const menuActions: RowAction[] = []
  if (esAdmin) {
    menuActions.push(
      cliente.bloqueado
        ? {
            label: 'Desbloquear',
            icon: <LockOpenOutlinedIcon fontSize="small" />,
            onClick: () => acciones.desbloquear(cliente),
          }
        : {
            label: 'Bloquear',
            icon: <LockOutlinedIcon fontSize="small" />,
            onClick: () => acciones.bloquear(cliente),
          }
    )
  }
  menuActions.push(
    cliente.activo
      ? {
          label: 'Desactivar',
          icon: <BlockOutlinedIcon fontSize="small" />,
          destructive: true,
          onClick: () => acciones.desactivar(cliente),
        }
      : {
          label: 'Activar',
          icon: <CheckCircleOutlinedIcon fontSize="small" />,
          onClick: () => acciones.activar(cliente),
        }
  )

  return (
    <Fade in timeout={200}>
      <Box sx={{ display: 'grid', gap: 3 }}>
        <FichaHeader
          backHref="/clientes"
          backLabel="Clientes"
          title={cliente.nombre}
          meta={
            <>
              {cliente.rif_ci ? (
                <CopyableText value={cliente.rif_ci} />
              ) : (
                <span>Sin RIF / cédula</span>
              )}
              <span>{juridica ? 'Persona jurídica' : 'Persona natural'}</span>
              <StatusChips
                bloqueado={cliente.bloqueado}
                motivoBloqueo={cliente.motivo_bloqueo}
                activo={cliente.activo}
              />
            </>
          }
          primaryAction={{
            label: 'Editar cliente',
            icon: <EditOutlinedIcon />,
            onClick: () => acciones.editar(cliente),
          }}
          menuActions={menuActions}
          pending={pendiente}
        />

        {cliente.bloqueado ? (
          <Alert
            severity="error"
            sx={{ maxWidth: '75ch' }}
            action={
              esAdmin ? (
                <Button
                  color="inherit"
                  size="small"
                  loading={pendiente}
                  onClick={() => acciones.desbloquear(cliente)}
                >
                  Desbloquear
                </Button>
              ) : undefined
            }
          >
            No se le puede vender a crédito. Motivo: {cliente.motivo_bloqueo ?? 'sin motivo registrado'}.
          </Alert>
        ) : !cliente.activo ? (
          <Alert
            severity="info"
            sx={{ maxWidth: '75ch' }}
            action={
              <Button
                color="inherit"
                size="small"
                loading={pendiente}
                onClick={() => acciones.activar(cliente)}
              >
                Activar
              </Button>
            }
          >
            Cliente inactivo: no aparece al registrar ventas.
          </Alert>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(280px, 1fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <FichaSeccion titulo="Contacto">
              <FichaDatos>
                <FichaDato label="Teléfono">
                  {cliente.telefono ? <CopyableText value={cliente.telefono} /> : null}
                </FichaDato>
                <FichaDato label="Email">
                  {cliente.email ? <CopyableText value={cliente.email} mono={false} /> : null}
                </FichaDato>
                <FichaDato label="Dirección">{cliente.direccion}</FichaDato>
                {cliente.notas ? <FichaDato label="Notas">{cliente.notas}</FichaDato> : null}
              </FichaDatos>
            </FichaSeccion>

            {juridica ? (
              <FichaSeccion titulo="Representantes legales">
                {representantes.length === 0 ? (
                  <Alert
                    severity="warning"
                    sx={{ maxWidth: '75ch' }}
                    action={
                      <Button color="inherit" size="small" onClick={() => acciones.editar(cliente)}>
                        Agregar
                      </Button>
                    }
                  >
                    Falta registrar al menos un representante legal.
                  </Alert>
                ) : (
                  <Box
                    component="ul"
                    aria-label="Representantes legales"
                    sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2 }}
                  >
                    {representantes.map((r, i) => (
                      <Box component="li" key={r.id} sx={{ display: 'grid', gap: 2 }}>
                        {i > 0 ? <Divider /> : null}
                        <FichaDatos>
                          <FichaDato label="Nombre">{r.nombre}</FichaDato>
                          <FichaDato label="Cédula">{r.cedula}</FichaDato>
                          <FichaDato label="Cargo">{r.cargo}</FichaDato>
                          <FichaDato label="Teléfono">{r.telefono}</FichaDato>
                        </FichaDatos>
                      </Box>
                    ))}
                  </Box>
                )}
              </FichaSeccion>
            ) : null}

            <FichaSeccion titulo="Facturas">
              {facturas.length === 0 ? (
                <EmptyState
                  compact
                  icon={<ReceiptLongOutlinedIcon />}
                  title="Aún no hay facturas para este cliente"
                />
              ) : (
                <AppDataGrid<Factura>
                  tableId="cliente-facturas"
                  label="Facturas del cliente"
                  rows={facturas}
                  columns={COLUMNAS_FACTURAS}
                  searchable={false}
                  pageParam="pfacturas"
                  embedded
                  emptyState={{ title: 'Aún no hay facturas para este cliente' }}
                  mobileCard={(f) => ({
                    primary: `Factura N.º ${f.numero}`,
                    secondary: formatFecha(f.fecha),
                    status: <EstadoChip {...ESTADO_FACTURA[f.estado]} />,
                    amount: formatUsd(f.total_usd),
                  })}
                />
              )}
            </FichaSeccion>

            <FichaSeccion titulo="Pedidos">
              {pedidos.length === 0 ? (
                <EmptyState
                  compact
                  icon={<EventNoteOutlinedIcon />}
                  title="Aún no hay pedidos para este cliente"
                />
              ) : (
                <AppDataGrid<Pedido>
                  tableId="cliente-pedidos"
                  label="Pedidos del cliente"
                  rows={pedidos}
                  columns={COLUMNAS_PEDIDOS}
                  searchable={false}
                  pageParam="ppedidos"
                  embedded
                  emptyState={{ title: 'Aún no hay pedidos para este cliente' }}
                  mobileCard={(p) => ({
                    primary: `Pedido del ${formatFecha(p.fecha)}`,
                    secondary: p.fecha_entrega
                      ? `Entrega: ${formatFecha(p.fecha_entrega)}`
                      : 'Sin fecha de entrega',
                    status: <EstadoChip {...ESTADO_PEDIDO[p.estado]} />,
                  })}
                />
              )}
            </FichaSeccion>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <CreditoResumen limiteUsd={cliente.limite_credito_usd} saldoUsd={saldo} />
            <FichaSeccion titulo="Documentos">
              <DocumentoUpload store={documentoStore} tipo="cedula" label="Cédula" />
              <DocumentoUpload store={documentoStore} tipo="rif" label="RIF" />
            </FichaSeccion>
          </Box>
        </Box>

        {dialogos}
      </Box>
    </Fade>
  )
}
