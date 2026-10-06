import { AppShell } from '@/components/templates/AppShell'
import { PagePlaceholder } from '@/components/organisms/PagePlaceholder'

export default function PedidosPage() {
  return (
    <AppShell>
      <PagePlaceholder
        title="Pedidos / POS"
        description="Pantalla 4: venta directa + pedidos agendados; pesaje de entrega; emisión de factura con IVA desglosado."
      />
    </AppShell>
  )
}
