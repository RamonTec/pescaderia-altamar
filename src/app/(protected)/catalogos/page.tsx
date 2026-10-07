import { AppShell } from '@/components/templates/AppShell'
import { PagePlaceholder } from '@/components/organisms/PagePlaceholder'

export default function CatalogosPage() {
  return (
    <AppShell>
      <PagePlaceholder
        title="Catálogos"
        description="CRUD de productos y proveedores, y configuración (IVA, fuentes de tasa). Los clientes se gestionan en su propio módulo (/clientes)."
      />
    </AppShell>
  )
}
