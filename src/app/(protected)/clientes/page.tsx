import { ClientesScreen } from './clientes-screen'
import { listarClientes } from '@/lib/services/clienteService'
import { requireAdmin } from '@/lib/services/authService'
import { resumenPorCliente } from '@/lib/services/carteraService'
import { getDiasCreditoDefault } from '@/lib/services/configService'

export default async function ClientesPage() {
  // Cartera (09): una sola consulta a `cartera_clientes_view` para todos.
  const [clientes, esAdmin, cartera, diasCreditoDefault] = await Promise.all([
    listarClientes(),
    requireAdmin(),
    resumenPorCliente(),
    getDiasCreditoDefault(),
  ])

  return (
    <ClientesScreen
      clientes={clientes}
      esAdmin={esAdmin}
      cartera={Object.fromEntries(cartera)}
      diasCreditoDefault={diasCreditoDefault}
    />
  )
}
