import { AppShell } from '@/components/templates/AppShell'
import { PagePlaceholder } from '@/components/organisms/PagePlaceholder'

export default function ProcesamientoPage() {
  return (
    <AppShell>
      <PagePlaceholder
        title="Procesamiento"
        description="Pantalla 3: lotes de limpieza — peso entrada → peso salida, merma %, rendimiento, costo resultante del kg procesado."
      />
    </AppShell>
  )
}
