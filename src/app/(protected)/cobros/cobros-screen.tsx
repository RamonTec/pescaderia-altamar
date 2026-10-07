'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined'
import { PageHeader } from '@/components/molecules/PageHeader'
import { CarteraResumenCards } from '@/components/molecules/CarteraResumenCards'
import type { RowAction } from '@/components/molecules/RowActionsMenu'
import {
  DocumentosCarteraTable,
  type FiltroCartera,
} from '@/components/organisms/DocumentosCarteraTable'
import { RecordatorioDialog } from '@/components/organisms/RecordatorioDialog'
import { RegistrarPagoDialog } from '@/components/organisms/RegistrarPagoDialog'
import type { TasaSelectorConfig } from '@/components/organisms/TasaSelector'
import { estadoDe, estaAbierto } from '@/lib/cartera/estado'
import type { DocumentoCartera, EstadoCartera } from '@/lib/cartera/types'
import type { FacturaResumen } from '@/lib/repositories/interfaces'
import type { CobrosAbiertos } from '@/lib/services/carteraService'
import type { ElegibilidadContrato } from '@/types/domain'
import { useContratoAcciones } from '@/app/(protected)/contratos/useContratoAcciones'
import { numeroFactura } from '@/lib/repositories/carteraRepository'

interface Recordando {
  key: number
  clienteId: string
  clienteNombre: string
  facturaId: string
}

export function CobrosScreen({
  cobros,
  configTasas,
  contratos = {},
}: {
  cobros: CobrosAbiertos
  configTasas: TasaSelectorConfig
  /** Elegibilidad de contrato por factura (06-contratos, solo admin). */
  contratos?: Record<string, ElegibilidadContrato>
}) {
  const router = useRouter()
  const { documentos, resumen, facturas, contexto } = cobros
  const esAdmin = contexto.mostrarMontos
  const [cobrando, setCobrando] = React.useState<FacturaResumen | null>(null)
  const [recordando, setRecordando] = React.useState<Recordando | null>(null)
  const [filtro, setFiltro] = React.useState<FiltroCartera>('todas')
  const contratoAcciones = useContratoAcciones()
  const { accionesDeOrigen } = contratoAcciones

  const facturasPorId = React.useMemo(() => new Map(facturas.map((f) => [f.id, f])), [facturas])

  // La tabla no sabe qué es un abono ni un recordatorio: las acciones vienen de aquí.
  const acciones = React.useCallback(
    (doc: DocumentoCartera): RowAction[] => {
      if (!esAdmin) return []
      const lista: RowAction[] = []
      const factura = facturasPorId.get(doc.id)
      if (factura && Number(factura.total_usd) - Number(factura.pagado_usd) > 0.005) {
        lista.push({
          label: 'Registrar abono',
          icon: <PaymentsOutlinedIcon fontSize="small" />,
          onClick: () => setCobrando(factura),
        })
      }
      if (doc.contraparte && estaAbierto(estadoDe(doc, contexto.hoy, contexto.diasAviso))) {
        const contraparte = doc.contraparte
        lista.push({
          label: 'Recordar',
          icon: <NotificationsActiveOutlinedIcon fontSize="small" />,
          onClick: () =>
            setRecordando({
              key: Date.now(),
              clienteId: contraparte.id,
              clienteNombre: contraparte.nombre,
              facturaId: doc.id,
            }),
        })
      }
      // 06-contratos: generar / ver contrato de la factura a crédito.
      if (factura) {
        lista.push(
          ...accionesDeOrigen(
            {
              tipo: 'venta_credito',
              id: factura.id,
              fecha: String(factura.fecha).slice(0, 10),
              dias_credito_factura: Number(factura.dias_credito),
              etiqueta: `Factura ${numeroFactura(factura.numero)} · ${factura.cliente?.nombre ?? ''}`,
            },
            contratos[factura.id]
          )
        )
      }
      return lista
    },
    [esAdmin, facturasPorId, contexto.hoy, contexto.diasAviso, accionesDeOrigen, contratos]
  )

  return (
    <>
      <PageHeader title="Cobros y pagos" subtitle="Facturas por cobrar, de la más vencida a la más reciente" />

      <Box sx={{ display: 'grid', gap: 2 }}>
        <CarteraResumenCards
          resumen={resumen}
          seleccionado={filtro === 'todas' ? null : (filtro as EstadoCartera)}
          onSeleccionar={(estado) => setFiltro(estado && estado !== 'anulada' ? estado : 'todas')}
          label="Resumen de facturas por cobrar"
        />
        <DocumentosCarteraTable
          tableId="cobros"
          label="Facturas por cobrar"
          documentos={documentos}
          hoy={contexto.hoy}
          diasAviso={contexto.diasAviso}
          mostrarCliente
          mostrarMontos={contexto.mostrarMontos}
          renderAcciones={esAdmin ? acciones : undefined}
          filtro={filtro}
          onFiltroChange={setFiltro}
          nombre={{ singular: 'factura', plural: 'facturas por cobrar' }}
        />
      </Box>

      {esAdmin ? (
        <RegistrarPagoDialog
          key={cobrando?.id ?? 'cerrado'}
          factura={cobrando}
          configTasas={configTasas}
          onClose={() => setCobrando(null)}
        />
      ) : null}

      {esAdmin ? contratoAcciones.dialogos : null}

      {esAdmin && recordando ? (
        <RecordatorioDialog
          key={recordando.key}
          open
          clienteId={recordando.clienteId}
          clienteNombre={recordando.clienteNombre}
          facturaIds={[recordando.facturaId]}
          onClose={() => setRecordando(null)}
          onEnviado={() => router.refresh()}
        />
      ) : null}
    </>
  )
}
