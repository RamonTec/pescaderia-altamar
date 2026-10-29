'use client'

import * as React from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Fade from '@mui/material/Fade'
import Link from '@mui/material/Link'
import { useTheme } from '@mui/material/styles'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { EmptyState } from '@/components/molecules/EmptyState'
import { FichaHeader } from '@/components/molecules/FichaHeader'
import { FichaSeccion } from '@/components/molecules/FichaSeccion'
import { ListaResumen, type FilaResumen } from '@/components/molecules/ListaResumen'
import { EstadoChip } from '@/components/organisms/appDataGridColumns'
import { ESTADOS_COMPRA } from '@/components/organisms/ComprasTable'
import { CompraLineasLotes } from '@/components/organisms/CompraLineasLotes'
import { CompraResumenCard } from '@/components/organisms/CompraResumenCard'
import { EditarCompraDialog } from '@/components/organisms/EditarCompraDialog'
import { HistorialCorreccionesCompra } from '@/components/organisms/HistorialCorreccionesCompra'
import type { TasaSelectorConfig } from '@/components/organisms/TasaSelector'
import { tituloCompra } from '@/lib/compras/textos'
import { numeroContrato } from '@/lib/contratos/textos'
import { ETIQUETA_CONDICION, ETIQUETA_METODO, ETIQUETA_MONEDA } from '@/lib/dashboard/etiquetas'
import { formatBs, formatFecha, formatTasa, formatUsd } from '@/lib/format'
import type { EditarCompraValues } from '@/lib/compraEdicionValidation'
import type { DetalleCompra, Proveedor } from '@/types/domain'
import { editarCompraAction } from './actions'

const ESTADO_CONTRATO: Record<string, string> = {
  generado: 'Generado',
  enviado: 'Enviado',
  firmado: 'Firmado',
}

export interface CompraFichaProps {
  detalle: DetalleCompra
  proveedores: Proveedor[]
  configTasas: TasaSelectorConfig
  /** `?editar=1`: abre "Editar compra" al cargar. */
  editarAlCargar: boolean
}

/**
 * Ficha de una compra (19, solo admin): resumen con saldo o saldo a favor,
 * líneas con sus lotes y procesados, pagos, contrato activo e historial de
 * ediciones. "Editar compra" abre `EditarCompraDialog`.
 */
export function CompraFicha({ detalle, proveedores, configTasas, editarAlCargar }: CompraFichaProps) {
  const router = useRouter()
  const theme = useTheme()
  const { compra, contrato, correcciones } = detalle
  const anulada = compra.estado === 'anulada'
  const [editando, setEditando] = React.useState(editarAlCargar)
  // Cada apertura monta el diálogo de cero (valores vigentes, motivo vacío).
  const [apertura, setApertura] = React.useState(0)
  const estado = ESTADOS_COMPRA[compra.estado]

  const abrir = () => {
    setApertura((n) => n + 1)
    setEditando(true)
  }
  const cerrar = () => {
    setEditando(false)
    // Sin `?editar=1`: recargar la ficha no vuelve a abrir el diálogo.
    if (editarAlCargar) router.replace(`/compras/${compra.id}`, { scroll: false })
  }

  const pagos: FilaResumen[] = detalle.pagos.map((p) => ({
    id: p.id,
    primary: `${formatUsd(p.monto_usd)} · ${ETIQUETA_METODO[p.metodo]}`,
    secondary: `${formatFecha(p.fecha)} · ${p.moneda_pago === 'bs' ? `en Bs a ${formatTasa(p.tasa_pago)}` : 'en USD'}`,
    amount: p.moneda_pago === 'bs' ? formatBs(p.monto_usd * p.tasa_pago) : undefined,
    amountDetail:
      p.moneda_pago === 'bs' && p.ganancia_cambiaria_bs !== 0
        ? `${p.ganancia_cambiaria_bs >= 0 ? 'Ganancia' : 'Pérdida'} cambiaria ${formatBs(Math.abs(p.ganancia_cambiaria_bs))}`
        : undefined,
  }))

  const onEditar = React.useCallback((values: EditarCompraValues) => editarCompraAction(values), [])

  return (
    <Fade in timeout={theme.transitions.duration.short}>
      <Box sx={{ display: 'grid', gap: 3 }}>
        <FichaHeader
          backHref="/compras"
          backLabel="Compras"
          title={tituloCompra(compra.fecha)}
          meta={
            <>
              <Link component={NextLink} href={`/proveedores/${compra.proveedor.id}`} underline="hover">
                {compra.proveedor.nombre}
              </Link>
              <span>{ETIQUETA_CONDICION[compra.condicion]}</span>
              <span>{ETIQUETA_MONEDA[compra.moneda]}</span>
              <EstadoChip label={estado.label} color={estado.color} />
              {correcciones.length > 0 ? (
                <EstadoChip tono="neutral" label={`Editada · ${correcciones.length}`} />
              ) : null}
              {contrato?.desactualizado ? (
                <EstadoChip
                  tono="warning"
                  label="Contrato desactualizado"
                  tooltip={`El contrato ${numeroContrato(contrato.numero)} es anterior a una edición: anúlalo y genera otro desde Compras o Contratos`}
                />
              ) : null}
              {anulada ? <span>Anulada: no se puede editar</span> : null}
            </>
          }
          primaryAction={{
            label: 'Editar compra',
            icon: <EditOutlinedIcon />,
            onClick: abrir,
            disabled: anulada,
          }}
        />

        <Box
          sx={{
            display: 'grid',
            gap: 3,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
            <CompraLineasLotes lineas={detalle.lineas} moneda={compra.moneda} />

            <FichaSeccion titulo="Historial de ediciones">
              <HistorialCorreccionesCompra correcciones={correcciones} />
            </FichaSeccion>
          </Box>

          <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
            <CompraResumenCard detalle={detalle} />

            <FichaSeccion titulo="Pagos">
              {pagos.length > 0 ? (
                <ListaResumen filas={pagos} ariaLabel="Pagos de la compra" />
              ) : (
                <EmptyState
                  compact
                  icon={<PaymentsOutlinedIcon fontSize="large" />}
                  title={compra.condicion === 'contado' ? 'Pagada al registrar' : 'Sin abonos'}
                />
              )}
            </FichaSeccion>

            <FichaSeccion titulo="Contrato">
              {contrato ? (
                <ListaResumen
                  ariaLabel="Contrato de la compra"
                  filas={[
                    {
                      id: contrato.id,
                      primary: `Contrato ${numeroContrato(contrato.numero)}`,
                      secondary: `${ESTADO_CONTRATO[contrato.estado] ?? contrato.estado} · ${formatFecha(contrato.created_at)} · Ver PDF`,
                      status: contrato.desactualizado ? (
                        <EstadoChip tono="warning" label="Desactualizado" />
                      ) : undefined,
                      href: `/contratos/${contrato.id}/pdf`,
                    },
                  ]}
                />
              ) : (
                <EmptyState compact icon={<DescriptionOutlinedIcon fontSize="large" />} title="Sin contrato activo" />
              )}
            </FichaSeccion>
          </Box>
        </Box>

        {!anulada ? (
          <EditarCompraDialog
            key={`editar-${apertura}`}
            detalle={detalle}
            open={editando}
            proveedores={proveedores}
            configTasas={configTasas}
            onClose={cerrar}
            onEditar={onEditar}
            onEditada={() => router.refresh()}
          />
        ) : null}
      </Box>
    </Fade>
  )
}
