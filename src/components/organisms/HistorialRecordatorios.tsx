'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined'
import { RowActionsMenu, type RowAction } from '@/components/molecules/RowActionsMenu'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { EstadoChip, colAcciones, type EstadoDef } from '@/components/organisms/appDataGridColumns'
import { reintentarRecordatorioCorreoAction } from '@/app/(protected)/cartera/actions'
import { useNotify } from '@/lib/useNotify'
import type { CanalRecordatorioId, EstadoEnvio, RecordatorioCobro } from '@/types/domain'

const ESTADO_ENVIO: Record<EstadoEnvio, EstadoDef> = {
  generado: { label: 'Generado', color: 'info' },
  enviado: { label: 'Enviado', color: 'success' },
  fallido: { label: 'Fallido', color: 'error' },
}

const CANAL: Record<CanalRecordatorioId, string> = { whatsapp: 'WhatsApp', email: 'Correo' }

const fechaHoraFormatter = new Intl.DateTimeFormat('es-VE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Caracas',
})

function fechaHora(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : fechaHoraFormatter.format(d)
}

export interface HistorialRecordatoriosProps {
  recordatorios: RecordatorioCobro[]
  /** Admin: puede reintentar correos fallidos. */
  puedeReintentar: boolean
  /** Tras un reintento (ej. `router.refresh()`). */
  onReintentado?: () => void
  pageParam?: string
}

const esReintentable = (r: RecordatorioCobro) => r.canal === 'email' && r.estado === 'fallido'

function EstadoCelda({ r }: { r: RecordatorioCobro }) {
  return (
    <Box sx={{ display: 'grid', alignContent: 'center', justifyItems: 'start', height: '100%', gap: 0.25, minWidth: 0 }}>
      <EstadoChip {...ESTADO_ENVIO[r.estado]} />
      {r.estado === 'fallido' && r.error ? (
        <Typography variant="caption" color="error" noWrap title={r.error} sx={{ maxWidth: '100%' }}>
          {r.error}
        </Typography>
      ) : null}
    </Box>
  )
}

/**
 * Historial de recordatorios de cobro de un cliente (09-cuentas-por-cobrar):
 * fecha, canal, destinatario, quién y estado. Un correo fallido muestra el
 * error y "Reintentar" (admin), que crea un envío nuevo con el mismo texto.
 *
 * Paginación en cliente: el historial de un solo cliente es corto (desvío
 * consciente de "recordatorios = servidor" del estándar, pensado para un
 * listado global).
 */
export function HistorialRecordatorios({
  recordatorios,
  puedeReintentar,
  onReintentado,
  pageParam = 'precordatorios',
}: HistorialRecordatoriosProps) {
  const notify = useNotify()
  const [pendientes, setPendientes] = React.useState<ReadonlySet<string>>(() => new Set())
  const pendientesRef = React.useRef(new Set<string>())

  const reintentar = React.useCallback(
    async (r: RecordatorioCobro) => {
      if (pendientesRef.current.has(r.id)) return
      pendientesRef.current.add(r.id)
      setPendientes(new Set(pendientesRef.current))
      try {
        const res = await reintentarRecordatorioCorreoAction({ recordatorioId: r.id })
        if (res.error) notify.error(res.error)
        else notify.success(res.success ?? 'Correo enviado')
        if (res.resultado) onReintentado?.()
      } catch {
        notify.error('No se pudo reintentar el envío. Revisa tu conexión e intenta de nuevo.')
      } finally {
        pendientesRef.current.delete(r.id)
        setPendientes(new Set(pendientesRef.current))
      }
    },
    [notify, onReintentado]
  )

  const acciones = React.useCallback(
    (r: RecordatorioCobro): RowAction[] =>
      puedeReintentar && esReintentable(r)
        ? [
            {
              label: 'Reintentar',
              icon: <ReplayOutlinedIcon fontSize="small" />,
              onClick: () => void reintentar(r),
            },
          ]
        : [],
    [puedeReintentar, reintentar]
  )

  const hayAcciones = puedeReintentar && recordatorios.some(esReintentable)

  const columns = React.useMemo<GridColDef<RecordatorioCobro>[]>(() => {
    const cols: GridColDef<RecordatorioCobro>[] = [
      {
        field: 'created_at',
        headerName: 'Fecha',
        minWidth: 170,
        flex: 1,
        valueFormatter: (v: string) => fechaHora(v),
      },
      {
        field: 'canal',
        headerName: 'Canal',
        minWidth: 100,
        flex: 0.6,
        valueFormatter: (v: CanalRecordatorioId) => CANAL[v],
      },
      { field: 'destinatario', headerName: 'Destinatario', minWidth: 160, flex: 1.2 },
      {
        field: 'enviado_por_nombre',
        headerName: 'Quién',
        minWidth: 120,
        flex: 0.8,
        valueFormatter: (v: string | null) => v ?? '—',
      },
      {
        field: 'estado',
        headerName: 'Estado',
        minWidth: 160,
        flex: 1,
        renderCell: ({ row }) => <EstadoCelda r={row} />,
      },
    ]
    if (hayAcciones) {
      cols.push(
        colAcciones<RecordatorioCobro>(acciones, {
          rowLabel: (r) => `recordatorio del ${fechaHora(r.created_at)}`,
          isPending: (r) => pendientes.has(r.id),
        })
      )
    }
    return cols
  }, [acciones, hayAcciones, pendientes])

  return (
    <AppDataGrid<RecordatorioCobro>
      tableId="cliente-recordatorios"
      label="Historial de recordatorios"
      rows={recordatorios}
      columns={columns}
      searchable={false}
      embedded
      pageParam={pageParam}
      hideOnMobile={['enviado_por_nombre', 'destinatario']}
      emptyState={{
        icon: <NotificationsNoneOutlinedIcon fontSize="large" />,
        title: 'Aún no se han enviado recordatorios',
        compact: true,
      }}
      mobileCard={(r) => ({
        primary: `${CANAL[r.canal]} · ${fechaHora(r.created_at)}`,
        secondary: r.estado === 'fallido' && r.error ? r.error : r.destinatario,
        status: <EstadoChip {...ESTADO_ENVIO[r.estado]} />,
        actions:
          puedeReintentar && esReintentable(r) ? (
            <RowActionsMenu
              label={`recordatorio del ${fechaHora(r.created_at)}`}
              actions={acciones(r)}
              pending={pendientes.has(r.id)}
              size="medium"
            />
          ) : undefined,
      })}
    />
  )
}
