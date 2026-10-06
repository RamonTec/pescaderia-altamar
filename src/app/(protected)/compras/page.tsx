import { AppShell } from '@/components/templates/AppShell'
import { PagePlaceholder } from '@/components/organisms/PagePlaceholder'

export default function ComprasPage() {
  return (
    <AppShell>
      <PagePlaceholder
        title="Compras"
        description="Pantalla 2: recepción de mercancía — pesar items, costo por kg, moneda, tasa del día, contado/crédito."
      />
    </AppShell>
  )
}
