import { notFound } from 'next/navigation'
import { ClienteFicha } from './cliente-ficha'
import {
  getCliente,
  getSaldoPendiente,
  listarPedidosDeCliente,
  listarRepresentantes,
} from '@/lib/services/clienteService'
import { requireAdmin } from '@/lib/services/authService'
import { carteraDeCliente } from '@/lib/services/carteraService'
import { getDiasCreditoDefault } from '@/lib/services/configService'
import { historialDeCliente } from '@/lib/services/recordatorioService'
import { elegibilidadFacturas } from '@/lib/services/contratoService'

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

  const [saldo, esAdmin, representantes, pedidos, cartera, recordatorios, diasCreditoDefault] =
    await Promise.all([
      getSaldoPendiente(id),
      requireAdmin(),
      listarRepresentantes(id),
      listarPedidosDeCliente(id),
      // 09-cuentas-por-cobrar: facturas con estado de cobro + historial.
      carteraDeCliente(id),
      historialDeCliente(id),
      getDiasCreditoDefault(),
    ])

  // 06-contratos: elegibilidad de contrato de las facturas del cliente, en
  // lote (solo admin). Necesita los ids de la cartera: va después del Promise.all.
  const contratos =
    esAdmin && cartera.documentos.length > 0
      ? Object.fromEntries(await elegibilidadFacturas(cartera.documentos.map((d) => d.id)))
      : {}

  return (
    <ClienteFicha
      cliente={cliente}
      saldo={saldo}
      esAdmin={esAdmin}
      representantes={representantes}
      pedidos={pedidos}
      cartera={cartera}
      recordatorios={recordatorios}
      diasCreditoDefault={diasCreditoDefault}
      contratos={contratos}
    />
  )
}
