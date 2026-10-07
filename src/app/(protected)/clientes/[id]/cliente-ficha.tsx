'use client'

import * as React from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip, { type ChipProps } from '@mui/material/Chip'
import Fade from '@mui/material/Fade'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import BlockIcon from '@mui/icons-material/Block'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import { CopyableText } from '@/components/molecules/CopyableText'
import { CreditoResumen } from '@/components/molecules/CreditoResumen'
import { DocumentoUpload } from '@/components/molecules/DocumentoUpload'
import { FichaDato, FichaDatos, FichaSeccion } from '@/components/molecules/FichaSeccion'
import { StatusChips } from '@/components/molecules/StatusChips'
import { representanteLegalRepository } from '@/lib/repositories/representanteLegalRepository'
import { makeClienteDocumentoStore } from '@/lib/repositories/documentoClienteRepository'
import { createClient } from '@/lib/supabase/client'
import { formatFecha, formatUsd } from '@/lib/format'
import type { Cliente, EstadoDoc, EstadoPedido, RepresentanteLegal } from '@/types/domain'
import { useClienteAcciones } from '../useClienteAcciones'

interface FacturaRow {
  id: string
  numero: number
  fecha: string
  total_usd: number
  estado: EstadoDoc
}

interface PedidoRow {
  id: string
  fecha: string
  fecha_entrega: string | null
  estado: EstadoPedido
}

const MONO = { fontFamily: 'var(--font-geist-mono)', fontVariantNumeric: 'tabular-nums' }

const ESTADO_FACTURA: Record<EstadoDoc, { label: string; color: ChipProps['color'] }> = {
  abierta: { label: 'Por cobrar', color: 'warning' },
  pagada: { label: 'Pagada', color: 'success' },
  anulada: { label: 'Anulada', color: 'default' },
}

const ESTADO_PEDIDO: Record<EstadoPedido, { label: string; color: ChipProps['color'] }> = {
  pendiente: { label: 'Pendiente', color: 'warning' },
  entregado: { label: 'Entregado', color: 'primary' },
  facturado: { label: 'Facturado', color: 'success' },
  anulado: { label: 'Anulado', color: 'default' },
}

export function ClienteFicha({
  cliente,
  saldo,
  esAdmin,
}: {
  cliente: Cliente
  saldo: number | null
  esAdmin: boolean
}) {
  const router = useRouter()
  const { acciones, dialogos, isPending } = useClienteAcciones({ onCambio: () => router.refresh() })
  const [menuEl, setMenuEl] = React.useState<HTMLElement | null>(null)

  const [representantes, setRepresentantes] = React.useState<RepresentanteLegal[]>([])
  const [facturas, setFacturas] = React.useState<FacturaRow[]>([])
  const [pedidos, setPedidos] = React.useState<PedidoRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true
    const supabase = createClient()

    Promise.all([
      representanteLegalRepository.listByCliente(cliente.id),
      supabase
        .from('facturas')
        .select('id, numero, fecha, total_usd, estado')
        .eq('cliente_id', cliente.id)
        .order('fecha', { ascending: false }),
      supabase
        .from('pedidos')
        .select('id, fecha, fecha_entrega, estado')
        .eq('cliente_id', cliente.id)
        .order('fecha', { ascending: false }),
    ])
      .then(([reps, factRes, pedRes]) => {
        if (!active) return
        setRepresentantes(reps)
        setFacturas((factRes.data ?? []) as FacturaRow[])
        setPedidos((pedRes.data ?? []) as PedidoRow[])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [cliente.id])

  const desdeMenu = (fn: (c: Cliente) => void) => () => {
    setMenuEl(null)
    fn(cliente)
  }

  const juridica = cliente.tipo_persona === 'juridica'

  return (
    <Fade in timeout={200}>
      <Box sx={{ display: 'grid', gap: 3 }}>
        <Box component="header" sx={{ display: 'grid', gap: 1 }}>
          <Link
            component={NextLink}
            href="/clientes"
            variant="body2"
            underline="hover"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, justifySelf: 'start' }}
          >
            <ArrowBackIcon sx={{ fontSize: 16 }} />
            Clientes
          </Link>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'flex-start' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'grid', gap: 0.75, minWidth: 0 }}>
              <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
                {cliente.nombre}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
                {cliente.rif_ci ? <CopyableText value={cliente.rif_ci} /> : null}
                <Typography variant="body2" color="text.secondary">
                  {juridica ? 'Persona jurídica' : 'Persona natural'}
                </Typography>
                <StatusChips bloqueado={cliente.bloqueado} motivoBloqueo={cliente.motivo_bloqueo} activo={cliente.activo} />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => acciones.editar(cliente)}>
                Editar
              </Button>
              <IconButton
                aria-label="Más acciones"
                onClick={(e) => setMenuEl(e.currentTarget)}
                disabled={isPending}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
              >
                <MoreVertIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {cliente.bloqueado ? (
          <Alert
            severity="error"
            action={
              esAdmin ? (
                <Button color="inherit" size="small" onClick={() => acciones.desbloquear(cliente)} disabled={isPending}>
                  Desbloquear
                </Button>
              ) : undefined
            }
          >
            No se le puede vender a crédito. Motivo: {cliente.motivo_bloqueo ?? 'sin motivo registrado'}.
          </Alert>
        ) : !cliente.activo ? (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={() => acciones.activar(cliente)} disabled={isPending}>
                Activar
              </Button>
            }
          >
            Cliente inactivo: no aparece al registrar ventas.
          </Alert>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(280px, 1fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <FichaSeccion titulo="Contacto">
              <FichaDatos>
                <FichaDato label="Teléfono">
                  {cliente.telefono ? <CopyableText value={cliente.telefono} /> : null}
                </FichaDato>
                <FichaDato label="Email">
                  {cliente.email ? <CopyableText value={cliente.email} mono={false} /> : null}
                </FichaDato>
                <FichaDato label="Dirección">{cliente.direccion}</FichaDato>
                {cliente.notas ? <FichaDato label="Notas">{cliente.notas}</FichaDato> : null}
              </FichaDatos>
            </FichaSeccion>

            {juridica ? (
              <FichaSeccion titulo="Representantes legales" loading={loading}>
                {representantes.length === 0 ? (
                  <Alert
                    severity="warning"
                    action={
                      <Button color="inherit" size="small" onClick={() => acciones.editar(cliente)}>
                        Agregar
                      </Button>
                    }
                  >
                    Falta registrar al menos un representante legal.
                  </Alert>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nombre</TableCell>
                          <TableCell>Cédula</TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Cargo</TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Teléfono</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {representantes.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.nombre}</TableCell>
                            <TableCell sx={MONO}>{r.cedula}</TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{r.cargo || '—'}</TableCell>
                            <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{r.telefono || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </FichaSeccion>
            ) : null}

            <FichaSeccion titulo="Facturas" loading={loading}>
              {facturas.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Todavía no hay facturas para este cliente.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>N.º</TableCell>
                        <TableCell>Fecha</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {facturas.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell sx={MONO}>{f.numero}</TableCell>
                          <TableCell>{formatFecha(f.fecha)}</TableCell>
                          <TableCell align="right" sx={MONO}>
                            {formatUsd(f.total_usd)}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" variant="outlined" {...ESTADO_FACTURA[f.estado]} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </FichaSeccion>

            <FichaSeccion titulo="Pedidos" loading={loading}>
              {pedidos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Todavía no hay pedidos para este cliente.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Entrega</TableCell>
                        <TableCell>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pedidos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatFecha(p.fecha)}</TableCell>
                          <TableCell>{formatFecha(p.fecha_entrega)}</TableCell>
                          <TableCell>
                            <Chip size="small" variant="outlined" {...ESTADO_PEDIDO[p.estado]} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </FichaSeccion>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <CreditoResumen limiteUsd={cliente.limite_credito_usd} saldoUsd={saldo} />
            <FichaSeccion titulo="Documentos">
              <DocumentoUpload store={makeClienteDocumentoStore(cliente.id)} tipo="cedula" label="Cédula" />
              <DocumentoUpload store={makeClienteDocumentoStore(cliente.id)} tipo="rif" label="RIF" />
            </FichaSeccion>
          </Box>
        </Box>

        <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
          {[
            esAdmin && cliente.bloqueado ? (
              <MenuItem key="desbloquear" onClick={desdeMenu(acciones.desbloquear)}>
                <ListItemIcon>
                  <LockOpenOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Desbloquear</ListItemText>
              </MenuItem>
            ) : null,
            esAdmin && !cliente.bloqueado ? (
              <MenuItem key="bloquear" onClick={desdeMenu(acciones.bloquear)}>
                <ListItemIcon>
                  <LockOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Bloquear</ListItemText>
              </MenuItem>
            ) : null,
            cliente.activo ? (
              <MenuItem key="desactivar" onClick={desdeMenu(acciones.desactivar)} sx={{ color: 'error.main' }}>
                <ListItemIcon sx={{ color: 'inherit' }}>
                  <BlockIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Desactivar</ListItemText>
              </MenuItem>
            ) : (
              <MenuItem key="activar" onClick={desdeMenu(acciones.activar)}>
                <ListItemIcon>
                  <CheckCircleOutlineIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Activar</ListItemText>
              </MenuItem>
            ),
          ]}
        </Menu>

        {dialogos}
      </Box>
    </Fade>
  )
}
