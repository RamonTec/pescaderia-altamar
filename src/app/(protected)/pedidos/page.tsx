import { AppShell } from '@/components/templates/AppShell'
import { PedidosScreen } from './pedidos-screen'
import { makePedidoRepository } from '@/lib/repositories/pedidoRepository'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { getConfigTasas } from '@/lib/services/tasaService'
import { createClient } from '@/lib/supabase/server'

export default async function PedidosPage() {
  const db = await createClient()
  const [pedidos, clientes, productos, configTasas] = await Promise.all([
    makePedidoRepository(db).list(),
    makeClienteRepository(db).list(),
    makeProductoRepository(db).list(),
    // 08-tasas Fase D: fuente default + umbral de desviación para el
    // `TasaSelector` de la venta directa y de la entrega.
    getConfigTasas(db),
  ])

  return (
    <AppShell>
      <PedidosScreen
        pedidos={pedidos}
        clientes={clientes.filter((c) => c.activo)}
        productos={productos.filter((p) => p.activo)}
        configTasas={configTasas}
      />
    </AppShell>
  )
}
