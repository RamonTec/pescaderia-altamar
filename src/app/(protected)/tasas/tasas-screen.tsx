'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined'
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import type { GridColDef } from '@mui/x-data-grid'
import {
  actualizarTasasAction,
  type ActualizarTasasState,
} from '@/app/(protected)/tasas/actions'
import type { OperacionTasaManual } from '@/app/(protected)/tasas/operaciones-tasa-manual'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { colTasa } from '@/components/organisms/appDataGridColumns'
import { PageHeader } from '@/components/molecules/PageHeader'
import { TasaManualDialog } from '@/components/organisms/TasaManualDialog'
import type { ResultadoActualizacion, TasasHoy } from '@/lib/services/tasaService'
import type { Tasa } from '@/types/domain'
import { formatFecha, formatHace, formatTasa } from '@/lib/format'
import { useNotify } from '@/lib/useNotify'

const ORIGEN_LABEL = { bcv_scraping: 'BCV', dolarapi: 'dolarapi', manual: 'manual' } as const
const FUENTE_LABEL = { bcv: 'BCV', paralela: 'Paralela', manual: 'Manual' } as const
const MONEDA_SIMBOLO = { USD: '$', EUR: '€' } as const

export interface TasasScreenProps {
  vigentes: TasasHoy
  historial: Tasa[]
  esAdmin: boolean
  operaciones: OperacionTasaManual[]
}

/** Resumen legible de una fuente/moneda para el toast de "Actualizar ahora". */
function fraseResultado(r: ResultadoActualizacion): string {
  const fuente = FUENTE_LABEL[r.fuente] ?? r.fuente
  const moneda = MONEDA_SIMBOLO[r.moneda] ?? r.moneda
  switch (r.estado) {
    case 'actualizado':
      return `${fuente} ${moneda}: actualizado a ${formatTasa(r.valor_bs ?? 0)}`
    case 'fallo_con_respaldo':
      return `${fuente} ${moneda}: el BCV no respondió, se guardó el espejo de dolarapi`
    case 'sin_cambios':
      return `${fuente} ${moneda}: sin cambios`
    case 'descartado_por_sanidad':
      return `${fuente} ${moneda}: descartado (${r.detalle ?? 'sanidad'})`
    case 'sin_datos':
      return `${fuente} ${moneda}: sin datos (${r.detalle ?? 'la fuente no respondió'})`
    case 'error':
      return `${fuente} ${moneda}: error (${r.detalle ?? 'intenta de nuevo'})`
  }
}

interface TarjetaProps {
  titulo: string
  tasa: TasasHoy['bcv']['usd']
  /** Tasa anterior de la misma fuente/moneda (para la variación %). */
  anterior: number | null
}

function TarjetaTasa({ titulo, tasa, anterior }: TarjetaProps) {
  if (!tasa) {
    return (
      <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {titulo}
        </Typography>
        <Typography variant="h5" color="text.secondary">
          Sin tasa
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Ninguna fuente ha respondido todavía.
        </Typography>
      </Paper>
    )
  }

  const valor = Number(tasa.tasa.valor_bs)
  const variacion = anterior != null && anterior > 0 ? (valor / anterior - 1) * 100 : null

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'grid', gap: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {titulo}
      </Typography>
      <Typography variant="h5" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatTasa(valor)}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
        <Chip
          size="small"
          variant="soft"
          color={tasa.tasa.origen === 'manual' ? 'warning' : 'default'}
          label={ORIGEN_LABEL[tasa.tasa.origen]}
        />
        <Typography variant="caption" color="text.secondary">
          valor {formatFecha(tasa.fecha_valor)} · {formatHace(tasa.tasa.publicada_en)}
        </Typography>
      </Box>
      {variacion != null ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {variacion >= 0 ? (
            <ArrowUpwardOutlinedIcon sx={{ fontSize: 16, color: 'success.main' }} aria-hidden />
          ) : (
            <ArrowDownwardOutlinedIcon sx={{ fontSize: 16, color: 'error.main' }} aria-hidden />
          )}
          <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {variacion >= 0 ? '+' : ''}
            {variacion.toFixed(2)} % vs la anterior
          </Typography>
        </Box>
      ) : null}
      {tasa.arrastrada ? (
        <Chip
          size="small"
          color="warning"
          icon={<WarningAmberOutlinedIcon />}
          label={`arrastrada del ${formatFecha(tasa.fecha_valor)}`}
        />
      ) : null}
    </Paper>
  )
}

/* ---------- columnas ---------- */

const COLS_HISTORIAL: GridColDef<Tasa>[] = [
  {
    field: 'fecha',
    headerName: 'Fecha valor',
    minWidth: 120,
    valueFormatter: (v) => formatFecha(v as string),
  },
  {
    field: 'fuente',
    headerName: 'Fuente',
    minWidth: 100,
    valueFormatter: (v) => FUENTE_LABEL[v as keyof typeof FUENTE_LABEL] ?? String(v),
  },
  { field: 'moneda', headerName: 'Moneda', minWidth: 90 },
  colTasa<Tasa>('valor_bs', 'Valor (Bs)', { minWidth: 140 }),
  {
    field: 'origen',
    headerName: 'Origen',
    minWidth: 110,
    valueFormatter: (v) =>
      v ? ORIGEN_LABEL[v as keyof typeof ORIGEN_LABEL] ?? String(v) : '',
  },
  {
    field: 'registrada_por',
    headerName: 'Registrada por',
    minWidth: 140,
    valueFormatter: (v) => (v ? String(v) : '—'),
  },
]

const COLS_OPERACIONES: GridColDef<OperacionTasaManual>[] = [
  {
    field: 'fecha',
    headerName: 'Fecha',
    minWidth: 120,
    valueFormatter: (v) => formatFecha(v as string),
  },
  { field: 'tipo', headerName: 'Tipo', minWidth: 130 },
  { field: 'documento', headerName: 'Documento', flex: 1, minWidth: 180 },
  {
    field: 'usuario',
    headerName: 'Usuario',
    minWidth: 140,
    valueFormatter: (v) => (v ? String(v) : '—'),
  },
  {
    field: 'referencial',
    headerName: 'Referencial',
    align: 'right',
    headerAlign: 'right',
    minWidth: 130,
    valueFormatter: (v) => (v == null ? '—' : formatTasa(v as number)),
  },
  {
    field: 'manual',
    headerName: 'Manual',
    align: 'right',
    headerAlign: 'right',
    minWidth: 130,
    valueFormatter: (v) => formatTasa(v as number),
  },
  {
    field: 'diferencia_pct',
    headerName: 'Diferencia %',
    align: 'right',
    headerAlign: 'right',
    minWidth: 120,
    valueFormatter: (v) =>
      v == null ? '—' : `${(v as number) >= 0 ? '+' : ''}${(v as number).toFixed(1)} %`,
  },
]

type FiltroFuente = 'todas' | 'bcv' | 'paralela' | 'manual'
type FiltroMoneda = 'todas' | 'USD' | 'EUR'

export function TasasScreen({ vigentes, historial, esAdmin, operaciones }: TasasScreenProps) {
  const notify = useNotify()
  const [tab, setTab] = React.useState(0)
  const [actualizando, setActualizando] = React.useState(false)
  const [manualAbierto, setManualAbierto] = React.useState(false)
  const [filtroFuente, setFiltroFuente] = React.useState<FiltroFuente>('todas')
  const [filtroMoneda, setFiltroMoneda] = React.useState<FiltroMoneda>('todas')
  const [desde, setDesde] = React.useState('')
  const [hasta, setHasta] = React.useState('')

  // Variación contra la anterior: la primera tasa del historial con fecha
  // anterior a la vigente, misma fuente/moneda (ya viene ordenada desc).
  const anteriorDe = React.useCallback(
    (fuente: 'bcv' | 'paralela', moneda: 'USD' | 'EUR'): number | null => {
      const vigente = vigentes[fuente][moneda === 'USD' ? 'usd' : 'eur']
      if (!vigente) return null
      const previa = historial.find(
        (t) =>
          t.fuente === fuente && t.moneda === moneda && t.fecha < vigente.fecha_valor
      )
      return previa ? Number(previa.valor_bs) : null
    },
    [historial, vigentes]
  )

  const actualizar = async () => {
    if (actualizando) return
    setActualizando(true)
    try {
      const result: ActualizarTasasState = await actualizarTasasAction()
      if (result.error) {
        notify.error(result.error)
        return
      }
      // Toast por fuente/moneda ("BCV: actualizado · Paralela: sin cambios").
      for (const r of result.resumen?.resultados ?? []) {
        const frase = fraseResultado(r)
        if (r.estado === 'error' || r.estado === 'sin_datos' || r.estado === 'descartado_por_sanidad') {
          notify.error(frase)
        } else if (r.estado === 'fallo_con_respaldo') {
          notify.info(frase)
        } else {
          notify.success(frase)
        }
      }
    } finally {
      setActualizando(false)
    }
  }

  const historialFiltrado = React.useMemo(
    () =>
      historial.filter(
        (t) =>
          (filtroFuente === 'todas' || t.fuente === filtroFuente) &&
          (filtroMoneda === 'todas' || t.moneda === filtroMoneda) &&
          (!desde || t.fecha >= desde) &&
          (!hasta || t.fecha <= hasta)
      ),
    [historial, filtroFuente, filtroMoneda, desde, hasta]
  )

  const referencialDefault =
    vigentes[vigentes.config.fuente_tasa_default].usd
      ? Number(vigentes[vigentes.config.fuente_tasa_default].usd!.tasa.valor_bs)
      : null

  return (
    <>
      <PageHeader
        title="Tasas de cambio"
        subtitle={`Referenciales vigentes hoy · fuente preferida: ${
          FUENTE_LABEL[vigentes.config.fuente_tasa_default]
        }`}
      >
        {esAdmin ? (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlinedIcon />}
              loading={actualizando}
              loadingPosition="start"
              onClick={actualizar}
            >
              Actualizar ahora
            </Button>
            <Button
              variant="contained"
              startIcon={<EditOutlinedIcon />}
              onClick={() => setManualAbierto(true)}
            >
              Registrar tasa manual
            </Button>
          </Stack>
        ) : null}
      </PageHeader>

      {/* Vigentes hoy */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
          mb: 3,
        }}
      >
        <TarjetaTasa titulo="BCV USD" tasa={vigentes.bcv.usd} anterior={anteriorDe('bcv', 'USD')} />
        <TarjetaTasa titulo="BCV EUR" tasa={vigentes.bcv.eur} anterior={anteriorDe('bcv', 'EUR')} />
        <TarjetaTasa
          titulo="Paralela USD"
          tasa={vigentes.paralela.usd}
          anterior={anteriorDe('paralela', 'USD')}
        />
        <TarjetaTasa
          titulo="Paralela EUR"
          tasa={vigentes.paralela.eur}
          anterior={anteriorDe('paralela', 'EUR')}
        />
      </Box>

      {esAdmin ? (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tab} onChange={(_, next) => setTab(next)} aria-label="Secciones de tasas">
            <Tab label="Historial" />
            <Tab label="Operaciones con tasa manual" />
          </Tabs>
        </Box>
      ) : null}

      {esAdmin && tab === 1 ? (
        <AppDataGrid<OperacionTasaManual>
          tableId="tasas-operaciones-manuales"
          label="Operaciones con tasa manual"
          rows={operaciones}
          columns={COLS_OPERACIONES}
          getRowId={(r) => r.id}
          searchable={false}
          hideOnMobile={['usuario', 'referencial']}
          emptyState={{
            title: 'Ninguna operación con tasa manual',
            description:
              'Cuando alguien reemplace la referencial por una tasa manual en una compra, venta o abono, aparecerá aquí.',
          }}
        />
      ) : (
        <AppDataGrid<Tasa>
          tableId="tasas-historial"
          label="Historial de tasas"
          rows={historialFiltrado}
          columns={COLS_HISTORIAL}
          getRowId={(r) => r.id}
          searchable={false}
          hideOnMobile={['origen', 'registrada_por']}
          filters={
            <>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={filtroFuente}
                onChange={(_, next) => next && setFiltroFuente(next)}
                aria-label="Filtrar por fuente"
              >
                <ToggleButton value="todas">Todas</ToggleButton>
                <ToggleButton value="bcv">BCV</ToggleButton>
                <ToggleButton value="paralela">Paralela</ToggleButton>
                <ToggleButton value="manual">Manual</ToggleButton>
              </ToggleButtonGroup>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={filtroMoneda}
                onChange={(_, next) => next && setFiltroMoneda(next)}
                aria-label="Filtrar por moneda"
              >
                <ToggleButton value="todas">Todas</ToggleButton>
                <ToggleButton value="USD">USD</ToggleButton>
                <ToggleButton value="EUR">EUR</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                label="Desde"
                type="date"
                size="small"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 150 }}
              />
              <TextField
                label="Hasta"
                type="date"
                size="small"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 150 }}
              />
            </>
          }
          emptyState={
            historial.length === 0
              ? {
                  title: 'Aún no hay tasas registradas',
                  description:
                    'Las tasas se obtienen automáticamente del BCV y dolarapi; un admin también puede cargarlas manualmente.',
                }
              : {
                  title: 'Sin resultados',
                  description: 'Prueba con otros filtros.',
                }
          }
        />
      )}

      {esAdmin ? (
        <TasaManualDialog
          open={manualAbierto}
          onClose={() => setManualAbierto(false)}
          referencialActual={referencialDefault}
        />
      ) : null}
    </>
  )
}