'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { CopyableText } from '@/components/molecules/CopyableText'
import { FichaHeader } from '@/components/molecules/FichaHeader'
import { KpiCard } from '@/components/molecules/KpiCard'
import { RangoFechasSelector } from '@/components/molecules/RangoFechasSelector'
import { StatusChips } from '@/components/molecules/StatusChips'
import { GastosTable } from '@/components/organisms/GastosTable'
import { GastoForm, type ModoGastoForm } from '@/components/organisms/GastoForm'
import { AnularGastoDialog } from '@/components/organisms/AnularGastoDialog'
import { GastoDetalleDialog } from '@/components/organisms/GastoDetalleDialog'
import { salarioEnMoneda } from '@/components/organisms/EmpleadosTable'
import type { TasaSelectorConfig } from '@/components/organisms/TasaSelector'
import { formatBs, formatEntero, formatUsd } from '@/lib/format'
import { useEmpleadoAcciones } from '../useEmpleadoAcciones'
import type { CategoriaGasto, CostoEmpleado, Empleado, Gasto, RangoFechas } from '@/types/domain'

type DialogoGasto = { modo: ModoGastoForm; gasto: Gasto | null } | null

export interface EmpleadoFichaProps {
  empleado: Empleado
  /** Costo en el rango: solo pagos confirmados. */
  costo: CostoEmpleado
  /** Pagos del rango en cualquier estado (orden fecha desc). */
  pagos: Gasto[]
  categorias: CategoriaGasto[]
  configTasas: TasaSelectorConfig
  rango: RangoFechas
  hoy: string
}

/**
 * Ficha del empleado (20-gastos, Fase B). Todo llega por props desde
 * `page.tsx`. `FichaHeader` (nombre, cédula, cargo, estado; primario
 * "Registrar pago"; `⋮` Editar / Desactivar–Activar), costo del rango en
 * `KpiCard`s (pagado, n.º de pagos, promedio mensual; anulados fuera) y sus
 * pagos en `GastosTable` (anular, registrar de nuevo, detalle).
 */
export function EmpleadoFicha({ empleado, costo, pagos, categorias, configTasas, rango, hoy }: EmpleadoFichaProps) {
  const { editar, cambiarActivo, pendienteId, dialogo: dialogoEmpleado } = useEmpleadoAcciones()
  const [dialogo, setDialogo] = React.useState<DialogoGasto>(null)
  const [anular, setAnular] = React.useState<Gasto | null>(null)
  const [detalleId, setDetalleId] = React.useState<string | null>(null)
  const empleados = React.useMemo(() => [empleado], [empleado])

  const registrarPago = () => setDialogo({ modo: 'nomina', gasto: null })

  return (
    <Box sx={{ display: 'grid', gap: 3, pb: { xs: 8, sm: 0 } }}>
      <FichaHeader
        backHref="/gastos?tab=empleados"
        backLabel="Empleados"
        title={empleado.nombre}
        meta={
          <>
            <CopyableText value={empleado.cedula} />
            {empleado.cargo ? <span>{empleado.cargo}</span> : null}
            <span>Salario mensual {salarioEnMoneda(empleado)}</span>
            <StatusChips activo={empleado.activo} />
          </>
        }
        primaryAction={{
          label: 'Registrar pago',
          icon: <PaymentsOutlinedIcon />,
          onClick: registrarPago,
          disabled: !empleado.activo,
        }}
        menuActions={[
          { label: 'Editar', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => editar(empleado) },
          empleado.activo
            ? {
                label: 'Desactivar',
                icon: <VisibilityOffOutlinedIcon fontSize="small" />,
                onClick: () => void cambiarActivo(empleado),
                destructive: true,
              }
            : {
                label: 'Activar',
                icon: <VisibilityOutlinedIcon fontSize="small" />,
                onClick: () => void cambiarActivo(empleado),
              },
        ]}
        pending={pendienteId === empleado.id}
      />

      {!empleado.activo ? (
        <Alert severity="info">Empleado inactivo: no recibe pagos nuevos. Sus pagos hechos se conservan.</Alert>
      ) : null}
      {empleado.notas ? (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
          {empleado.notas}
        </Typography>
      ) : null}

      <RangoFechasSelector rango={rango} hoy={hoy} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' } }}>
        <KpiCard
          title="Pagado en el período"
          value={formatUsd(costo.total_usd)}
          secondary={`${formatBs(costo.total_bs)} a la tasa de cada pago`}
        />
        <KpiCard
          title="Pagos"
          value={formatEntero(costo.n_pagos)}
          secondary={costo.n_pagos === 1 ? 'confirmado' : 'confirmados'}
        />
        <KpiCard
          title="Promedio mensual"
          value={formatUsd(costo.promedio_mensual_usd)}
          secondary={`${formatEntero(costo.meses)} ${costo.meses === 1 ? 'mes' : 'meses'} del período`}
        />
      </Box>

      <GastosTable
        gastos={pagos}
        categorias={categorias}
        empleados={empleados}
        accionVacio={
          empleado.activo ? (
            <Button variant="contained" startIcon={<PaymentsOutlinedIcon />} onClick={registrarPago}>
              Registrar pago
            </Button>
          ) : undefined
        }
        onDetalle={(g) => setDetalleId(g.id)}
        onEditar={(g) => setDialogo({ modo: 'editar', gasto: g })}
        onAnular={(g) => setAnular(g)}
        onRegistrarDeNuevo={(g) => setDialogo({ modo: 'nomina', gasto: g })}
      />

      <GastoForm
        key={dialogo ? `${dialogo.modo}-${dialogo.gasto?.id ?? 'nuevo'}` : 'cerrado'}
        open={!!dialogo}
        modo={dialogo?.modo ?? 'nomina'}
        gasto={dialogo?.gasto ?? null}
        categorias={categorias}
        configTasas={configTasas}
        empleados={empleados}
        empleadoInicial={empleado.id}
        onClose={() => setDialogo(null)}
      />
      <AnularGastoDialog gasto={anular} onClose={() => setAnular(null)} />
      <GastoDetalleDialog gastoId={detalleId} onClose={() => setDetalleId(null)} />
      {dialogoEmpleado}
    </Box>
  )
}
