'use client'

import * as React from 'react'
import { Controller, useForm } from 'react-hook-form'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import Paper from '@mui/material/Paper'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import type { GridColDef } from '@mui/x-data-grid'
import { BrandMark } from '@/components/atoms/BrandMark'
import { NavigationProgress } from '@/components/atoms/NavigationProgress'
import { NumberField } from '@/components/atoms/NumberField'
import { PhoneField } from '@/components/atoms/PhoneField'
import { RifCiField } from '@/components/atoms/RifCiField'
import { PeneroStripes } from '@/components/atoms/PeneroStripes'
import { PageHeader } from '@/components/molecules/PageHeader'
import { FormSection } from '@/components/molecules/FormSection'
import { RowActionsMenu } from '@/components/molecules/RowActionsMenu'
import {
  AppDataGrid,
  normalizarBusquedaSinSeparadores,
  type AppDataGridQuery,
} from '@/components/organisms/AppDataGrid'
import { AppDialog, type AppDialogSize } from '@/components/organisms/AppDialog'
import {
  EstadoChip,
  colAcciones,
  colEstado,
  colFecha,
  colMonto,
} from '@/components/organisms/appDataGridColumns'
import { BrandLoader } from '@/components/organisms/BrandLoader'
import { useTheme } from '@mui/material/styles'
import { BarChart } from '@mui/x-charts/BarChart'
import { KpiCard } from '@/components/molecules/KpiCard'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ChartLegendTable } from '@/components/molecules/ChartLegendTable'
import { RangoFechasSelector } from '@/components/molecules/RangoFechasSelector'
import { coloresGrafico } from '@/lib/dashboard/chartColors'
import { rangoDesdePreset } from '@/lib/dashboard/rangos'
import { fechaHoy, formatKg } from '@/lib/format'
import { formatUsd } from '@/lib/format'
import { useGlobalLoader } from '@/lib/useGlobalLoader'
import { useNotify } from '@/lib/useNotify'

/* ---------- datos de muestra (ficticios) ---------- */

interface ClienteDemo {
  id: number
  nombre: string
  rif: string
  telefono: string
  limite: number | null
  estado: 'activo' | 'bloqueado' | 'inactivo'
  alta: string
}

const NOMBRES = [
  'Restaurante El Muelle',
  'Hotel Bahía Azul',
  'Marisquería Los Roques',
  'Pescadería Margarita',
  'Supermercado El Faro',
  'Doña María',
  'Posada La Ensenada',
  'Club Náutico Puerto Azul',
]

const CLIENTES: ClienteDemo[] = Array.from({ length: 64 }, (_, i) => ({
  id: i + 1,
  nombre: `${NOMBRES[i % NOMBRES.length]}${i >= NOMBRES.length ? ` ${Math.floor(i / NOMBRES.length) + 1}` : ''}`,
  rif: `J-${String(30000000 + i * 7919).slice(0, 8)}-${i % 10}`,
  telefono: `0414-${String(5550000 + i * 13).slice(0, 7)}`,
  limite: i % 5 === 4 ? null : 500 + ((i * 375) % 5000),
  estado: i % 9 === 2 ? 'bloqueado' : i % 11 === 6 ? 'inactivo' : 'activo',
  alta: `2026-${String((i % 9) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
}))

const ESTADOS = {
  activo: { label: 'Activo', color: 'success' },
  bloqueado: { label: 'Bloqueado', color: 'error' },
  inactivo: { label: 'Inactivo', color: 'default' },
} as const

/* ---------- utilidades de la página ---------- */

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Box component="section" sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '75ch', mt: 0.5 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Box>
  )
}

function Demo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2.5, display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Paper>
  )
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ---------- secciones ---------- */

function MarcaSection() {
  return (
    <Section
      title="Marca y tipografía"
      description="Isotipo provisional hasta tener el logo real. La borda es el único elemento decorativo."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="BrandMark: full, isotipo y vertical">
          <div className="flex flex-wrap items-center gap-6">
            <BrandMark />
            <BrandMark variant="isotipo" size={34} />
            <BrandMark orientation="vertical" size={72} />
          </div>
          <PeneroStripes />
        </Demo>
        <Demo label="Escala tipográfica">
          <Typography variant="h4">h4 · Título de página</Typography>
          <Typography variant="h5">h5 · Cifra protagonista {formatUsd(12480.5)}</Typography>
          <Typography variant="h6">h6 · Título de sección</Typography>
          <Typography variant="subtitle1">subtitle1 · Nombre en una fila</Typography>
          <Typography variant="body1">body1 · Texto corrido de alertas y descripciones.</Typography>
          <Typography variant="body2">body2 · Tablas, formularios y menús.</Typography>
          <Typography variant="caption">caption · Ayudas y RIF bajo el nombre</Typography>
          <Box sx={{ display: 'grid', justifyItems: 'end', fontVariantNumeric: 'tabular-nums' }}>
            <Typography variant="body2">{formatUsd(1500)}</Typography>
            <Typography variant="body2">{formatUsd(111.11)}</Typography>
            <Typography variant="body2">{formatUsd(98765.43)}</Typography>
          </Box>
        </Demo>
      </div>
    </Section>
  )
}

function LoadersSection() {
  const globalLoader = useGlobalLoader()
  const notify = useNotify()
  const [showLoader, setShowLoader] = React.useState(true)

  return (
    <Section
      title="Loaders"
      description="Global con logo (aparece a los 150 ms, dura al menos 400 ms), navegación con la borda de 3 px y refresco de tabla."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="1. Global con logo (contenido)">
          <Box
            sx={{
              position: 'relative',
              height: 300,
              borderRadius: 2,
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <BrandLoader open={showLoader} message="Generando contrato" position="contained" />
          </Box>
          <div className="flex flex-wrap gap-2">
            <Button variant="outlined" onClick={() => setShowLoader((v) => !v)}>
              {showLoader ? 'Ocultar' : 'Mostrar'}
            </Button>
            <Button
              variant="outlined"
              onClick={async () => {
                await globalLoader.run(() => wait(1500), 'Generando contrato')
                notify.success('Contrato generado')
              }}
            >
              Probar pantalla completa
            </Button>
            <Button
              variant="text"
              onClick={async () => {
                await globalLoader.run(() => wait(100))
                notify.info('Terminó en 100 ms: el loader no apareció')
              }}
            >
              Operación rápida
            </Button>
          </div>
        </Demo>
        <Demo label="2. Navegación (barra de 3 px)">
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <NavigationProgress active />
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                En el shell corre bajo la barra superior al navegar desde el menú y mientras se ve
                el skeleton de un loading.tsx.
              </Typography>
            </Box>
          </Box>
        </Demo>
      </div>
    </Section>
  )
}

function BotonesSection() {
  const [loading, setLoading] = React.useState(true)
  return (
    <Section
      title="Botones y acciones en curso"
      description="Un solo contained por vista. Toda acción asíncrona usa la prop loading."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="Jerarquía y estado de carga">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="contained">Registrar abono</Button>
            <Button variant="outlined">Exportar</Button>
            <Button>Cancelar</Button>
            <Button color="error" variant="outlined">
              Desactivar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="contained" loading={loading}>
              Registrar abono
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveOutlinedIcon />}
              loadingPosition="start"
              loading={loading}
            >
              Guardar cliente
            </Button>
            <RowActionsMenu
              label="fila en proceso"
              pending={loading}
              actions={[{ label: 'Editar', onClick: () => {} }]}
            />
          </div>
          <FormControlLabel
            control={<Switch checked={loading} onChange={(e) => setLoading(e.target.checked)} />}
            label="En curso"
          />
        </Demo>
        <Demo label="Chips de estado (soft, 22 px)">
          <div className="flex flex-wrap gap-2">
            <EstadoChip label="Activo" color="success" />
            <EstadoChip label="Por vencer" color="warning" />
            <EstadoChip label="Bloqueado" color="error" />
            <EstadoChip label="Pendiente" color="info" />
            <EstadoChip label="Inactivo" color="default" />
            <Chip size="small" label="Chip normal" />
          </div>
        </Demo>
      </div>
    </Section>
  )
}

type TablaEstado = 'datos' | 'vacia' | 'cargando' | 'error' | 'servidor'

function TablasSection() {
  const notify = useNotify()
  const [estado, setEstado] = React.useState<TablaEstado>('datos')
  const [serverRows, setServerRows] = React.useState<ClienteDemo[]>(CLIENTES.slice(0, 25))
  const [serverCount, setServerCount] = React.useState(CLIENTES.length)
  const [serverLoading, setServerLoading] = React.useState(false)
  const requestRef = React.useRef(0)

  const columns = React.useMemo<GridColDef<ClienteDemo>[]>(
    () => [
      { field: 'nombre', headerName: 'Cliente', flex: 2, minWidth: 200 },
      { field: 'rif', headerName: 'RIF', flex: 1, minWidth: 130 },
      { field: 'telefono', headerName: 'Teléfono', flex: 1, minWidth: 130 },
      colMonto<ClienteDemo>('limite', 'Límite de crédito', { flex: 1 }),
      colFecha<ClienteDemo>('alta', 'Alta'),
      colEstado<ClienteDemo>('estado', 'Estado', ESTADOS),
      colAcciones<ClienteDemo>(
        (row) => [
          {
            label: 'Editar',
            icon: <EditOutlinedIcon fontSize="small" />,
            onClick: () => notify.info(`Editar ${row.nombre}`),
          },
          {
            label: 'Bloquear',
            icon: <BlockOutlinedIcon fontSize="small" />,
            destructive: true,
            onClick: () => notify.info(`Bloquear ${row.nombre}`),
          },
        ],
        { rowLabel: (row) => row.nombre }
      ),
    ],
    [notify]
  )

  // Simula `.range()` + `count: 'exact'` con 600 ms de latencia.
  const onQueryChange = React.useCallback(async (q: AppDataGridQuery) => {
    const id = ++requestRef.current
    setServerLoading(true)
    await wait(600)
    if (id !== requestRef.current) return
    const tokens = q.search.toLowerCase()
    let data = CLIENTES.filter((c) => !tokens || c.nombre.toLowerCase().includes(tokens))
    const sort = q.sort[0]
    if (sort) {
      const k = sort.field as keyof ClienteDemo
      data = [...data].sort(
        (a, b) =>
          String(a[k] ?? '').localeCompare(String(b[k] ?? ''), 'es', { numeric: true }) *
          (sort.sort === 'desc' ? -1 : 1)
      )
    }
    setServerCount(data.length)
    setServerRows(data.slice(q.page * q.pageSize, (q.page + 1) * q.pageSize))
    setServerLoading(false)
  }, [])

  const rows =
    estado === 'vacia' || estado === 'cargando' ? [] : estado === 'servidor' ? serverRows : CLIENTES

  return (
    <Section
      title="Tablas (AppDataGrid)"
      description="Cambia el estado para ver vacío, cargando, error y paginación en servidor. En 375 px las filas pasan a tarjetas. La búsqueda ignora acentos, espacios, puntos y guiones («j30007919» encuentra «J-30007919-1») y Enter sobre una celda con foco abre la fila."
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={estado}
        onChange={(_, v: TablaEstado | null) => v && setEstado(v)}
        aria-label="Estado de la tabla de muestra"
        sx={{ flexWrap: 'wrap' }}
      >
        <ToggleButton value="datos">Con datos</ToggleButton>
        <ToggleButton value="vacia">Vacía</ToggleButton>
        <ToggleButton value="cargando">Cargando</ToggleButton>
        <ToggleButton value="error">Error</ToggleButton>
        <ToggleButton value="servidor">Servidor</ToggleButton>
      </ToggleButtonGroup>
      <AppDataGrid<ClienteDemo>
        key={estado === 'servidor' ? 'servidor' : 'cliente'}
        tableId="estandares-clientes"
        label="Clientes de muestra"
        rows={rows}
        columns={columns}
        mode={estado === 'servidor' ? 'server' : 'client'}
        rowCount={serverCount}
        onQueryChange={onQueryChange}
        loading={estado === 'cargando' || (estado === 'servidor' && serverLoading)}
        error={
          estado === 'error'
            ? 'No se pudieron cargar los clientes. Revisa tu conexión e intenta de nuevo.'
            : null
        }
        onRetry={() => setEstado('datos')}
        searchPlaceholder="Buscar por nombre, RIF o teléfono"
        normalizeSearch={normalizarBusquedaSinSeparadores}
        getSearchValues={(row) => [row.nombre, row.rif, row.telefono]}
        filters={
          <>
            <Chip label="Activos" color="primary" variant="outlined" onClick={() => {}} />
            <Chip label="Con facturas vencidas" variant="outlined" onClick={() => {}} />
          </>
        }
        actions={
          <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => notify.info('Exportar')}>
            Exportar
          </Button>
        }
        emptyState={{
          icon: <PeopleOutlinedIcon fontSize="large" />,
          title: 'Aún no hay clientes',
          description: 'Registra el primero para empezar a venderle a crédito.',
          action: (
            <Button variant="contained" startIcon={<AddOutlinedIcon />}>
              Nuevo cliente
            </Button>
          ),
        }}
        hideOnMobile={['telefono', 'alta']}
        mobileCard={(row) => ({
          primary: row.nombre,
          secondary: row.rif,
          status: row.estado !== 'activo' ? <EstadoChip {...ESTADOS[row.estado]} /> : undefined,
          amount: row.limite === null ? undefined : formatUsd(row.limite),
          actions: (
            <RowActionsMenu
              label={row.nombre}
              actions={[{ label: 'Editar', onClick: () => notify.info(`Editar ${row.nombre}`) }]}
            />
          ),
        })}
      />
    </Section>
  )
}

interface DemoFormValues {
  monto: number | null
  referencia: string
}

function DialogosSection() {
  const notify = useNotify()
  const [open, setOpen] = React.useState<AppDialogSize | null>(null)
  const [isPending, startTransition] = React.useTransition()
  const [fallar, setFallar] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const { control, register, handleSubmit, reset, formState } = useForm<DemoFormValues>({
    mode: 'onSubmit',
    defaultValues: { monto: null, referencia: '' },
    disabled: isPending,
  })

  const close = () => {
    setOpen(null)
    setError(null)
    reset()
  }

  const onSubmit = handleSubmit(() => {
    if (isPending) return
    setError(null)
    startTransition(async () => {
      await wait(1500)
      if (fallar) {
        setError(
          'No se pudo registrar el abono: la factura ya está pagada. Actualiza la página y revisa el saldo.'
        )
        return
      }
      notify.success('Abono registrado')
      close()
    })
  })

  return (
    <Section
      title="Diálogos (AppDialog)"
      description="xs 400 px, sm 600 px y md 900 px. En 375 px, sm y md van a pantalla completa."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outlined" onClick={() => setOpen('xs')}>
          Abrir xs
        </Button>
        <Button variant="outlined" onClick={() => setOpen('sm')}>
          Abrir sm
        </Button>
        <Button variant="outlined" onClick={() => setOpen('md')}>
          Abrir md (formulario)
        </Button>
        <FormControlLabel
          control={<Switch checked={fallar} onChange={(e) => setFallar(e.target.checked)} />}
          label="Simular error del servidor"
        />
      </div>

      <AppDialog
        open={open === 'xs'}
        onClose={close}
        size="xs"
        title="Bloquear cliente"
        subtitle="Restaurante El Muelle"
        primaryAction={
          <Button variant="contained" color="error" onClick={close}>
            Bloquear
          </Button>
        }
      >
        <TextField label="Motivo *" fullWidth multiline minRows={2} />
      </AppDialog>

      <AppDialog
        open={open === 'sm'}
        onClose={close}
        size="sm"
        title="Nuevo producto"
        primaryAction={
          <Button variant="contained" onClick={close}>
            Crear producto
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nombre *" fullWidth />
          <TextField label="Categoría" fullWidth />
        </div>
      </AppDialog>

      <AppDialog
        open={open === 'md'}
        onClose={close}
        size="md"
        title="Registrar abono"
        subtitle="Factura 0123 · Restaurante El Muelle"
        onSubmit={onSubmit}
        pending={isPending}
        dirty={formState.isDirty}
        error={error}
        primaryAction={
          <Button type="submit" variant="contained" loading={isPending}>
            Registrar abono
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="monto"
            render={({ field }) => (
              <NumberField
                label="Monto *"
                prefix="$"
                fullWidth
                value={field.value}
                onChange={field.onChange}
                disabled={field.disabled}
              />
            )}
          />
          <TextField label="Referencia" fullWidth {...register('referencia')} />
        </div>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, maxWidth: '75ch' }}>
          Escribe algo y cierra con Esc para ver la confirmación de descartar. Durante el guardado
          no se puede cerrar ni editar.
        </Typography>
      </AppDialog>
    </Section>
  )
}

function FormulariosSection() {
  const [rif, setRif] = React.useState('')
  const [telefono, setTelefono] = React.useState('')
  const [monto, setMonto] = React.useState<number | null>(1500.5)
  const [dias, setDias] = React.useState<number | null>(null)

  return (
    <Section
      title="Formularios"
      description="Secciones con FormSection (divisor de 1 px salvo la primera), inputs size=&quot;small&quot; y máscaras de entrada: NumberField bloquea letras en vivo, PhoneField formatea 0414-1234567 y RifCiField fuerza V-/E-/J-/G-. La validación de fondo sigue siendo del esquema zod al enviar."
    >
      <Box sx={{ display: 'grid', gap: 2, maxWidth: 640 }}>
        <FormSection titulo="Identificación" primera>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <RifCiField
              label="Cédula o RIF"
              size="small"
              fullWidth
              value={rif}
              onChange={setRif}
              placeholder="V-12345678"
            />
            <PhoneField
              label="Teléfono"
              size="small"
              fullWidth
              value={telefono}
              onChange={setTelefono}
              placeholder="0414-1234567"
            />
          </Box>
        </FormSection>
        <FormSection titulo="Montos" ayuda="Prueba escribir letras: no aparecen.">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <NumberField
              label="Límite de crédito (USD)"
              prefix="$"
              size="small"
              fullWidth
              value={monto}
              onChange={setMonto}
            />
            <NumberField
              label="Días de crédito"
              suffix="días"
              decimals={0}
              size="small"
              fullWidth
              value={dias}
              onChange={setDias}
              placeholder="Por defecto: 15"
            />
          </Box>
        </FormSection>
      </Box>
    </Section>
  )
}

const VENTAS_DEMO = [
  { mes: 'May', usd: 4200, kg: 610 },
  { mes: 'Jun', usd: 5100, kg: 702 },
  { mes: 'Jul', usd: 4800, kg: 655 },
  { mes: 'Ago', usd: 6300, kg: 880 },
  { mes: 'Sep', usd: 5900, kg: 812 },
  { mes: 'Oct', usd: 2100, kg: 290 },
]

/** Molecules del dashboard (15) y una gráfica de prueba de `@mui/x-charts` (D1). */
function DashboardSection() {
  const theme = useTheme()
  const colores = coloresGrafico(theme)
  const hoy = fechaHoy()
  return (
    <Section
      title="Dashboard: indicadores y gráficas"
      description="KpiCard (cifra h5 tabular, acento de estado, enlace opcional), ChartCard con sus estados, ChartLegendTable como alternativa accesible y RangoFechasSelector (escribe ?desde/?hasta; en xs, Select + diálogo). Colores de las gráficas solo desde theme.palette."
    >
      <RangoFechasSelector rango={rangoDesdePreset('mes_en_curso', hoy)} hoy={hoy} />
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <KpiCard title="Ventas del día" value={formatUsd(1280.5)} secondary={`${formatKg(212.4)} · 6 facturas`} />
        <KpiCard title="CxC vencida" value={formatUsd(840)} secondary="3 clientes con vencidas" tone="error" href="/cobros" />
        <KpiCard title="Stock bajo" value="2 productos" secondary="Umbral 20,000 kg" tone="warning" />
        <KpiCard title="Cargando" loading />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Ventas por mes (prueba)" help="Barras con colores del theme; revisa claro y oscuro.">
          <BarChart
            height={240}
            dataset={VENTAS_DEMO}
            xAxis={[{ scaleType: 'band', dataKey: 'mes' }]}
            yAxis={[{ valueFormatter: (v: number) => formatUsd(v), width: 72 }]}
            series={[{ dataKey: 'usd', label: 'Ventas USD', color: colores.usd, valueFormatter: (v) => formatUsd(v ?? 0) }]}
            aria-label="Gráfica de prueba: ventas por mes en USD"
          />
          <ChartLegendTable
            caption="Ventas por mes"
            rows={VENTAS_DEMO}
            getRowKey={(r) => r.mes}
            columns={[
              { key: 'mes', label: 'Mes', render: (r) => r.mes },
              { key: 'usd', label: 'Ventas', align: 'right', render: (r) => formatUsd(r.usd) },
              { key: 'kg', label: 'Kilos', align: 'right', render: (r) => formatKg(r.kg) },
            ]}
          />
        </ChartCard>
        <div className="grid gap-4">
          <ChartCard title="Sin datos" empty emptyDescription="EmptyState compact dentro de la tarjeta." />
          <ChartCard title="Con error" error="No se pudo cargar la merma por procesos." />
          <ChartCard title="Cargando" loading skeletonHeight={80} />
        </div>
      </div>
    </Section>
  )
}

export function EstandaresScreen() {
  const notify = useNotify()
  return (
    <>
      <PageHeader
        title="Estándares UI"
        subtitle="Muestra de los componentes base y sus estados. Revisa claro/oscuro y 375 px."
        primaryAction={{
          label: 'Nuevo cliente',
          icon: <AddOutlinedIcon />,
          onClick: () => notify.info('Acción principal (Fab en xs)'),
        }}
        secondaryActions={[
          {
            label: 'Exportar',
            icon: <FileDownloadOutlinedIcon />,
            onClick: () => notify.info('Acción secundaria (menú ⋮ en xs)'),
          },
        ]}
      />
      <div className="grid gap-8 pb-20 sm:pb-0">
        <MarcaSection />
        <LoadersSection />
        <BotonesSection />
        <TablasSection />
        <DialogosSection />
        <FormulariosSection />
        <DashboardSection />
      </div>
    </>
  )
}
