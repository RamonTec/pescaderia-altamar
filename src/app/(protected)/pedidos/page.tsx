import { AppShell } from '@/components/templates/AppShell'
import { PedidosScreen } from './pedidos-screen'
import { makePedidoRepository } from '@/lib/repositories/pedidoRepository'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { getConfigTasas } from '@/lib/services/tasaService'
import { getDiasCreditoDefault, getIvaPct } from '@/lib/services/configService'
import { createClient } from '@/lib/supabase/server'

export default async function PedidosPage(props: {
  searchParams?: Promise<{ pagina?: string; estado?: string; q?: string }>
}) {
  const params = await props.searchParams
  const pagina = params?.pagina ? parseInt(params.pagina, 10) : 0
  const estado = (params?.estado as ('todos' | 'pendiente' | 'entregado' | 'facturado' | 'anulado')) || 'todos'
  const q = params?.q || ''

  const db = await createClient()
  const [pedidosPage, clientes, productos, configTasas, diasCreditoDefault, ivaPct] = await Promise.all([
    makePedidoRepository(db).list({ page: pagina, pageSize: 10, estado, q }),
    makeClienteRepository(db).list(),
    makeProductoRepository(db).list(),
    // 08-tasas Fase D: fuente default + umbral de desviación para el
    // `TasaSelector` de la venta directa y de la entrega.
    getConfigTasas(db),
    // 09: días de crédito por defecto para precargar la venta a crédito.
    getDiasCreditoDefault(db),
    // 18: % de IVA de las ventas con IVA (interruptor y totales).
    getIvaPct(db),
  ])

  return (
    <AppShell>
      <PedidosScreen
        pedidos={pedidosPage.rows}
        totalPedidos={pedidosPage.total}
        clientes={clientes.filter((c) => c.activo)}
        productos={productos.filter((p) => p.activo)}
        configTasas={configTasas}
        diasCreditoDefault={diasCreditoDefault}
        ivaPct={ivaPct}
      />
    </AppShell>
  )
}
