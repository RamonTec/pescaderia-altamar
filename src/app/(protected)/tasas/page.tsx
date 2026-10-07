import { TasasScreen } from './tasas-screen'
import { requireAdmin } from '@/lib/services/authService'
import { getTasasVigentesHoy, listTasas } from '@/lib/services/tasaService'
import { listOperacionesTasaManual } from './operaciones-tasa-manual'
import { createClient } from '@/lib/supabase/server'

/**
 * `/tasas` (08-tasas): lectura para todos (tarjetas de vigentes hoy e
 * historial); acciones de admin ("Actualizar ahora", tasa manual del día y
 * pestaña de operaciones con tasa manual). El rol se resuelve en el server
 * como en el resto de páginas.
 */
export default async function TasasPage() {
  const db = await createClient()
  const esAdmin = await requireAdmin()

  const [vigentes, historial, operaciones] = await Promise.all([
    getTasasVigentesHoy(db),
    listTasas({ limit: 100 }, db),
    // "Operaciones con tasa manual" es el control del admin: al operador ni
    // siquiera le llegan los datos en el payload (mismo criterio que costos).
    esAdmin ? listOperacionesTasaManual(db) : Promise.resolve([]),
  ])

  return (
    <TasasScreen
      vigentes={vigentes}
      historial={historial}
      esAdmin={esAdmin}
      operaciones={operaciones}
    />
  )
}