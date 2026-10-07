import { ClientesScreen } from './clientes-screen'
import { listarClientes } from '@/lib/services/clienteService'
import { requireAdmin } from '@/lib/services/authService'

export default async function ClientesPage() {
  const [clientes, esAdmin] = await Promise.all([listarClientes(), requireAdmin()])

  return <ClientesScreen clientes={clientes} esAdmin={esAdmin} />
}
