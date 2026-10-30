'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { GridColDef } from '@mui/x-data-grid'
import { NavigationProgress } from '@/components/atoms/NavigationProgress'
import { PageLoader, type PageLoaderVariant } from '@/components/atoms/PageLoader'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { SubmitButton } from '@/components/atoms/SubmitButton'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import { colMonto, colPrincipal } from '@/components/organisms/appDataGridColumns'
import { BrandLoader } from '@/components/organisms/BrandLoader'
import { SeccionSkeleton } from '@/components/organisms/DashboardSkeletons'
import { useGlobalLoader } from '@/lib/useGlobalLoader'
import { useNotify } from '@/lib/useNotify'
import { useResaltado } from '@/lib/useResaltado'
import { TIEMPOS } from '@/theme/tokens'
import { Apartado, CLIENTES, Demo, Demos, Seccion, wait, type ClienteDemo } from './comun'

const VARIANTES: { value: PageLoaderVariant; label: string }[] = [
  { value: 'table', label: 'Tabla' },
  { value: 'kpisTable', label: 'KPI + tabla' },
  { value: 'ficha', label: 'Ficha' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'form', label: 'Formulario' },
]

function Niveles() {
  const [variante, setVariante] = React.useState<PageLoaderVariant>('table')
  const [navegando, setNavegando] = React.useState(true)
  return (
    <>
      <Demos>
        <Demo label={`Navegación: filete de 3 px arriba de la ventana, aparece a los ${TIEMPOS.NAV_RETARDO_MS} ms`}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}>
            <NavigationProgress active={navegando} />
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                En la app va fijo en el borde superior y no ocupa lugar. Aquí está dentro del recuadro.
              </Typography>
            </Box>
          </Box>
          <Box>
            <Button variant="outlined" onClick={() => setNavegando((v) => !v)}>
              {navegando ? 'Detener' : 'Simular navegación'}
            </Button>
          </Box>
        </Demo>
        <Demo label="Sección: skeleton por bloque (Suspense del dashboard)">
          <SeccionSkeleton titulos={['Merma por procesos']} altura={120} columnas="" />
        </Demo>
      </Demos>
      <Demo label="Página: PageLoader con la forma de cada plantilla (aquí sin encender la barra global)">
        <SegmentedControl aria-label="Variante de PageLoader" size="small" value={variante} onChange={setVariante} options={VARIANTES} />
        <Box sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: '8px', maxHeight: 520, overflow: 'auto' }}>
          <PageLoader variant={variante} registrarNavegacion={false} />
        </Box>
      </Demo>
    </>
  )
}

function Acciones() {
  const notify = useNotify()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>('No se pudo guardar: el RIF ya está registrado en otro cliente.')
  const enviar = async () => {
    setPending(true)
    await wait(1600)
    setPending(false)
    notify.success('Cliente guardado')
  }
  return (
    <Demos>
      <Demo label="Acción en curso: campos y cierre bloqueados, botón con el verbo en curso">
        <TextField label="Nombre" size="small" fullWidth defaultValue="Hotel Bahía Azul" disabled={pending} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <SubmitButton type="button" pending={pending} pendingLabel="Guardando…" onClick={enviar}>
            Guardar cliente
          </SubmitButton>
        </Box>
      </Demo>
      <Demo label="Error de la acción: el modal sigue abierto, alerta arriba con «Reintentar»">
        {error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => setError(null)}>
                Reintentar
              </Button>
            }
          >
            {error}
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Reintentado. Los datos del formulario siguen intactos.
          </Typography>
        )}
        <TextField label="RIF *" size="small" fullWidth defaultValue="J-30007919-1" error={!!error} />
      </Demo>
    </Demos>
  )
}

function Exito() {
  const notify = useNotify()
  const [filas, setFilas] = React.useState<ClienteDemo[]>(CLIENTES.slice(0, 4))
  const { idResaltado, resaltar } = useResaltado()
  const nextId = React.useRef(1000)
  const columns = React.useMemo<GridColDef<ClienteDemo>[]>(
    () => [colPrincipal<ClienteDemo>({ field: 'nombre', headerName: 'Cliente', secundario: (r) => r.rif }), colMonto<ClienteDemo>('saldo', 'Saldo', { destacarPositivo: true })],
    []
  )
  const simularAlta = () => {
    const id = nextId.current++
    setFilas((fs) => [{ ...CLIENTES[(id - 1000) % CLIENTES.length], id, nombre: `Cliente nuevo ${id - 999}` }, ...fs])
    resaltar(id)
    notify.success('Cliente registrado', { action: { label: 'Ver', href: '#carga' } })
  }
  return (
    <Demo label="Éxito: se cierra el modal, el ítem se resalta 2 s y aparece el toast con «Ver»">
      <Box>
        <Button variant="contained" onClick={simularAlta}>
          Simular alta
        </Button>
      </Box>
      <AppDataGrid<ClienteDemo>
        tableId="estandares-exito"
        label="Clientes recién creados"
        rows={filas}
        columns={columns}
        searchable={false}
        highlightId={idResaltado}
        emptyState={{ title: 'Sin clientes' }}
      />
    </Demo>
  )
}

function OperacionLarga() {
  const loader = useGlobalLoader()
  const notify = useNotify()
  const [visible, setVisible] = React.useState(true)
  return (
    <Demo
      label={`Operación larga (> 1 s): loader global, aparece a los ${TIEMPOS.LOADER_RETARDO_MS} ms y dura al menos ${TIEMPOS.LOADER_MINIMO_MS} ms`}
    >
      <Box sx={{ position: 'relative', height: 300, borderRadius: '8px', overflow: 'hidden', border: 1, borderColor: 'divider' }}>
        <BrandLoader open={visible} message="Generando contrato…" position="contained" />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button variant="outlined" onClick={() => setVisible((v) => !v)}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </Button>
        <Button
          variant="outlined"
          onClick={async () => {
            await loader.run(() => wait(1500), 'Generando contrato…')
            notify.success('Contrato generado')
          }}
        >
          Probar sobre la página
        </Button>
        <Button
          onClick={async () => {
            await loader.run(() => wait(100))
            notify.info('Terminó en 100 ms: el loader no apareció')
          }}
        >
          Operación rápida
        </Button>
      </Box>
    </Demo>
  )
}

export function CargaFeedback() {
  return (
    <Seccion
      id="carga"
      titulo="Carga y feedback"
      descripcion="Una sola señal por nivel: navegación, página, sección, refresco, acción en curso, éxito, error y operación larga (artboard 4)."
    >
      <Apartado titulo="Niveles de carga">
        <Niveles />
      </Apartado>
      <Apartado titulo="Acción, éxito y error">
        <Acciones />
        <Exito />
      </Apartado>
      <Apartado titulo="Operación larga">
        <OperacionLarga />
      </Apartado>
    </Seccion>
  )
}
