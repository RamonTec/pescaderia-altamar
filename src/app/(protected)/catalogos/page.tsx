import { AppShell } from '@/components/templates/AppShell'
import { PagePlaceholder } from '@/components/organisms/PagePlaceholder'

export default function CatalogosPage() {
  return (
    <AppShell>
      <PagePlaceholder
        title="Catálogos"
        description="Pantalla 1 (siguiente en definir): CRUD de productos, clientes, proveedores y configuración (IVA, fuentes de tasa)."
      />
    </AppShell>
  )
}
