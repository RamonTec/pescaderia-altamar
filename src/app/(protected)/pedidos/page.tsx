import { AppShell } from '@/components/templates/AppShell'
import { PedidosScreen } from './pedidos-screen'
import { makePedidoRepository } from '@/lib/repositories/pedidoRepository'
import { makeClienteRepository } from '@/lib/repositories/clienteRepository'
import { makeProductoRepository } from '@/lib/repositories/catalogRepositories'
import { createClient } from '@/lib/supabase/server'

export default async function PedidosPage() {
  const db = await createClient()
  const [pedidos, clientes, productos] = await Promise.all([
    makePedidoRepository(db).list(),
    makeClienteRepository(db).list(),
    makeProductoRepository(db).list(),
  ])

  return (
    <AppShell>
      <PedidosScreen
        pedidos={pedidos}
        clientes={clientes.filter((c) => c.activo)}
        productos={productos.filter((p) => p.activo)}
      />
    </AppShell>
  )
}
