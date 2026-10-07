'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Fade from '@mui/material/Fade'
import LinkIcon from '@mui/material/Link'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import { PageHeader } from '@/components/molecules/PageHeader'
import { StatusChips } from '@/components/molecules/StatusChips'
import { CopyableText } from '@/components/molecules/CopyableText'
import { EmptyState } from '@/components/molecules/EmptyState'
import { BloqueoDialog } from '@/components/organisms/BloqueoDialog'
import { ProveedorForm } from '@/components/organisms/ProveedorForm'
import { makeRepresentanteProveedorRepository } from '@/lib/repositories/representanteProveedorRepository'
import { makeMetodoPagoProveedorRepository } from '@/lib/repositories/metodoPagoProveedorRepository'
import { makeDocumentoProveedorRepository } from '@/lib/repositories/documentoProveedorRepository'
import { createClient } from '@/lib/supabase/client'
import { enmascararCuenta, BANCOS_VE } from '@/lib/bancosVe'
import { evaluarDocumentacion } from '@/lib/evaluarDocumentacion'
import { formatUsd } from '@/lib/format'
import type {
  Proveedor,
  RepresentanteProveedor,
  MetodoPagoProveedor,
  DocumentoProveedor,
  EstadoDocumental,
} from '@/types/domain'
import {
  bloquearProveedorAction,
  desbloquearProveedorAction,
  desactivarProveedorAction,
  activarProveedorAction,
} from '@/app/(protected)/proveedores/actions'
import { useNotify } from '@/lib/useNotify'
import { useConfirm } from '@/lib/useConfirm'

interface CompraRow {
  id: string
  fecha: string
  condicion: string
  total_usd: number
  estado: string
}

interface CompraCruda {
  id: string
  fecha: string
  condicion: string
  subtotal_usd: number
  estado: string
}

const LABEL_METODO: Record<MetodoPagoProveedor['tipo'], string> = {
  transferencia: 'Transferencia',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

export function ProveedorFicha({
  proveedor,
  saldo,
  esAdmin,
}: {
  proveedor: Proveedor
  saldo: number | null
  esAdmin: boolean
}) {
  const router = useRouter()
  const notify = useNotify()
  const confirm = useConfirm()
  const [isPending, startTransition] = useTransition()

  const [representantes, setRepresentantes] = React.useState<RepresentanteProveedor[]>([])
  const [metodos, setMetodos] = React.useState<MetodoPagoProveedor[]>([])
  const [documentos, setDocumentos] = React.useState<DocumentoProveedor[]>([])
  const [compras, setCompras] = React.useState<CompraRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [docUrls, setDocUrls] = React.useState<Record<string, string>>({})

  const [editOpen, setEditOpen] = React.useState(false)
  const [bloquearOpen, setBloquearOpen] = React.useState(false)

  const aplicarDatos = React.useCallback(
    (reps: RepresentanteProveedor[], mets: MetodoPagoProveedor[], docs: DocumentoProveedor[], comprasRes: { data: CompraCruda[] | null }) => {
      setRepresentantes(reps)
      setMetodos(mets)
      setDocumentos(docs)
      setCompras(
        (comprasRes.data ?? []).map((c) => ({
          id: c.id,
          fecha: c.fecha,
          condicion: c.condicion,
          total_usd: c.subtotal_usd,
          estado: c.estado,
        }))
      )
      const mapa: Record<string, string> = {}
      const repo = makeDocumentoProveedorRepository()
      Promise.all(
        docs.map(async (d) => {
          const url = await repo.getUrlDescarga(d.id)
          if (url) mapa[d.id] = url
        })
      ).then(() => setDocUrls(mapa))
    },
    []
  )

  const recargar = React.useCallback(async () => {
    const supabase = createClient()
    const [reps, mets, docs, comprasRes] = await Promise.all([
      makeRepresentanteProveedorRepository().listByProveedor(proveedor.id),
      makeMetodoPagoProveedorRepository().listByProveedor(proveedor.id),
      makeDocumentoProveedorRepository().listByProveedor(proveedor.id),
      supabase
        .from('compras')
        .select('id, fecha, condicion, subtotal_usd, estado')
        .eq('proveedor_id', proveedor.id)
        .order('fecha', { ascending: false }),
    ])
    aplicarDatos(reps, mets, docs, { data: (comprasRes.data ?? []) as CompraCruda[] })
  }, [proveedor.id, aplicarDatos])

  React.useEffect(() => {
    let active = true
    const supabase = createClient()
    Promise.all([
      makeRepresentanteProveedorRepository().listByProveedor(proveedor.id),
      makeMetodoPagoProveedorRepository().listByProveedor(proveedor.id),
      makeDocumentoProveedorRepository().listByProveedor(proveedor.id),
      supabase
        .from('compras')
        .select('id, fecha, condicion, subtotal_usd, estado')
        .eq('proveedor_id', proveedor.id)
        .order('fecha', { ascending: false }),
    ])
      .then(([reps, mets, docs, comprasRes]) => {
        if (!active) return
        aplicarDatos(reps, mets, docs, { data: (comprasRes.data ?? []) as CompraCruda[] })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [proveedor.id, aplicarDatos])

  const documentacion: EstadoDocumental = evaluarDocumentacion(
    proveedor,
    representantes,
    documentos
  )

  const run = async (
    fn: (prev: never, formData: FormData) => Promise<{ error: string | null; success: string | null }>,
    id: string,
    mensajeOk?: string
  ) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set('id', id)
      const result = await fn(undefined as never, formData)
      if (result.error) notify.error(result.error)
      else {
        notify.success(mensajeOk ?? result.success ?? 'Listo')
        router.refresh()
        await recargar()
      }
    })
  }

  const handleDesactivar = async () => {
    const ok = await confirm({
      title: 'Desactivar proveedor',
      message: `¿Desactivar a "${proveedor.nombre}"? No se podrá usar en nuevas compras.`,
      confirmLabel: 'Desactivar',
      destructive: true,
    })
    if (!ok) return
    await run(desactivarProveedorAction as never, proveedor.id)
  }

  const confirmBloquear = async (motivo: string) => {
    const formData = new FormData()
    formData.set('id', proveedor.id)
    formData.set('motivo', motivo)
    const result = await bloquearProveedorAction({ error: null, success: null }, formData)
    if (result.error) return { error: result.error, fieldErrors: result.fieldErrors }
    notify.success('Proveedor bloqueado')
    setBloquearOpen(false)
    router.refresh()
    await recargar()
    return { error: null }
  }

  return (
    <Fade in timeout={200}>
      <Box sx={{ display: 'grid', gap: 3 }}>
        <PageHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar>{iniciales(proveedor.nombre)}</Avatar>
              <Box>
                <Typography component="span" sx={{ display: 'block' }}>
                  {proveedor.nombre}
                </Typography>
                {proveedor.rif_ci ? (
                  <Typography variant="caption" color="text.secondary">
                    {proveedor.rif_ci}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          }
        >
          <Button component={Link} href="/proveedores" startIcon={<ArrowBackIcon />}>
            Volver
          </Button>
          <Button onClick={() => setEditOpen(true)}>Editar</Button>
          {esAdmin ? (
            proveedor.bloqueado ? (
              <Button
                color="success"
                startIcon={<LockOpenOutlinedIcon />}
                onClick={() => run(desbloquearProveedorAction as never, proveedor.id)}
                disabled={isPending}
              >
                Desbloquear
              </Button>
            ) : (
              <Button
                color="error"
                startIcon={<LockOutlinedIcon />}
                onClick={() => setBloquearOpen(true)}
                disabled={isPending}
              >
                Bloquear
              </Button>
            )
          ) : null}
          {proveedor.activo ? (
            <Button color="error" onClick={handleDesactivar} disabled={isPending}>
              Desactivar
            </Button>
          ) : (
            <Button
              color="success"
              onClick={() => run(activarProveedorAction as never, proveedor.id)}
              disabled={isPending}
            >
              Activar
            </Button>
          )}
        </PageHeader>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={proveedor.tipo_persona === 'juridica' ? 'Persona jurídica' : 'Persona natural'}
            size="small"
            color={proveedor.tipo_persona === 'juridica' ? 'secondary' : 'default'}
          />
          <StatusChips
            bloqueado={proveedor.bloqueado}
            motivoBloqueo={proveedor.motivo_bloqueo}
            activo={proveedor.activo}
            documentacion={documentacion}
          />
        </Box>

        {proveedor.bloqueado ? (
          <Alert severity="error">Proveedor bloqueado: {proveedor.motivo_bloqueo ?? 'sin motivo'}</Alert>
        ) : null}

        {!documentacion.completa ? (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={() => setEditOpen(true)}>
                Completar documentos
              </Button>
            }
          >
            Documentación incompleta. Faltan: {documentacion.faltantes.join(', ')}.
          </Alert>
        ) : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
          }}
        >
          <Seccion titulo="Datos generales y contacto">
            <Fila label="Teléfono" valor={proveedor.telefono} />
            <Fila label="Email" valor={proveedor.email} />
            <Fila label="Dirección" valor={proveedor.direccion} />
            <Fila label="Contacto" valor={proveedor.contacto_nombre} />
            <Fila label="Teléfono de contacto" valor={proveedor.contacto_telefono} />
            {proveedor.notas ? <Fila label="Notas" valor={proveedor.notas} /> : null}
          </Seccion>

          <Seccion titulo="Saldo pendiente">
            <Typography variant="body2">
              {saldo != null ? formatUsd(saldo) : '—'}
            </Typography>
          </Seccion>

          {proveedor.tipo_persona === 'juridica' ? (
            <Seccion titulo="Representantes legales">
              {representantes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin representantes registrados.
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
          ) : null}

          <Seccion titulo="Métodos de pago">
            {metodos.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin métodos de pago registrados.
              </Typography>
            ) : (
              metodos.map((m) => (
                <Box key={m.id} sx={{ display: 'grid', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {LABEL_METODO[m.tipo]}
                    </Typography>
                    {m.preferido ? <Chip label="Preferido" size="small" color="primary" /> : null}
                  </Box>
                  {m.tipo === 'transferencia' ? (
                    <>
                      <FilaDetalle
                        label="Cuenta"
                        valor={
                          m.numero_cuenta ? (
                            <CopyableText
                              value={m.numero_cuenta}
                              display={enmascararCuenta(m.numero_cuenta)}
                            />
                          ) : null
                        }
                      />
                      <Fila label="Banco" valor={m.banco_codigo ? (BANCOS_VE[m.banco_codigo] ?? m.banco_codigo) : null} />
                      <Fila label="Titular" valor={m.titular} />
                      <Fila label="RIF/CI" valor={m.titular_rif_ci} />
                    </>
                  ) : m.tipo === 'pago_movil' ? (
                    <>
                      <FilaDetalle
                        label="Teléfono"
                        valor={
                          m.telefono ? <CopyableText value={m.telefono} /> : null
                        }
                      />
                      <Fila label="Banco" valor={m.banco_codigo ? (BANCOS_VE[m.banco_codigo] ?? m.banco_codigo) : null} />
                      <Fila label="RIF/CI" valor={m.titular_rif_ci} />
                    </>
                  ) : (
                    <>
                      <Fila label="Titular" valor={m.titular} />
                      {m.email ? (
                        <FilaDetalle label="Email" valor={<CopyableText value={m.email} mono={false} />} />
                      ) : null}
                      {m.telefono ? (
                        <FilaDetalle label="Teléfono" valor={<CopyableText value={m.telefono} />} />
                      ) : null}
                    </>
                  )}
                </Box>
              ))
            )}
          </Seccion>

          <Seccion titulo="Documentos">
            {documentos.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin documentos.
              </Typography>
            ) : (
              documentos.map((d) => (
                <Box key={d.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {d.nombre_original ?? d.tipo}
                  </Typography>
                  {docUrls[d.id] ? (
                    <LinkIcon
                      href={docUrls[d.id]}
                      target="_blank"
                      rel="noreferrer"
                      variant="body2"
                    >
                      Ver
                    </LinkIcon>
                  ) : null}
                </Box>
              ))
            )}
          </Seccion>

          <Seccion titulo="Historial de compras">
            {compras.length === 0 ? (
              <EmptyState title="Sin compras" description="Este proveedor aún no tiene compras." />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Condición</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {compras.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.fecha}</TableCell>
                      <TableCell>{c.condicion}</TableCell>
                      <TableCell>{formatUsd(c.total_usd)}</TableCell>
                      <TableCell>{c.estado}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Seccion>
        </Box>

        {loading ? (
          <Typography variant="caption" color="text.secondary">
            Cargando…
          </Typography>
        ) : null}

        <ProveedorForm
          open={editOpen}
          proveedor={proveedor}
          pasoInicial={!documentacion.completa && !proveedor.bloqueado ? 2 : 0}
          onClose={() => setEditOpen(false)}
        />

        <BloqueoDialog
          open={bloquearOpen}
          titulo={`Bloquear proveedor: ${proveedor.nombre}`}
          onConfirm={confirmBloquear}
          onClose={() => setBloquearOpen(false)}
        />
      </Box>
    </Fade>
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

function FilaDetalle({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box>{valor ?? '—'}</Box>
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
