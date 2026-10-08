'use client'

import * as React from 'react'
import Link from 'next/link'
import Button from '@mui/material/Button'
import { ChartCard } from '@/components/molecules/ChartCard'
import { ListaResumen } from '@/components/molecules/ListaResumen'
import { EstadoChip } from './appDataGridColumns'
import type { BloqueDashboard, ContratoPendienteFirma } from '@/types/domain'
import { ETIQUETA_TIPO_CONTRATO } from '@/lib/dashboard/etiquetas'
import { numeroContrato } from '@/lib/contratos/textos'
import { formatEntero, formatFecha } from '@/lib/format'

/**
 * Contratos sin firmar (15, agregado 14; solo admin): `generado` o `enviado`,
 * con contraparte, fechas y días desde que se generó. Enlace a `/contratos`.
 */
export function ContratosSinFirmarList({ contratos }: { contratos: BloqueDashboard<ContratoPendienteFirma[]> }) {
  const filas = contratos.ok ? contratos.data : []
  return (
    <ChartCard
      title="Contratos sin firmar"
      help="Generados o enviados, del más antiguo al más reciente."
      error={contratos.ok ? null : contratos.error}
      empty={filas.length === 0}
      emptyTitle="Todos los contratos están firmados"
      skeletonHeight={200}
      action={
        <Button component={Link} href="/contratos" size="small">
          Ver contratos
        </Button>
      }
    >
      <ListaResumen
        ariaLabel="Contratos sin firmar"
        filas={filas.map((c) => ({
          id: c.contrato_id,
          href: '/contratos',
          primary: `${numeroContrato(c.numero)} · ${c.contraparte_nombre ?? '—'}`,
          secondary: `${ETIQUETA_TIPO_CONTRATO[c.tipo]} · ${formatFecha(c.fecha)} · vence ${formatFecha(c.fecha_vencimiento)}`,
          amount: `${formatEntero(c.dias_desde_generado)} d`,
          amountDetail: 'desde que se generó',
          status: <EstadoChip label={c.estado === 'enviado' ? 'Enviado' : 'Generado'} color={c.estado === 'enviado' ? 'info' : 'warning'} />,
        }))}
      />
    </ChartCard>
  )
}
