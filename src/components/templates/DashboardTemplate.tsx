import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/**
 * Plantilla del dashboard (15): solo layout. Recibe cada bloque ya armado
 * (en su `Suspense`) y los ubica:
 *
 *   encabezado → fila de KPIs del día → bloque operativo → (admin) análisis
 *   del período con su selector de rango: "Ventas y margen", "Procesos e
 *   inventario", "Cartera y flujo" (foto a hoy) y "Clientes".
 *
 * El operador no recibe `admin`: esas secciones no se piden ni se renderizan
 * (no se ocultan por CSS).
 */

export interface DashboardSeccionesAdmin {
  selector: React.ReactNode
  ventas: React.ReactNode
  procesos: React.ReactNode
  cartera: React.ReactNode
  clientes: React.ReactNode
}

export interface DashboardTemplateProps {
  header: React.ReactNode
  kpis: React.ReactNode
  operativo: React.ReactNode
  admin?: DashboardSeccionesAdmin
}

export function SeccionDashboard({
  id,
  titulo,
  descripcion,
  accion,
  children,
}: {
  id: string
  titulo: string
  descripcion?: string
  accion?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box component="section" aria-labelledby={id} sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Box>
          <Typography id={id} variant="h5" component="h2">
            {titulo}
          </Typography>
          {descripcion ? (
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch' }}>
              {descripcion}
            </Typography>
          ) : null}
        </Box>
        {accion}
      </Box>
      {children}
    </Box>
  )
}

export function DashboardTemplate({ header, kpis, operativo, admin }: DashboardTemplateProps) {
  return (
    <>
      {header}
      <div className="grid min-w-0 gap-6 pb-6 md:gap-8">
        {kpis}
        <SeccionDashboard id="dash-operacion" titulo="Operación">
          {operativo}
        </SeccionDashboard>
        {admin ? (
          <>
            <SeccionDashboard
              id="dash-ventas"
              titulo="Ventas y margen"
              descripcion="Análisis del período elegido. Montos en USD sin IVA, netos de notas de crédito; el resultado cambiario va aparte, en Bs."
              accion={admin.selector}
            >
              {admin.ventas}
            </SeccionDashboard>
            <SeccionDashboard id="dash-procesos" titulo="Procesos e inventario">
              {admin.procesos}
            </SeccionDashboard>
            <SeccionDashboard
              id="dash-cartera"
              titulo="Cartera y flujo"
              descripcion="Foto a hoy: no depende del período elegido."
            >
              {admin.cartera}
            </SeccionDashboard>
            <SeccionDashboard id="dash-clientes" titulo="Clientes">
              {admin.clientes}
            </SeccionDashboard>
          </>
        ) : null}
      </div>
    </>
  )
}
