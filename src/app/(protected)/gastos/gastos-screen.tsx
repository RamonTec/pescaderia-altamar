'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import Button from '@mui/material/Button'
import { PageHeader } from '@/components/molecules/PageHeader'
import { KpiCard } from '@/components/molecules/KpiCard'
import { RangoFechasSelector } from '@/components/molecules/RangoFechasSelector'
import { writeUrlParams } from '@/components/organisms/AppDataGrid'
import { GastosTable } from '@/components/organisms/GastosTable'
import { GastoForm, type ModoGastoForm } from '@/components/organisms/GastoForm'
import { AnularGastoDialog } from '@/components/organisms/AnularGastoDialog'
import { GastoDetalleDialog } from '@/components/organisms/GastoDetalleDialog'
import { CategoriasGastoPanel } from '@/components/organisms/CategoriasGastoPanel'
import { EmpleadosTable } from '@/components/organisms/EmpleadosTable'
import type { TasaSelectorConfig } from '@/components/organisms/TasaSelector'
import { filtroEstadoDesdeParam, type FiltroEstadoGasto } from '@/lib/gastoValidation'
import { formatEntero, formatUsd } from '@/lib/format'
import { useEmpleadoAcciones } from './empleados/useEmpleadoAcciones'
import type { CategoriaGasto, Empleado, EstadoGasto, Gasto, RangoFechas, ResumenGastos } from '@/types/domain'

type TabGastos = 'gastos' | 'empleados' | 'categorias'

function tabDesdeParam(v: string | null): TabGastos {
  return v === 'categorias' || v === 'empleados' ? v : 'gastos'
}

/** Chips de estado (Fase A). "Pendientes" llega con los recurrentes (Fase C). */
const FILTROS_ESTADO: { value: FiltroEstadoGasto; label: string }[] = [
  { value: 'confirmado', label: 'Confirmados' },
  { value: 'cerrados', label: 'Anulados / descartados' },
  { value: 'todos', label: 'Todos' },
]

const ESTADOS_DE_FILTRO: Record<FiltroEstadoGasto, readonly EstadoGasto[] | null> = {
  confirmado: ['confirmado'],
  pendiente: ['pendiente'],
  cerrados: ['anulado', 'descartado'],
  todos: null,
}

type DialogoGasto = { modo: ModoGastoForm; gasto: Gasto | null; empleadoId?: string | null } | null

export interface GastosScreenProps {
  /** Gastos del rango, de cualquier estado (orden fecha desc). */
  gastos: Gasto[]
  /** Árbol de categorías (activas e inactivas). */
  categorias: CategoriaGasto[]
  /** Confirmados del rango. */
  resumen: ResumenGastos
  rango: RangoFechas
  hoy: string
  configTasas: TasaSelectorConfig
  /** Empleados (activos e inactivos), Fase B. */
  empleados: Empleado[]
  /** USD pagado a cada empleado en el mes en curso (confirmados). */
  pagadoMes: Record<string, number>
}

/**
 * Pantalla `/gastos` (20-gastos, Fases A y B): pestañas Gastos · Empleados ·
 * Categorías en `?tab=`. "Pago de nómina" abre `GastoForm` en modo `nomina`. En Gastos: rango (`?desde`/`?hasta`, lo pide el servidor), chips
 * de estado (`?estado=`, Confirmados por defecto) y categoría
 * (`?categoria=`), KPIs del rango (total USD, n.º y top categoría, solo
 * confirmados) y `GastosTable`. Diálogos: registrar / editar (P1) /
 * registrar de nuevo, anular con motivo y detalle con trazabilidad.
 */
export function GastosScreen({
  gastos,
  categorias,
  resumen,
  rango,
  hoy,
  configTasas,
  empleados,
  pagadoMes,
}: GastosScreenProps) {
  const searchParams = useSearchParams()
  const tab = tabDesdeParam(searchParams.get('tab'))
  const filtroEstado = filtroEstadoDesdeParam(searchParams.get('estado') ?? undefined)
  const categoriaParam = searchParams.get('categoria')
  const categoriaFiltro = categorias.find((c) => c.id === categoriaParam) ?? null

  const [dialogo, setDialogo] = React.useState<DialogoGasto>(null)
  const [anular, setAnular] = React.useState<Gasto | null>(null)
  const [detalleId, setDetalleId] = React.useState<string | null>(null)
  const empleadoAcciones = useEmpleadoAcciones()

  const filtrados = React.useMemo(() => {
    const estados = ESTADOS_DE_FILTRO[filtroEstado]
    const ids = categoriaFiltro
      ? new Set([categoriaFiltro.id, ...(categoriaFiltro.subcategorias ?? []).map((s) => s.id)])
      : null
    return gastos.filter((g) => (!estados || estados.includes(g.estado)) && (!ids || ids.has(g.categoria_id)))
  }, [gastos, filtroEstado, categoriaFiltro])

  // Top categoría de primer nivel (suma de sus subcategorías).
  const top = React.useMemo(() => {
    const porRaiz = new Map<string, { nombre: string; total: number }>()
    for (const f of resumen.por_categoria) {
      const actual = porRaiz.get(f.categoria_id) ?? { nombre: f.categoria, total: 0 }
      actual.total += f.total_usd
      porRaiz.set(f.categoria_id, actual)
    }
    return [...porRaiz.values()].sort((a, b) => b.total - a.total)[0] ?? null
  }, [resumen])

  const registrar = () => setDialogo({ modo: 'crear', gasto: null })
  const pagoNomina = (empleadoId: string | null = null) => setDialogo({ modo: 'nomina', gasto: null, empleadoId })
  // "Registrar de nuevo" de un pago de nómina vuelve al modo nómina (empleado y período).
  const registrarDeNuevo = (g: Gasto) =>
    setDialogo({ modo: g.empleado_id ? 'nomina' : 'registrar_de_nuevo', gasto: g })
  const cambiarTab = (_: React.SyntheticEvent, next: TabGastos) =>
    writeUrlParams({ tab: next === 'gastos' ? null : next })

  const filtros = (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
      <Box role="group" aria-label="Filtrar por estado" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {FILTROS_ESTADO.map((f) => {
          const activo = f.value === filtroEstado
          return (
            <Chip
              key={f.value}
              label={f.label}
              variant={activo ? 'soft' : 'outlined'}
              color={activo ? 'primary' : 'default'}
              aria-pressed={activo}
              onClick={() => writeUrlParams({ estado: f.value === 'confirmado' ? null : f.value })}
            />
          )
        })}
      </Box>
      <TextField
        select
        size="small"
        label="Categoría"
        value={categoriaFiltro?.id ?? ''}
        onChange={(e) => writeUrlParams({ categoria: e.target.value || null })}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="">Todas</MenuItem>
        {categorias.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.nombre}
            {c.activo ? '' : ' (inactiva)'}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  )

  return (
    <>
      <PageHeader
        title="Gastos"
        subtitle="Gastos operativos de la empresa: mantenimiento, servicios, alquiler y más. Los totales van en USD."
        primaryAction={{ label: 'Registrar gasto', icon: <AddOutlinedIcon />, onClick: registrar }}
        secondaryActions={[{ label: 'Pago de nómina', icon: <PaymentsOutlinedIcon />, onClick: () => pagoNomina() }]}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={cambiarTab} aria-label="Secciones de gastos">
          <Tab value="gastos" label="Gastos" />
          <Tab value="empleados" label="Empleados" />
          <Tab value="categorias" label="Categorías" />
        </Tabs>
      </Box>

      {tab === 'gastos' ? (
        <Box sx={{ display: 'grid', gap: 2.5, pb: { xs: 8, sm: 0 } }}>
          <RangoFechasSelector rango={rango} hoy={hoy} />
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            }}
          >
            <KpiCard title="Total del período" value={formatUsd(resumen.total_usd)} secondary="Gastos confirmados" />
            <KpiCard
              title="Gastos"
              value={formatEntero(resumen.n_gastos)}
              secondary={resumen.n_gastos === 1 ? 'confirmado' : 'confirmados'}
            />
            <KpiCard
              title="Top categoría"
              value={top ? top.nombre : '—'}
              secondary={
                top && resumen.total_usd > 0
                  ? `${formatUsd(top.total)} · ${Math.round((top.total / resumen.total_usd) * 100)} % del total`
                  : 'Sin gastos en el período'
              }
            />
          </Box>
          <GastosTable
            gastos={filtrados}
            categorias={categorias}
            empleados={empleados}
            filtros={filtros}
            filtrado={filtroEstado !== 'confirmado' || !!categoriaFiltro}
            accionVacio={
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={registrar}>
                Registrar gasto
              </Button>
            }
            onDetalle={(g) => setDetalleId(g.id)}
            onEditar={(g) => setDialogo({ modo: 'editar', gasto: g })}
            onAnular={(g) => setAnular(g)}
            onRegistrarDeNuevo={registrarDeNuevo}
          />
        </Box>
      ) : tab === 'empleados' ? (
        <Box sx={{ pb: { xs: 8, sm: 0 } }}>
          <EmpleadosTable
            empleados={empleados}
            pagadoMes={pagadoMes}
            pendienteId={empleadoAcciones.pendienteId}
            acciones={
              <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={empleadoAcciones.nuevo}>
                Nuevo empleado
              </Button>
            }
            accionVacio={
              <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={empleadoAcciones.nuevo}>
                Nuevo empleado
              </Button>
            }
            onEditar={empleadoAcciones.editar}
            onRegistrarPago={(e) => pagoNomina(e.id)}
            onCambiarActivo={(e) => void empleadoAcciones.cambiarActivo(e)}
          />
        </Box>
      ) : (
        <CategoriasGastoPanel categorias={categorias} />
      )}

      <GastoForm
        key={dialogo ? `${dialogo.modo}-${dialogo.gasto?.id ?? dialogo.empleadoId ?? 'nuevo'}` : 'cerrado'}
        open={!!dialogo}
        modo={dialogo?.modo ?? 'crear'}
        gasto={dialogo?.gasto ?? null}
        categorias={categorias}
        configTasas={configTasas}
        empleados={empleados}
        empleadoInicial={dialogo?.empleadoId ?? null}
        onClose={() => setDialogo(null)}
      />
      <AnularGastoDialog gasto={anular} onClose={() => setAnular(null)} />
      <GastoDetalleDialog gastoId={detalleId} onClose={() => setDetalleId(null)} />
      {empleadoAcciones.dialogo}
    </>
  )
}
