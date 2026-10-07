'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Fade from '@mui/material/Fade'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { GridColDef } from '@mui/x-data-grid'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import ImageIcon from '@mui/icons-material/ImageOutlined'
import { CopyableText } from '@/components/molecules/CopyableText'
import { EmptyState } from '@/components/molecules/EmptyState'
import { FichaDato, FichaDatos, FichaSeccion } from '@/components/molecules/FichaSeccion'
import { FichaHeader } from '@/components/molecules/FichaHeader'
import type { RowAction } from '@/components/molecules/RowActionsMenu'
import { StatusChips } from '@/components/molecules/StatusChips'
import { AppDataGrid } from '@/components/organisms/AppDataGrid'
import {
  EstadoChip,
  colEstado,
  colFecha,
  colMonto,
  type EstadoDef,
} from '@/components/organisms/appDataGridColumns'
import { BANCOS_VE } from '@/lib/bancosVe'
import { evaluarDocumentacion } from '@/lib/evaluarDocumentacion'
import { formatUsd } from '@/lib/format'
import type {
  CondicionPago,
  DocumentoProveedor,
  EstadoDocumental,
  EstadoDoc,
  MetodoPagoProveedor,
  Proveedor,
  RepresentanteProveedor,
  TipoDocumentoProveedor,
} from '@/types/domain'
import { useProveedorAcciones, type DatosEdicionProveedor } from '../useProveedorAcciones'
import type { CompraFicha } from './page'

const LABEL_METODO: Record<MetodoPagoProveedor['tipo'], string> = {
  transferencia: 'Transferencia',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
}

const ESTADO_COMPRA: Record<EstadoDoc, EstadoDef> = {
  abierta: { label: 'Por pagar', color: 'warning' },
  pagada: { label: 'Pagada', color: 'success' },
  anulada: { label: 'Anulada', color: 'default' },
}

const CONDICION: Record<CondicionPago, string> = {
  contado: 'Contado',
  credito: 'Crédito',
}

const COLUMNAS_COMPRAS: GridColDef<CompraFicha>[] = [
  colFecha<CompraFicha>('fecha', 'Fecha', { flex: 1 }),
  {
    field: 'condicion',
    headerName: 'Condición',
    flex: 1,
    minWidth: 110,
    valueFormatter: (v: CondicionPago) => CONDICION[v] ?? v,
  },
  colMonto<CompraFicha>('subtotal_usd', 'Total', { flex: 1 }),
  colEstado<CompraFicha>('estado', 'Estado', ESTADO_COMPRA, { flex: 1 }),
]

/**
 * Ficha del proveedor. Todo llega por props desde `page.tsx` (servidor);
 * aquí solo se compone y se disparan las acciones (`useProveedorAcciones`).
 */
export function ProveedorFicha({
  proveedor,
  saldo,
  esAdmin,
  representantes,
  metodos,
  documentos,
  docUrls,
  compras,
}: {
  proveedor: Proveedor
  saldo: number
  esAdmin: boolean
  representantes: RepresentanteProveedor[]
  metodos: MetodoPagoProveedor[]
  documentos: DocumentoProveedor[]
  /** URL firmada por id de documento (para "Ver" en pestaña nueva). */
  docUrls: Record<string, string>
  compras: CompraFicha[]
}) {
  const router = useRouter()
  const theme = useTheme()
  const refrescar = React.useCallback(() => router.refresh(), [router])
  const { acciones, dialogos, estaPendiente } = useProveedorAcciones({ onCambio: refrescar })

  const documentacion: EstadoDocumental = evaluarDocumentacion(proveedor, representantes, documentos)
  const pendiente = estaPendiente(proveedor.id)
  const juridica = proveedor.tipo_persona === 'juridica'
  const abiertas = compras.filter((c) => c.estado === 'abierta').length

  // Datos de edición del form: ya están en el servidor, el form no vuelve a
  // pedirlos al abrir ("Completar documentos" cae directo al paso 3).
  const datosEdicion: DatosEdicionProveedor = React.useMemo(
    () => ({
      representantes: representantes.map((r) => ({ id: r.id, nombre: r.nombre, cedula: r.cedula })),
      tiposDocumento: new Set<TipoDocumentoProveedor>(documentos.map((d) => d.tipo)),
      representanteConCedula: new Set(
        documentos.filter((d) => d.representante_id).map((d) => d.representante_id!)
      ),
    }),
    [representantes, documentos]
  )

  const menuActions: RowAction[] = []
  if (esAdmin) {
    menuActions.push(
      proveedor.bloqueado
        ? {
            label: 'Desbloquear',
            icon: <LockOpenOutlinedIcon fontSize="small" />,
            onClick: () => acciones.desbloquear(proveedor),
          }
        : {
            label: 'Bloquear',
            icon: <LockOutlinedIcon fontSize="small" />,
            onClick: () => acciones.bloquear(proveedor),
          }
    )
  }
  menuActions.push(
    proveedor.activo
      ? {
          label: 'Desactivar',
          icon: <BlockOutlinedIcon fontSize="small" />,
          destructive: true,
          onClick: () => acciones.desactivar(proveedor),
        }
      : {
          label: 'Activar',
          icon: <CheckCircleOutlinedIcon fontSize="small" />,
          onClick: () => acciones.activar(proveedor),
        }
  )

  const editar = (paso: number) => acciones.editar(proveedor, paso, datosEdicion)

  return (
    <Fade in timeout={theme.transitions.duration.short}>
      <Box sx={{ display: 'grid', gap: 3 }}>
        <FichaHeader
          backHref="/proveedores"
          backLabel="Proveedores"
          title={proveedor.nombre}
          meta={
            <>
              {proveedor.rif_ci ? (
                <CopyableText value={proveedor.rif_ci} />
              ) : (
                <span>Sin RIF / cédula</span>
              )}
              <span>{juridica ? 'Persona jurídica' : 'Persona natural'}</span>
              <StatusChips
                bloqueado={proveedor.bloqueado}
                motivoBloqueo={proveedor.motivo_bloqueo}
                activo={proveedor.activo}
              />
            </>
          }
          primaryAction={{
            label: 'Editar proveedor',
            icon: <EditOutlinedIcon />,
            onClick: () => editar(0),
          }}
          menuActions={menuActions}
          pending={pendiente}
        />

        {proveedor.bloqueado ? (
          <Alert
            severity="error"
            sx={{ maxWidth: '75ch' }}
            action={
              esAdmin ? (
                <Button
                  color="inherit"
                  size="small"
                  loading={pendiente}
                  onClick={() => acciones.desbloquear(proveedor)}
                >
                  Desbloquear
                </Button>
              ) : undefined
            }
          >
            No se le puede comprar a crédito. Motivo: {proveedor.motivo_bloqueo ?? 'sin motivo registrado'}.
          </Alert>
        ) : !proveedor.activo ? (
          <Alert
            severity="info"
            sx={{ maxWidth: '75ch' }}
            action={
              <Button
                color="inherit"
                size="small"
                loading={pendiente}
                onClick={() => acciones.activar(proveedor)}
              >
                Activar
              </Button>
            }
          >
            Proveedor inactivo: no aparece al registrar compras.
          </Alert>
        ) : null}

        {!documentacion.completa ? (
          <Alert
            severity="warning"
            sx={{ maxWidth: '75ch' }}
            action={
              <Button color="inherit" size="small" loading={pendiente} onClick={() => editar(2)}>
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
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(280px, 1fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <FichaSeccion titulo="Datos generales y contacto">
              <FichaDatos>
                <FichaDato label="Teléfono">
                  {proveedor.telefono ? <CopyableText value={proveedor.telefono} /> : null}
                </FichaDato>
                <FichaDato label="Email">
                  {proveedor.email ? <CopyableText value={proveedor.email} mono={false} /> : null}
                </FichaDato>
                <FichaDato label="Dirección">{proveedor.direccion}</FichaDato>
                <FichaDato label="Contacto">{proveedor.contacto_nombre}</FichaDato>
                <FichaDato label="Teléfono de contacto">
                  {proveedor.contacto_telefono ? (
                    <CopyableText value={proveedor.contacto_telefono} />
                  ) : null}
                </FichaDato>
                {proveedor.notas ? <FichaDato label="Notas">{proveedor.notas}</FichaDato> : null}
              </FichaDatos>
            </FichaSeccion>

            {juridica ? (
              <FichaSeccion titulo="Representantes legales">
                {representantes.length === 0 ? (
                  <Alert
                    severity="warning"
                    sx={{ maxWidth: '75ch' }}
                    action={
                      <Button color="inherit" size="small" onClick={() => editar(0)}>
                        Agregar
                      </Button>
                    }
                  >
                    Falta registrar al menos un representante legal.
                  </Alert>
                ) : (
                  <Box
                    component="ul"
                    aria-label="Representantes legales"
                    sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2 }}
                  >
                    {representantes.map((r, i) => (
                      <Box component="li" key={r.id} sx={{ display: 'grid', gap: 2 }}>
                        {i > 0 ? <Divider /> : null}
                        <FichaDatos>
                          <FichaDato label="Nombre">{r.nombre}</FichaDato>
                          <FichaDato label="Cédula">
                            {r.cedula ? <CopyableText value={r.cedula} /> : null}
                          </FichaDato>
                          <FichaDato label="Cargo">{r.cargo}</FichaDato>
                          <FichaDato label="Teléfono">
                            {r.telefono ? <CopyableText value={r.telefono} /> : null}
                          </FichaDato>
                        </FichaDatos>
                      </Box>
                    ))}
                  </Box>
                )}
              </FichaSeccion>
            ) : null}

            <FichaSeccion titulo="Métodos de pago">
              {metodos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin métodos de pago registrados.
                </Typography>
              ) : (
                metodos.map((m) => (
                  <Box key={m.id} sx={{ display: 'grid', gap: 1, pb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2">{LABEL_METODO[m.tipo]}</Typography>
                      {m.preferido ? (
                        <EstadoChip label="Preferido" color="primary" />
                      ) : null}
                    </Box>
                    <FichaDatos>
                      {m.tipo === 'transferencia' ? (
                        <>
                          <FichaDato label="Cuenta">
                            {m.numero_cuenta ? (
                              // En la ficha la cuenta va completa (el listado
                              // la enmascara); copiable para transferir.
                              <CopyableText value={m.numero_cuenta} />
                            ) : null}
                          </FichaDato>
                          <FichaDato label="Banco">
                            {m.banco_codigo ? (BANCOS_VE[m.banco_codigo] ?? m.banco_codigo) : null}
                          </FichaDato>
                          <FichaDato label="Titular">{m.titular}</FichaDato>
                          <FichaDato label="RIF/CI del titular">
                            {m.titular_rif_ci ? <CopyableText value={m.titular_rif_ci} /> : null}
                          </FichaDato>
                        </>
                      ) : m.tipo === 'pago_movil' ? (
                        <>
                          <FichaDato label="Banco">
                            {m.banco_codigo ? (BANCOS_VE[m.banco_codigo] ?? m.banco_codigo) : null}
                          </FichaDato>
                          <FichaDato label="Teléfono">
                            {m.telefono ? <CopyableText value={m.telefono} /> : null}
                          </FichaDato>
                          <FichaDato label="RIF/CI del titular">
                            {m.titular_rif_ci ? <CopyableText value={m.titular_rif_ci} /> : null}
                          </FichaDato>
                        </>
                      ) : (
                        <>
                          <FichaDato label="Titular">{m.titular}</FichaDato>
                          {m.email ? (
                            <FichaDato label="Email">
                              <CopyableText value={m.email} mono={false} />
                            </FichaDato>
                          ) : null}
                          {m.telefono ? (
                            <FichaDato label="Teléfono">
                              <CopyableText value={m.telefono} />
                            </FichaDato>
                          ) : null}
                        </>
                      )}
                    </FichaDatos>
                    <Divider />
                  </Box>
                ))
              )}
            </FichaSeccion>

            <FichaSeccion titulo="Historial de compras">
              {compras.length === 0 ? (
                <EmptyState
                  compact
                  icon={<ShoppingCartOutlinedIcon />}
                  title="Aún no hay compras"
                />
              ) : (
                <AppDataGrid<CompraFicha>
                  tableId="proveedor-compras"
                  label="Compras del proveedor"
                  rows={compras}
                  columns={COLUMNAS_COMPRAS}
                  searchable={false}
                  pageParam="pcompras"
                  embedded
                  emptyState={{ title: 'Aún no hay compras' }}
                  mobileCard={(c) => ({
                    primary: `Compra del ${c.fecha}`,
                    amount: formatUsd(c.subtotal_usd),
                    status: <EstadoChip {...ESTADO_COMPRA[c.estado]} />,
                  })}
                />
              )}
            </FichaSeccion>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
            <FichaSeccion titulo="Saldo pendiente">
              <Box>
                <Typography variant="h5" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatUsd(saldo)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {abiertas > 0
                    ? `${abiertas} ${abiertas === 1 ? 'compra abierta' : 'compras abiertas'}`
                    : 'Sin compras abiertas'}
                </Typography>
              </Box>
            </FichaSeccion>

            <FichaSeccion titulo="Documentos">
              {documentos.length === 0 ? (
                <EmptyState compact title="Sin documentos" />
              ) : (
                <Box
                  component="ul"
                  aria-label="Documentos del proveedor"
                  sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}
                >
                  {documentos.map((d) => (
                    <Box
                      key={d.id}
                      component="li"
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
                    >
                      {d.mime_type === 'application/pdf' ? (
                        <PictureAsPdfOutlinedIcon fontSize="small" color="action" />
                      ) : (
                        <ImageIcon fontSize="small" color="action" />
                      )}
                      <Typography variant="body2" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                        {d.nombre_original ?? d.tipo}
                      </Typography>
                      {docUrls[d.id] ? (
                        <Button
                          size="small"
                          href={docUrls[d.id]}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Ver ${d.nombre_original ?? d.tipo} en pestaña nueva`}
                        >
                          Ver
                        </Button>
                      ) : null}
                    </Box>
                  ))}
                </Box>
              )}
            </FichaSeccion>
          </Box>
        </Box>

        {dialogos}
      </Box>
    </Fade>
  )
}