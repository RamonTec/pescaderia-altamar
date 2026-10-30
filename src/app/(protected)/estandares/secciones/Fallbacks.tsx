'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import type { GridColDef } from '@mui/x-data-grid'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { Fallback } from '@/components/molecules/Fallback'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { colFecha, colMonto, colPrincipal } from '@/components/organisms/appDataGridColumns'
import { RouteError } from '@/components/organisms/RouteError'
import { conGuion, formatUsd } from '@/lib/format'
import { Apartado, CLIENTES, Demo, Demos, Seccion, type ClienteDemo } from './comun'

type EstadoTabla = 'vacia' | 'sin-resultados' | 'error' | 'cargando'

function TablaEstados() {
  const [estado, setEstado] = React.useState<EstadoTabla>('vacia')
  const columns = React.useMemo<GridColDef<ClienteDemo>[]>(
    () => [
      colPrincipal<ClienteDemo>({ field: 'nombre', headerName: 'Cliente', secundario: (r) => r.rif }),
      colMonto<ClienteDemo>('saldo', 'Saldo'),
      colFecha<ClienteDemo>('alta', 'Alta'),
    ],
    []
  )
  return (
    <Demo label="Tabla: vacío, sin resultados (filtro activo) y error; sin «0–0 de 0»">
      <SegmentedControl
        aria-label="Estado de la tabla"
        size="small"
        value={estado}
        onChange={setEstado}
        options={[
          { value: 'vacia', label: 'Vacía' },
          { value: 'sin-resultados', label: 'Sin resultados' },
          { value: 'error', label: 'Error' },
          { value: 'cargando', label: 'Cargando' },
        ]}
      />
      <AppDataGrid<ClienteDemo>
        key={estado}
        tableId="estandares-fallbacks"
        label="Tabla de muestra"
        rows={estado === 'sin-resultados' ? CLIENTES.filter(() => false) : []}
        columns={columns}
        loading={estado === 'cargando'}
        error={estado === 'error' ? 'No se pudieron cargar los clientes. Revisa tu conexión.' : null}
        onRetry={() => setEstado('vacia')}
        onClearFilters={estado === 'sin-resultados' ? () => setEstado('vacia') : undefined}
        emptyState={{
          title: 'Aún no hay clientes',
          description: 'Registra el primero para empezar a venderle a crédito.',
          action: (
            <Button variant="contained" startIcon={<AddOutlinedIcon />}>
              Nuevo cliente
            </Button>
          ),
        }}
      />
    </Demo>
  )
}

export function Fallbacks() {
  const [reintentos, setReintentos] = React.useState(0)
  return (
    <Seccion
      id="fallbacks"
      titulo="Fallbacks"
      descripcion="Un solo componente (Fallback): ícono en un círculo de 44 px, título, texto y una acción que resuelve la situación."
    >
      <Apartado titulo="Los cinco tipos">
        <Demos columnas={3}>
          <Demo label="vacio">
            <Fallback tipo="vacio" titulo="Aún no hay compras" texto="Registra la primera para cargar inventario." accion={<Button variant="contained">Registrar compra</Button>} compact />
          </Demo>
          <Demo label="sin-resultados">
            <Fallback tipo="sin-resultados" titulo="Sin resultados para «pargo azul»" texto="Revisa lo que escribiste o prueba con otra palabra." accion={<Button variant="outlined">Limpiar filtros</Button>} compact />
          </Demo>
          <Demo label="error">
            <Fallback tipo="error" titulo="Algo salió mal" texto="No se pudo cargar la sección. Tus datos están a salvo." accion={<Button variant="outlined">Reintentar</Button>} compact />
          </Demo>
          <Demo label="sin-permiso">
            <Fallback tipo="sin-permiso" titulo="No tienes acceso a esta sección" texto="Solo un administrador puede verla." accion={<Button variant="contained">Volver al inicio</Button>} compact />
          </Demo>
          <Demo label="no-encontrado">
            <Fallback tipo="no-encontrado" titulo="Este cliente no existe" texto="Puede que el enlace esté mal escrito." accion={<Button variant="contained">Ir a clientes</Button>} compact />
          </Demo>
          <Demo label="Dato faltante en celda o ficha: «—» (conGuion)">
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 1, typography: 'body2', '& dt': { color: 'text.secondary' }, '& dd': { m: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}>
              <dt>Correo</dt>
              <dd>{conGuion(null)}</dd>
              <dt>Límite</dt>
              <dd>{conGuion(null, formatUsd)}</dd>
              <dt>Saldo</dt>
              <dd>{conGuion(1240.5, formatUsd)}</dd>
            </Box>
          </Demo>
        </Demos>
      </Apartado>

      <Apartado titulo="En contexto">
        <TablaEstados />
        <Demo label="Error de carga de una ruta (error.tsx → RouteError), con el código del error">
          <RouteError
            mensaje="No se pudieron cargar los clientes."
            digest="2384761923"
            retry={() => setReintentos((n) => n + 1)}
          />
          {reintentos > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              Reintentos: {reintentos}
            </Typography>
          ) : null}
        </Demo>
      </Apartado>
    </Seccion>
  )
}
