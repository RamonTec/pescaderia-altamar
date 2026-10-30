import { notFound } from 'next/navigation'
import { FacturaFicha } from './factura-ficha'
import { requireAdmin } from '@/lib/services/authService'
import { getDetalleFactura } from '@/lib/services/trazabilidadFacturaService'
import { getContextoCartera } from '@/lib/services/carteraService'
import { getIvaPct } from '@/lib/services/configService'
import { SinPermiso } from '@/components/organisms/PaginaFallback'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ficha de una factura con su trazabilidad y correcciones (17). Solo admin:
 * muestra costos y márgenes. Para el operador, `notFound()`: no revela que la
 * factura existe. Todo se carga aquí y llega por props; la espera la cubre
 * `loading.tsx` y un fallo `error.tsx`.
 */
export default async function FacturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  if (!(await requireAdmin())) return <SinPermiso />

  // 18: el % de IVA vigente es el que aplica «Aplicar IVA».
  const [detalle, contexto, ivaPctConfig] = await Promise.all([
    getDetalleFactura(id),
    getContextoCartera(),
    getIvaPct(),
  ])
  if (!detalle) notFound()

  return (
    <FacturaFicha detalle={detalle} hoy={contexto.hoy} diasAviso={contexto.diasAviso} ivaPctConfig={ivaPctConfig} />
  )
}
