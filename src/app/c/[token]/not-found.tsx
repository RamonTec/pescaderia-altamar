import { CotizacionNoDisponible } from '@/components/organisms/CotizacionNoDisponible'
import { getContactoNegocio } from '@/lib/services/cotizacionPublicaService'

/** Token con formato inválido: el mismo respaldo genérico (no revela nada). */
export default async function NotFound() {
  const negocio = await getContactoNegocio()
  return <CotizacionNoDisponible variante="generica" negocio={negocio} />
}
