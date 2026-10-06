import { AppShell } from '@/components/templates/AppShell'
import { PagePlaceholder } from '@/components/organisms/PagePlaceholder'

export default function DashboardPage() {
  return (
    <AppShell>
      <PagePlaceholder
        title="Dashboard"
        description="Pantalla 7 (se define al final): tasa del día, ventas y margen del día, CxC/CxP, alertas de stock."
      />
    </AppShell>
  )
}
