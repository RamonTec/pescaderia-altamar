import { AppShell } from '@/components/templates/AppShell'
import { PagePlaceholder } from '@/components/organisms/PagePlaceholder'

export default function InventarioPage() {
  return (
    <AppShell>
      <PagePlaceholder
        title="Inventario"
        description="Pantalla 6: stock por producto, valorización USD/Bs con costo ponderado, historial de movimientos."
      />
    </AppShell>
  )
}
