import { notFound } from 'next/navigation'
import { ClienteFicha } from './cliente-ficha'
import {
  getCliente,
  getSaldoPendiente,
  listarFacturasDeCliente,
  listarPedidosDeCliente,
  listarRepresentantes,
} from '@/lib/services/clienteService'
import { requireAdmin } from '@/lib/services/authService'

/**
 * Ficha del cliente: todo se carga aquí, en paralelo, y llega por props.
 * La espera la cubre `loading.tsx` y un fallo lo captura `error.tsx`
 * (nunca secciones vacías).
 */
export default async function ClienteFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // El cliente primero: un id inexistente o mal formado va a not-found sin
  // lanzar las demás consultas (que fallarían con un id inválido).
  const cliente = await getCliente(id)
  if (!cliente) notFound()

  const [saldo, esAdmin, representantes, facturas, pedidos] = await Promise.all([
    getSaldoPendiente(id),
    requireAdmin(),
    listarRepresentantes(id),
    listarFacturasDeCliente(id),
    listarPedidosDeCliente(id),
  ])

  return (
    <ClienteFicha
      cliente={cliente}
      saldo={saldo}
      esAdmin={esAdmin}
      representantes={representantes}
      facturas={facturas}
      pedidos={pedidos}
    />
  )
}
