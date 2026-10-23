'use client'

import * as React from 'react'
import NextLink from 'next/link'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { FichaHeader } from '@/components/molecules/FichaHeader'
import { FichaDato, FichaDatos, FichaSeccion } from '@/components/molecules/FichaSeccion'
import { CotizacionEstadoChip } from '@/components/molecules/CotizacionEstadoChip'
import type { RowAction } from '@/components/molecules/RowActionsMenu'
import { CotizacionDocumento } from '@/components/organisms/CotizacionDocumento'
import { EnlacePublicoCotizacion } from '@/components/organisms/EnlacePublicoCotizacion'
import { urlPublica } from '@/lib/cotizaciones/enlace'
import { accionesPermitidas, estadoEfectivo } from '@/lib/cotizaciones/estado'
import { documentoDesdeDetalle } from '@/lib/cotizaciones/documento'
import { formatNumeroCotizacion } from '@/lib/cotizaciones/numero'
import { formatFecha, formatFechaHora } from '@/lib/format'
import type { CatalogoCotizacion } from '@/lib/services/cotizacionService'
import type { CotizacionDetalle } from '@/types/domain'
import { useCotizacionAcciones } from '../useCotizacionAcciones'

function Evento({ titulo, por, cuando, detalle }: { titulo: string; por: string | null; cuando: string | null; detalle?: string | null }) {
  if (!cuando) return null
  return (
    <Box component="li" sx={{ display: 'grid', gap: 0.25 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {titulo}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {formatFechaHora(cuando)}
        {por ? ` · ${por}` : ''}
      </Typography>
      {detalle ? (
        <Typography variant="caption" color="text.secondary">
          Motivo: {detalle}
        </Typography>
      ) : null}
    </Box>
  )
}

/**
 * Ficha de una cotización (21-cotizaciones): encabezado con número, cliente
 * y estado (y «Vencida» derivada, «Actualizada después de enviar»); detalle
 * con el mismo orden que el PDF; cliente; notas y términos (notas internas
 * rotuladas «Solo interno»); historial.
 */
export function CotizacionFicha({
  cotizacion: c,
  catalogo,
  hoy,
  baseEnlace,
}: {
  cotizacion: CotizacionDetalle
  catalogo: CatalogoCotizacion
  hoy: string
  /** Base absoluta de los enlaces públicos (servidor). */
  baseEnlace: string
}) {
  const { abrirFormulario, responder, anular, compartir, convertir, dialogos } = useCotizacionAcciones(catalogo, hoy)
  const estado = estadoEfectivo(c, hoy)
  const permitidas = accionesPermitidas(estado, c.pedido_id !== null)
  const nombreCliente = c.cliente?.nombre ?? c.cliente_nombre ?? '—'
  const resumen = { id: c.id, numero: c.numero, cliente: nombreCliente, total_usd: c.total_usd }
  const actualizadaTrasEnviar =
    c.enviada_at !== null && Date.parse(c.updated_at) - Date.parse(c.enviada_at) > 1000

  const menu: RowAction[] = []
  if (permitidas.has('editar')) {
    menu.push({ label: 'Editar', onClick: () => void abrirFormulario('editar', c) })
  }
  if (permitidas.has('descargar_pdf')) {
    menu.push({
      label: 'Descargar PDF',
      // En el mismo clic (sin `await` previo) para que no lo bloqueen como emergente.
      onClick: () => window.open(`/cotizaciones/${c.id}/pdf?descargar=1`, '_blank', 'noopener'),
    })
    menu.push({ label: 'Ver PDF', onClick: () => window.open(`/cotizaciones/${c.id}/pdf`, '_blank', 'noopener') })
  }
  if (c.token_publico) {
    const urlCliente = urlPublica(c.token_publico, baseEnlace)
    menu.push({ label: 'Ver como el cliente', onClick: () => window.open(urlCliente, '_blank', 'noopener,noreferrer') })
  }
  if (permitidas.has('aceptar')) menu.push({ label: 'Marcar aceptada', onClick: () => responder(resumen, 'aceptada') })
  if (permitidas.has('rechazar')) menu.push({ label: 'Marcar rechazada', onClick: () => responder(resumen, 'rechazada') })
  if (permitidas.has('renovar')) menu.push({ label: 'Renovar', onClick: () => void abrirFormulario('renovar', c) })
  if (permitidas.has('duplicar')) menu.push({ label: 'Duplicar', onClick: () => void abrirFormulario('duplicar', c) })
  if (permitidas.has('convertir_pedido')) {
    menu.push({
      label: 'Convertir en pedido',
      onClick: () =>
        convertir({
          id: c.id,
          numero: c.numero,
          cliente: nombreCliente,
          clienteRegistrado: c.cliente_id !== null,
          enviada: c.estado === 'enviada',
        }),
    })
  }
  if (permitidas.has('anular')) menu.push({ label: 'Anular', destructive: true, onClick: () => anular(resumen) })

  return (
    <>
      <FichaHeader
        backHref="/cotizaciones"
        backLabel="Cotizaciones"
        title={formatNumeroCotizacion(c.numero)}
        meta={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {nombreCliente}
            </Typography>
            <CotizacionEstadoChip estado={estado} />
            {actualizadaTrasEnviar && (c.estado === 'enviada' || estado === 'vencida') ? (
              <Typography variant="caption" color="warning.main">
                Actualizada después de enviar
              </Typography>
            ) : null}
          </Box>
        }
        primaryAction={
          c.estado !== 'anulada'
            ? {
                label: 'Compartir',
                icon: <ShareOutlinedIcon />,
                onClick: () =>
                  compartir({ id: c.id, numero: c.numero, cliente: nombreCliente, estado_efectivo: estado }),
              }
            : undefined
        }
        menuActions={menu}
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' },
          alignItems: 'start',
        }}
      >
        <FichaSeccion titulo="Detalle">
          <Typography variant="body2" color="text.secondary">
            Fecha {formatFecha(c.fecha)} · Válida hasta {formatFecha(c.fecha_vencimiento)} ({c.validez_dias} días)
          </Typography>
          <CotizacionDocumento datos={documentoDesdeDetalle(c)} sinEncabezado sinNotas />
        </FichaSeccion>

        <Box sx={{ display: 'grid', gap: 2 }}>
          <FichaSeccion titulo="Cliente">
            <FichaDatos>
              <FichaDato label="Nombre">
                {c.cliente ? (
                  <Link component={NextLink} href={`/clientes/${c.cliente.id}`}>
                    {c.cliente.nombre}
                  </Link>
                ) : (
                  `${nombreCliente} (cliente libre)`
                )}
              </FichaDato>
              {c.cliente ? <FichaDato label="RIF/CI">{c.cliente.rif_ci}</FichaDato> : null}
              <FichaDato label="Teléfono">{c.cliente ? c.cliente.telefono : c.cliente_telefono}</FichaDato>
            </FichaDatos>
            {c.pedido_id ? (
              <Typography variant="body2">
                Convertida en pedido.{' '}
                <Link component={NextLink} href="/pedidos">
                  Ver en Pedidos
                </Link>
              </Typography>
            ) : null}
            {c.cliente?.bloqueado ? (
              <Typography variant="caption" color="error.main">
                Cliente bloqueado: no se le vende a crédito.
              </Typography>
            ) : null}
          </FichaSeccion>

          <FichaSeccion titulo="Historial">
            <Box component="ul" sx={{ display: 'grid', gap: 1.5, m: 0, p: 0, listStyle: 'none' }}>
              <Evento titulo="Creada" por={c.creado_por_nombre} cuando={c.created_at} />
              <Evento titulo="Enviada" por={c.enviada_por_nombre} cuando={c.enviada_at} />
              <Evento
                titulo={
                  c.estado === 'aceptada'
                    ? 'Aceptada'
                    : c.estado === 'rechazada' || c.motivo_rechazo
                      ? 'Rechazada'
                      : 'Respondida'
                }
                por={c.respondida_por_nombre}
                cuando={c.respondida_at}
                detalle={c.motivo_rechazo}
              />
              <Evento titulo="Anulada" por={c.anulada_por_nombre} cuando={c.anulada_at} detalle={c.motivo_anulacion} />
              {c.updated_by ? (
                <Evento titulo="Última modificación" por={c.actualizado_por_nombre} cuando={c.updated_at} />
              ) : null}
            </Box>
          </FichaSeccion>
        </Box>

        <FichaSeccion titulo="Enlace público">
          <EnlacePublicoCotizacion
            id={c.id}
            token={c.token_publico}
            base={baseEnlace}
            generadoAt={c.token_generado_at}
            generadoPor={c.token_generado_por_nombre}
            anulada={c.estado === 'anulada'}
            vencida={estado === 'vencida'}
          />
        </FichaSeccion>

        <FichaSeccion titulo="Notas y términos">
          <FichaDatos>
            <FichaDato label="Notas para el cliente">
              {c.notas_cliente ? <Box component="span" sx={{ whiteSpace: 'pre-line' }}>{c.notas_cliente}</Box> : null}
            </FichaDato>
            <FichaDato label="Términos">
              {c.terminos ? <Box component="span" sx={{ whiteSpace: 'pre-line' }}>{c.terminos}</Box> : null}
            </FichaDato>
            <FichaDato label="Notas internas (solo interno)">
              {c.notas_internas ? <Box component="span" sx={{ whiteSpace: 'pre-line' }}>{c.notas_internas}</Box> : null}
            </FichaDato>
          </FichaDatos>
        </FichaSeccion>
      </Box>

      {dialogos}
    </>
  )
}
