import { AppShell } from '@/components/templates/AppShell'
import { PagePlaceholder } from '@/components/organisms/PagePlaceholder'

export default function CobrosPage() {
  return (
    <AppShell>
      <PagePlaceholder
        title="Cobros y Pagos"
        description="Pantalla 5: cuentas por cobrar/pagar; abonos con la tasa del día del pago y ganancia cambiaria."
      />
    </AppShell>
  )
}
