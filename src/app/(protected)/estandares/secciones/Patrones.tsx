'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import type { GridColDef } from '@mui/x-data-grid'
import { DateField } from '@/components/atoms/DateField'
import { EstadoChip } from '@/components/atoms/EstadoChip'
import { NumberField } from '@/components/atoms/NumberField'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { SubmitButton } from '@/components/atoms/SubmitButton'
import { CarteraResumenCards } from '@/components/molecules/CarteraResumenCards'
import { CreditoResumen } from '@/components/molecules/CreditoResumen'
import { DocumentoUpload } from '@/components/molecules/DocumentoUpload'
import { FichaHeader } from '@/components/molecules/FichaHeader'
import { FichaDato, FichaDatos, FichaSeccion } from '@/components/molecules/FichaSeccion'
import { FilterMenuButton } from '@/components/molecules/FilterMenuButton'
import { FormGrid } from '@/components/molecules/FormGrid'
import { FormSection } from '@/components/molecules/FormSection'
import { FormSubgroup } from '@/components/molecules/FormSubgroup'
import { LineasEditor } from '@/components/molecules/LineasEditor'
import { RowActionsMenu } from '@/components/molecules/RowActionsMenu'
import {
  AppDataGrid,
  estadosTabla,
  normalizarBusquedaSinSeparadores,
  type AppDataGridQuery,
} from '@/components/organisms/AppDataGrid'
import { AppDialog, type AppDialogSize } from '@/components/organisms/AppDialog'
import {
  colAcciones,
  colEstado,
  colFecha,
  colMonto,
  colPrincipal,
} from '@/components/organisms/appDataGridColumns'
import type { EstadoCartera } from '@/lib/cartera/types'
import type { DocumentoItem, DocumentoStore } from '@/lib/documentoStore'
import { formatUsd } from '@/lib/format'
import { useNotify } from '@/lib/useNotify'
import { ESPACIO } from '@/theme/tokens'
import { Apartado, CLIENTES, Demo, Demos, ESTADOS_CLIENTE, Seccion, wait, type ClienteDemo } from './comun'

/* ---------- listado (artboard 2) ---------- */

type FiltroEstado = 'todos' | ClienteDemo['estado']
type Modo = 'cliente' | 'servidor'

function Listado() {
  const notify = useNotify()
  const [estado, setEstado] = React.useState<FiltroEstado>('todos')
  const [conSaldo, setConSaldo] = React.useState<string | null>(null)
  const [modo, setModo] = React.useState<Modo>('cliente')
  const [serverRows, setServerRows] = React.useState<ClienteDemo[]>(CLIENTES.slice(0, 25))
  const [serverCount, setServerCount] = React.useState(CLIENTES.length)
  const [serverLoading, setServerLoading] = React.useState(false)
  const requestRef = React.useRef(0)

  const contar = (e: FiltroEstado) => (e === 'todos' ? CLIENTES.length : CLIENTES.filter((c) => c.estado === e).length)
  const filtrados = CLIENTES.filter(
    (c) => (estado === 'todos' || c.estado === estado) && (conSaldo !== 'si' || c.saldo > 0)
  )
  const hayFiltros = estado !== 'todos' || conSaldo !== null

  const columns = React.useMemo<GridColDef<ClienteDemo>[]>(
    () => [
      colPrincipal<ClienteDemo>({ field: 'nombre', headerName: 'Cliente', secundario: (r) => r.rif }),
      { field: 'telefono', headerName: 'Teléfono', minWidth: 140 },
      colMonto<ClienteDemo>('limite', 'Límite'),
      colMonto<ClienteDemo>('saldo', 'Saldo', { destacarPositivo: true }),
      colFecha<ClienteDemo>('alta', 'Alta'),
      colEstado<ClienteDemo>('estado', 'Estado', ESTADOS_CLIENTE, {
        // Solo las excepciones llevan chip.
        renderCell: ({ row }) =>
          row.estado === 'activo' ? 'Activo' : <EstadoChip {...ESTADOS_CLIENTE[row.estado]} />,
      }),
      colAcciones<ClienteDemo>(
        (row) => [
          { label: 'Editar', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => notify.info(`Editar ${row.nombre}`) },
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
    const t = q.search.toLowerCase()
    const data = CLIENTES.filter((c) => !t || c.nombre.toLowerCase().includes(t))
    setServerCount(data.length)
    setServerRows(data.slice(q.page * q.pageSize, (q.page + 1) * q.pageSize))
    setServerLoading(false)
  }, [])

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <SegmentedControl
        aria-label="Modo de la tabla de muestra"
        size="small"
        value={modo}
        onChange={setModo}
        options={[
          { value: 'cliente', label: 'En el navegador' },
          { value: 'servidor', label: 'Paginada en servidor' },
        ]}
        sx={{ justifySelf: 'start' }}
      />
      <AppDataGrid<ClienteDemo>
        key={modo}
        tableId="estandares-clientes"
        label="Clientes de muestra"
        rows={modo === 'servidor' ? serverRows : filtrados}
        columns={columns}
        mode={modo === 'servidor' ? 'server' : 'client'}
        rowCount={serverCount}
        onQueryChange={onQueryChange}
        loading={modo === 'servidor' && serverLoading}
        searchPlaceholder="Buscar por nombre, RIF o teléfono"
        normalizeSearch={normalizarBusquedaSinSeparadores}
        getSearchValues={(row) => [row.nombre, row.rif, row.telefono]}
        estados={
          modo === 'cliente'
            ? estadosTabla<FiltroEstado>({
                value: estado,
                onChange: setEstado,
                options: [
                  { value: 'todos', label: 'Todos', count: contar('todos') },
                  { value: 'activo', label: 'Activos', count: contar('activo') },
                  { value: 'bloqueado', label: 'Bloqueados', count: contar('bloqueado') },
                  { value: 'inactivo', label: 'Inactivos', count: contar('inactivo') },
                ],
              })
            : undefined
        }
        filters={
          modo === 'cliente' ? (
            <FilterMenuButton
              label="Saldo"
              value={conSaldo}
              onChange={setConSaldo}
              options={[{ value: 'si', label: 'Con saldo pendiente' }]}
            />
          ) : undefined
        }
        onClearFilters={
          hayFiltros
            ? () => {
                setEstado('todos')
                setConSaldo(null)
              }
            : undefined
        }
        actions={
          <Button startIcon={<FileDownloadOutlinedIcon />} onClick={() => notify.info('Exportar')}>
            Exportar
          </Button>
        }
        emptyState={{
          icon: <PeopleOutlinedIcon />,
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
          amount: row.saldo > 0 ? formatUsd(row.saldo) : undefined,
          actions: (
            <RowActionsMenu label={row.nombre} actions={[{ label: 'Editar', onClick: () => notify.info(`Editar ${row.nombre}`) }]} />
          ),
        })}
      />
    </Box>
  )
}

/* ---------- formulario en modal (artboard 3) ---------- */

interface LineaDemo {
  id: number
  producto: string
  peso: number | null
  costo: number | null
}

const PRODUCTOS = ['Pargo rojo', 'Mero', 'Camarón 31/35', 'Calamar', 'Atún']

function FormularioModal({ size, onClose }: { size: AppDialogSize; onClose: () => void }) {
  const notify = useNotify()
  const [pending, setPending] = React.useState(false)
  const [fallar, setFallar] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  // Cualquier cambio marca el formulario: cerrar pide «¿Descartar cambios?».
  const [tocado, setTocado] = React.useState(false)
  const [fecha, setFecha] = React.useState<string | null>('2026-10-30')
  const [moneda, setMoneda] = React.useState<'usd' | 'bs'>('usd')
  const [tasa, setTasa] = React.useState<number | null>(48.25)
  const [lineas, setLineas] = React.useState<LineaDemo[]>([
    { id: 1, producto: 'Pargo rojo', peso: 12.5, costo: 6.8 },
    { id: 2, producto: 'Camarón 31/35', peso: 4, costo: 11.2 },
  ])
  const nextId = React.useRef(3)
  const total = lineas.reduce((s, l) => s + (l.peso ?? 0) * (l.costo ?? 0), 0)

  const cambiar = (i: number, cambio: Partial<LineaDemo>) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambio } : l)))

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) return
    setError(null)
    setPending(true)
    await wait(1500)
    setPending(false)
    if (fallar) {
      setError('No se pudo registrar la compra: el proveedor está bloqueado. Revisa la ficha del proveedor.')
      return
    }
    notify.success('Compra registrada', { action: { label: 'Ver', href: '#patrones' } })
    onClose()
  }

  return (
    <AppDialog
      open
      onClose={onClose}
      size={size}
      title="Registrar compra"
      subtitle="Proveedor: Pesquera La Restinga"
      onSubmit={guardar}
      pending={pending}
      dirty={tocado}
      error={error}
      onRetry={() => {
        setFallar(false)
        setError(null)
      }}
      secondaryActions={
        <FormControlLabel
          control={<Switch size="small" checked={fallar} onChange={(e) => setFallar(e.target.checked)} />}
          label={<Typography variant="body2">Simular error</Typography>}
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        />
      }
      primaryAction={
        <SubmitButton pending={pending} pendingLabel="Registrando…">
          Registrar compra
        </SubmitButton>
      }
    >
      <Box
        sx={{ display: 'grid', gap: ESPACIO.formSecciones }}
        onChangeCapture={() => setTocado(true)}
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest('button')) setTocado(true)
        }}
      >
        <FormSection titulo="Datos de la compra" ayuda="La fecha es la de la factura del proveedor.">
          <FormGrid>
            <DateField label="Fecha *" size="small" fullWidth value={fecha} onChange={setFecha} disabled={pending} />
            <TextField label="N.º de factura" size="small" fullWidth disabled={pending} />
            <FormGrid.Full>
              <TextField label="Notas" size="small" fullWidth multiline minRows={2} disabled={pending} />
            </FormGrid.Full>
          </FormGrid>
        </FormSection>

        <FormSection titulo="Pago">
          <FormSubgroup etiqueta="Moneda y tasa">
            <FormGrid>
              <SegmentedControl
                aria-label="Moneda de la compra"
                value={moneda}
                onChange={setMoneda}
                disabled={pending}
                options={[
                  { value: 'usd', label: 'USD' },
                  { value: 'bs', label: 'Bs' },
                ]}
              />
              <NumberField label="Tasa (Bs/USD)" size="small" fullWidth decimals={2} value={tasa} onChange={setTasa} disabled={pending} />
            </FormGrid>
          </FormSubgroup>
        </FormSection>

        <FormSection titulo="Productos">
          <LineasEditor<LineaDemo>
            columnas={[
              { key: 'producto', label: 'Producto', width: 'minmax(0, 2fr)' },
              { key: 'peso', label: 'Peso (kg)', width: 'minmax(0, 1fr)', align: 'right' },
              { key: 'costo', label: 'Costo por kg', width: 'minmax(0, 1fr)', align: 'right' },
            ]}
            filas={lineas}
            disabled={pending}
            onAgregar={() => setLineas((ls) => [...ls, { id: nextId.current++, producto: '', peso: null, costo: null }])}
            onQuitar={(i) => setLineas((ls) => ls.filter((_, j) => j !== i))}
            renderCelda={(fila, col, i) =>
              col.key === 'producto' ? (
                <TextField
                  select
                  label="Producto"
                  size="small"
                  fullWidth
                  value={fila.producto}
                  onChange={(e) => cambiar(i, { producto: e.target.value })}
                  disabled={pending}
                >
                  {PRODUCTOS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p}
                    </MenuItem>
                  ))}
                </TextField>
              ) : col.key === 'peso' ? (
                <NumberField label="Peso (kg)" suffix="kg" decimals={3} size="small" fullWidth value={fila.peso} onChange={(v) => cambiar(i, { peso: v })} disabled={pending} />
              ) : (
                <NumberField label="Costo por kg" prefix="$" size="small" fullWidth value={fila.costo} onChange={(v) => cambiar(i, { costo: v })} disabled={pending} />
              )
            }
            totales={
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">
                  Total
                </Typography>
                <Typography variant="h5" component="p">
                  {formatUsd(total)}
                </Typography>
              </Box>
            }
          />
        </FormSection>
      </Box>
    </AppDialog>
  )
}

function ModalSimple({ size, onClose }: { size: AppDialogSize; onClose: () => void }) {
  return (
    <AppDialog
      open
      onClose={onClose}
      size={size}
      title={size === 'xs' ? 'Bloquear cliente' : size === 'sm' ? 'Nuevo producto' : 'Nuevo proveedor'}
      subtitle={size === 'xs' ? 'Restaurante El Muelle' : undefined}
      primaryAction={
        <Button variant="contained" color={size === 'xs' ? 'error' : 'primary'} onClick={onClose}>
          {size === 'xs' ? 'Bloquear' : 'Guardar'}
        </Button>
      }
    >
      {size === 'xs' ? (
        <TextField label="Motivo *" size="small" fullWidth multiline minRows={2} />
      ) : (
        <Box sx={{ display: 'grid', gap: ESPACIO.formSecciones }}>
          <FormSection titulo="Identificación">
            <FormGrid>
              <TextField label="Nombre *" size="small" fullWidth />
              <TextField label="Categoría" size="small" fullWidth />
            </FormGrid>
          </FormSection>
          {size === 'md' ? (
            <FormSection titulo="Contacto">
              <FormGrid>
                <TextField label="Teléfono" size="small" fullWidth />
                <TextField label="Correo" size="small" fullWidth />
              </FormGrid>
            </FormSection>
          ) : null}
        </Box>
      )}
    </AppDialog>
  )
}

function Formularios() {
  const [abierto, setAbierto] = React.useState<{ size: AppDialogSize; tipo: 'simple' | 'compra' } | null>(null)
  const cerrar = () => setAbierto(null)
  return (
    <Demos>
      <Demo label="Formulario con líneas en modal lg (pantalla completa por debajo de md)">
        <Box>
          <Button variant="contained" onClick={() => setAbierto({ size: 'lg', tipo: 'compra' })}>
            Registrar compra
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary">
          FormSection, FormGrid con un campo a lo ancho, FormSubgroup, SegmentedControl, LineasEditor con totales,
          SubmitButton y error arriba con «Reintentar» (el error está activado; «Reintentar» lo apaga). Con
          cambios, cerrar pide «¿Descartar cambios?»; mientras guarda no se puede cerrar ni editar.
        </Typography>
      </Demo>
      <Demo label="Tamaños: xs 400 · sm 600 · md 900 · lg 1120">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {(['xs', 'sm', 'md'] as const).map((size) => (
            <Button key={size} variant="outlined" onClick={() => setAbierto({ size, tipo: 'simple' })}>
              Abrir {size}
            </Button>
          ))}
          <Button variant="outlined" onClick={() => setAbierto({ size: 'lg', tipo: 'compra' })}>
            Abrir lg
          </Button>
        </Box>
      </Demo>
      {abierto?.tipo === 'compra' ? <FormularioModal size={abierto.size} onClose={cerrar} /> : null}
      {abierto?.tipo === 'simple' ? <ModalSimple size={abierto.size} onClose={cerrar} /> : null}
    </Demos>
  )
}

/* ---------- ficha ---------- */

/** Almacén en memoria para la demo de documentos (no sube nada). */
function crearStoreDemo(): DocumentoStore<'rif' | 'cedula'> {
  let docs: DocumentoItem<'rif' | 'cedula'>[] = [
    { id: 'd1', tipo: 'rif', url_storage: 'demo/rif.pdf', nombre_original: 'RIF-J-30007919-1.pdf', mime_type: 'application/pdf', tamano_bytes: 182_000 },
  ]
  return {
    list: async () => docs,
    getUrl: async () => '#patrones',
    upload: async (file, meta) => {
      await wait(800)
      const item = { id: `d${Date.now()}`, tipo: meta.tipo, url_storage: `demo/${file.name}`, nombre_original: file.name, mime_type: file.type, tamano_bytes: file.size }
      docs = [...docs, item]
      return item
    },
    remove: async (id) => {
      docs = docs.filter((d) => d.id !== id)
    },
  }
}

const RESUMEN = {
  conteo: { vencida: 2, por_vencer: 1, pendiente: 3, pagada: 14, anulada: 1 },
  saldo_usd: 2140,
  saldo_vencido_usd: 840,
  vencida_mas_antigua_dias: 9,
  ultimo_recordatorio: null,
  montos_usd: { vencida: 840, por_vencer: 300, pendiente: 1000, pagada: 9800, anulada: 120 },
}

function Ficha() {
  const notify = useNotify()
  const [filtro, setFiltro] = React.useState<EstadoCartera | null>(null)
  const storeRif = React.useMemo(() => crearStoreDemo(), [])
  const storeCedula = React.useMemo(() => crearStoreDemo(), [])
  return (
    <Box sx={{ display: 'grid', gap: { xs: ESPACIO.bloquesPaginaXs, md: ESPACIO.bloquesPagina } }}>
      <FichaHeader
        backHref="/clientes"
        backLabel="Clientes"
        title="Restaurante El Muelle"
        meta={
          <>
            <span>J-30007919-1</span>
            <span>Persona jurídica</span>
          </>
        }
        primaryAction={{ label: 'Editar cliente', icon: <EditOutlinedIcon />, onClick: () => notify.info('Editar') }}
        menuActions={[{ label: 'Bloquear', destructive: true, onClick: () => notify.info('Bloquear') }]}
      />
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
        <FichaSeccion titulo="Datos">
          <FichaDatos>
            <FichaDato label="Teléfono">0414-5550013</FichaDato>
            <FichaDato label="Correo">compras@elmuelle.com</FichaDato>
            <FichaDato label="Dirección">{''}</FichaDato>
          </FichaDatos>
        </FichaSeccion>
        <CreditoResumen limiteUsd={2000} saldoUsd={2140} />
      </Box>
      <FichaSeccion titulo="Facturas">
        <CarteraResumenCards
          resumen={RESUMEN}
          seleccionado={filtro}
          onSeleccionar={setFiltro}
          label="Resumen de facturas de muestra"
        />
        <Typography variant="body2" color="text.secondary">
          {filtro ? `La tabla se filtraría por «${filtro}».` : 'Toca una tarjeta: es el filtro de la tabla.'}
        </Typography>
      </FichaSeccion>
      <FichaSeccion titulo="Documentos">
        <Box sx={{ display: 'grid', gap: 3 }}>
          <DocumentoUpload store={storeRif} tipo="rif" label="RIF" accept="application/pdf" />
          <DocumentoUpload store={storeCedula} tipo="cedula" label="Cédula del representante" accept="application/pdf" />
        </Box>
      </FichaSeccion>
    </Box>
  )
}

export function Patrones() {
  return (
    <Seccion
      id="patrones"
      titulo="Patrones"
      descripcion="Listado (artboard 2), formulario en modal (artboard 3) y ficha. Un solo patrón de filtro: estado en el segmentado, el resto en menús, el texto en la búsqueda."
    >
      <Apartado titulo="Listado">
        <Listado />
      </Apartado>
      <Apartado titulo="Formulario en modal">
        <Formularios />
      </Apartado>
      <Apartado titulo="Ficha">
        <Ficha />
      </Apartado>
    </Seccion>
  )
}
