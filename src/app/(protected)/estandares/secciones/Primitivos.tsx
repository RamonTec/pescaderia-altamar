'use client'

import * as React from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { DateField } from '@/components/atoms/DateField'
import { EstadoChip } from '@/components/atoms/EstadoChip'
import { NumberField } from '@/components/atoms/NumberField'
import { PhoneField } from '@/components/atoms/PhoneField'
import { RifCiField } from '@/components/atoms/RifCiField'
import { SegmentedControl } from '@/components/atoms/SegmentedControl'
import { SubmitButton } from '@/components/atoms/SubmitButton'
import { FilterMenuButton } from '@/components/molecules/FilterMenuButton'
import { RowActionsMenu } from '@/components/molecules/RowActionsMenu'
import { useNotify } from '@/lib/useNotify'
import { ESPACIO } from '@/theme/tokens'
import { Apartado, Demo, Demos, Seccion, wait } from './comun'

function Botones() {
  const [pending, setPending] = React.useState(false)
  const [enCurso, setEnCurso] = React.useState(false)
  return (
    <Demos>
      <Demo label="Jerarquía: principal, secundario, texto, cancelar · deshabilitado">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Button variant="contained">Registrar abono</Button>
          <Button variant="outlined">Exportar</Button>
          <Button>Ver</Button>
          <Button color="inherit" sx={{ color: 'text.secondary' }}>
            Cancelar
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Button variant="contained" disabled>
            Registrar abono
          </Button>
          <Button variant="outlined" disabled>
            Exportar
          </Button>
          <Button size="small" variant="outlined">
            Pequeño (tablas)
          </Button>
          <Button variant="contained" color="error">
            Eliminar (solo en confirmación)
          </Button>
        </Box>
      </Demo>
      <Demo label="SubmitButton: conserva el ancho, muestra el verbo en curso e ignora el doble clic">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <SubmitButton
            type="button"
            pending={pending}
            pendingLabel="Guardando…"
            onClick={async () => {
              setPending(true)
              await wait(1800)
              setPending(false)
            }}
          >
            Guardar cliente
          </SubmitButton>
          <SubmitButton type="button" pending={enCurso} pendingLabel="Registrando…">
            Registrar compra
          </SubmitButton>
        </Box>
        <FormControlLabel
          control={<Switch checked={enCurso} onChange={(e) => setEnCurso(e.target.checked)} />}
          label="Mantener en curso"
        />
      </Demo>
    </Demos>
  )
}

const CATEGORIAS = ['Pescado', 'Marisco', 'Molusco', 'Crustáceo', 'Procesado']

function Campos() {
  const [rif, setRif] = React.useState('')
  const [telefono, setTelefono] = React.useState('')
  const [monto, setMonto] = React.useState<number | null>(1500.5)
  const [peso, setPeso] = React.useState<number | null>(null)
  const [fecha, setFecha] = React.useState<string | null>('2026-10-30')
  const [categoria, setCategoria] = React.useState('Pescado')
  const [autocompletar, setAutocompletar] = React.useState<string | null>(null)

  return (
    <Demos>
      <Demo label="Etiqueta fija arriba (DS-1), 40 px, ayuda y error a 6 px del campo">
        <Box sx={{ display: 'grid', gap: ESPACIO.formCampoVertical }}>
          <TextField label="Nombre *" size="small" fullWidth defaultValue="Restaurante El Muelle" />
          <TextField label="Correo" size="small" fullWidth helperText="Para enviar recordatorios de pago." />
          <TextField label="RIF *" size="small" fullWidth error helperText="Formato inválido (V-/E-/J- + números)" defaultValue="123" />
          <TextField label="Código" size="small" fullWidth disabled defaultValue="CLI-0042" />
        </Box>
      </Demo>
      <Demo label="Máscaras, adornos, select, autocompletar y fecha dd/mm/aaaa">
        <Box sx={{ display: 'grid', gap: ESPACIO.formCampoVertical }}>
          <NumberField label="Límite de crédito" prefix="$" size="small" fullWidth value={monto} onChange={setMonto} />
          <NumberField label="Peso" suffix="kg" decimals={3} size="small" fullWidth value={peso} onChange={setPeso} placeholder="0,000" />
          <PhoneField label="Teléfono" size="small" fullWidth value={telefono} onChange={setTelefono} placeholder="0414-1234567" />
          <RifCiField label="Cédula o RIF" size="small" fullWidth value={rif} onChange={setRif} placeholder="V-12345678" />
          <TextField select label="Categoría" size="small" fullWidth value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            options={CATEGORIAS}
            value={autocompletar}
            onChange={(_, v) => setAutocompletar(v)}
            renderInput={(params) => <TextField {...params} label="Producto" size="small" placeholder="Buscar" />}
          />
          <DateField label="Fecha de entrega" size="small" fullWidth value={fecha} onChange={setFecha} />
        </Box>
      </Demo>
    </Demos>
  )
}

function Seleccion() {
  const [estado, setEstado] = React.useState<'todos' | 'activos' | 'bloqueados' | 'inactivos'>('todos')
  const [tipo, setTipo] = React.useState<string | null>(null)
  const [zonas, setZonas] = React.useState<string[]>([])
  return (
    <Demos>
      <Demo label="SegmentedControl con contadores (flechas para moverse)">
        <SegmentedControl
          aria-label="Estado de clientes"
          value={estado}
          onChange={setEstado}
          options={[
            { value: 'todos', label: 'Todos', count: 64 },
            { value: 'activos', label: 'Activos', count: 55 },
            { value: 'bloqueados', label: 'Bloqueados', count: 6 },
            { value: 'inactivos', label: 'Inactivos', count: 3 },
          ]}
        />
        <SegmentedControl
          aria-label="Moneda"
          size="small"
          value="usd"
          onChange={() => {}}
          disabled
          options={[
            { value: 'usd', label: 'USD' },
            { value: 'bs', label: 'Bs' },
          ]}
        />
      </Demo>
      <Demo label="FilterMenuButton: opción única y múltiple, con «Limpiar»">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <FilterMenuButton
            label="Tipo"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'natural', label: 'Persona natural', count: 41 },
              { value: 'juridica', label: 'Persona jurídica', count: 23 },
            ]}
          />
          <FilterMenuButton
            label="Zona"
            multiple
            value={zonas}
            onChange={setZonas}
            options={[
              { value: 'porlamar', label: 'Porlamar' },
              { value: 'pampatar', label: 'Pampatar' },
              { value: 'juangriego', label: 'Juan Griego' },
            ]}
          />
        </Box>
      </Demo>
      <Demo label="EstadoChip: solo excepciones, cuatro tonos con punto">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <EstadoChip tono="error" label="Vencida" />
          <EstadoChip tono="warning" label="Por vencer" />
          <EstadoChip tono="warning" label="Pendiente" />
          <EstadoChip tono="success" label="Pagada" />
          <EstadoChip tono="neutral" label="Anulada" />
        </Box>
        <Typography variant="caption" color="text.secondary">
          «Activo», «Controla stock» o «Crudo» no llevan chip: van como texto o en el filtro.
        </Typography>
      </Demo>
      <Demo label="RowActionsMenu: ⋮ de 32 px, destructivas dentro y en error · en curso">
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <RowActionsMenu
            label="Restaurante El Muelle"
            actions={[
              { label: 'Editar', icon: <EditOutlinedIcon fontSize="small" />, onClick: () => {} },
              { label: 'Duplicar', icon: <ContentCopyOutlinedIcon fontSize="small" />, onClick: () => {} },
              { label: 'Eliminar', icon: <DeleteOutlinedIcon fontSize="small" />, destructive: true, onClick: () => {} },
            ]}
          />
          <RowActionsMenu label="fila en proceso" pending actions={[{ label: 'Editar', onClick: () => {} }]} />
        </Box>
      </Demo>
    </Demos>
  )
}

function Toasts() {
  const notify = useNotify()
  return (
    <Demo label="Toast: éxito con «Ver», éxito reversible con «Deshacer» y error">
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button
          variant="outlined"
          onClick={() => notify.success('Compra registrada', { action: { label: 'Ver', href: '#patrones' } })}
        >
          Éxito con «Ver»
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            notify.success('Cliente archivado', {
              action: { label: 'Deshacer', onClick: () => notify.info('Archivado deshecho') },
            })
          }
        >
          Con «Deshacer»
        </Button>
        <Button variant="outlined" onClick={() => notify.error('No se pudo registrar la compra. Revisa tu conexión.')}>
          Error
        </Button>
      </Box>
    </Demo>
  )
}

export function Primitivos() {
  return (
    <Seccion
      id="primitivos"
      titulo="Primitivos"
      descripcion="Cada primitivo con sus estados: reposo, hover, foco (usa Tab), deshabilitado, cargando, error y vacío."
    >
      <Apartado titulo="Botones">
        <Botones />
      </Apartado>
      <Apartado titulo="Campos">
        <Campos />
      </Apartado>
      <Apartado titulo="Selección, filtros, chips y menú de fila">
        <Seleccion />
      </Apartado>
      <Apartado titulo="Toast">
        <Toasts />
      </Apartado>
    </Seccion>
  )
}
