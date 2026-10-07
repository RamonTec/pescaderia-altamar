'use client'

import * as React from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Divider from '@mui/material/Divider'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { PageHeader } from '@/components/molecules/PageHeader'
import { DocumentoUpload } from '@/components/molecules/DocumentoUpload'
import { representanteLegalRepository } from '@/lib/repositories/representanteLegalRepository'
import { makeClienteDocumentoStore } from '@/lib/repositories/documentoClienteRepository'
import { createClient } from '@/lib/supabase/client'
import type { Cliente, RepresentanteLegal } from '@/types/domain'
import { formatUsd } from '@/lib/format'

interface FacturaRow {
  id: string
  numero: number
  fecha: string
  total_usd: number
  estado: string
}

interface PedidoRow {
  id: string
  fecha: string
  fecha_entrega: string | null
  estado: string
}

export function ClienteFicha({
  cliente,
  saldo,
}: {
  cliente: Cliente
  saldo: number | null
}) {
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

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <PageHeader title={cliente.nombre}>
        <Button component={Link} href="/clientes" startIcon={<ArrowBackIcon />}>
          Volver
        </Button>
      </PageHeader>

      <Paper variant="outlined" sx={{ p: 3, display: 'grid', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={cliente.tipo_persona === 'juridica' ? 'Persona jurídica' : 'Persona natural'}
            size="small"
            color={cliente.tipo_persona === 'juridica' ? 'secondary' : 'default'}
          />
          {cliente.bloqueado ? (
            <Chip label={`Bloqueado: ${cliente.motivo_bloqueo ?? 'sin motivo'}`} size="small" color="error" />
          ) : null}
          {!cliente.activo ? <Chip label="Inactivo" size="small" variant="outlined" /> : null}
        </Box>

        <Fila label="RIF / Cédula" valor={cliente.rif_ci} />
        <Fila label="Teléfono" valor={cliente.telefono} />
        <Fila label="Email" valor={cliente.email} />
        <Fila label="Dirección" valor={cliente.direccion} />
        <Fila
          label="Límite de crédito"
          valor={cliente.limite_credito_usd != null ? formatUsd(cliente.limite_credito_usd) : '—'}
        />
        <Fila label="Saldo pendiente" valor={saldo != null ? formatUsd(saldo) : '—'} />
        {cliente.notas ? <Fila label="Notas" valor={cliente.notas} /> : null}
      </Paper>

      <Seccion titulo="Representantes legales">
        {representantes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {cliente.tipo_persona === 'juridica'
              ? 'Sin representantes registrados.'
              : 'No aplica (persona natural).'}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Cédula</TableCell>
                <TableCell>Cargo</TableCell>
                <TableCell>Teléfono</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {representantes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.nombre}</TableCell>
                  <TableCell>{r.cedula}</TableCell>
                  <TableCell>{r.cargo ?? '—'}</TableCell>
                  <TableCell>{r.telefono ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Seccion>

      <Seccion titulo="Documentos">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <DocumentoUpload store={makeClienteDocumentoStore(cliente.id)} tipo="cedula" label="Documento de cédula" />
          <DocumentoUpload store={makeClienteDocumentoStore(cliente.id)} tipo="rif" label="Documento de RIF" />
        </Box>
      </Seccion>

      <Seccion titulo="Facturas">
        {facturas.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Sin facturas registradas.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Número</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {facturas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.numero}</TableCell>
                  <TableCell>{f.fecha}</TableCell>
                  <TableCell>{formatUsd(f.total_usd)}</TableCell>
                  <TableCell>{f.estado}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Seccion>

      <Seccion titulo="Pedidos">
        {pedidos.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Sin pedidos registrados.
          </Typography>
        ) : (
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
                  <TableCell>{p.fecha}</TableCell>
                  <TableCell>{p.fecha_entrega ?? '—'}</TableCell>
                  <TableCell>{p.estado}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Seccion>

      {loading ? (
        <Typography variant="caption" color="text.secondary">
          Cargando…
        </Typography>
      ) : null}
    </Box>
  )
}

function Fila({ label, valor }: { label: string; valor: string | null }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{valor || '—'}</Typography>
    </Box>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, display: 'grid', gap: 1.5 }}>
      <Typography variant="h6">{titulo}</Typography>
      <Divider />
      {children}
    </Paper>
  )
}
