import { notFound } from 'next/navigation'
import { LoteFicha } from './lote-ficha'
import { getTrazabilidad, resultadoLote } from '@/lib/services/loteService'
import { getConfigNegocio } from '@/lib/services/configService'
import { requireAdmin } from '@/lib/services/authService'
import type { TrazabilidadLote } from '@/types/domain'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ficha y trazabilidad de un lote (07-lotes): todo se carga aquí y llega por
 * props; la espera la cubre `loading.tsx`. El resultado (importes) solo se
 * calcula y se envía al admin; al operador los costos le llegan `null`.
 */
export default async function LoteFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const [traza, esAdmin, config] = await Promise.all([
    getTrazabilidad(id),
    requireAdmin(),
    getConfigNegocio(),
  ])
  if (!traza) notFound()

  // Defensa en profundidad: las vistas ya anulan el costo para el operador.
  const visible: TrazabilidadLote = esAdmin
    ? traza
    : {
        ...traza,
        lote: { ...traza.lote, costo_usd_kg: null },
        arbol: traza.arbol.map((l) => ({ ...l, costo_usd_kg: null })),
        ventas: traza.ventas.map((v) => ({ ...v, costo_usd_kg: null })),
      }

  return (
    <LoteFicha
      traza={visible}
      resultado={esAdmin ? resultadoLote(traza) : null}
      esAdmin={esAdmin}
      diasAlertaLote={config?.dias_alerta_lote ?? null}
    />
  )
}
