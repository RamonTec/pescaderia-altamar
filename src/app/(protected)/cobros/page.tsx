import { CobrosScreen } from './cobros-screen'
import { getConfigTasas } from '@/lib/services/tasaService'
import { cobrosAbiertos } from '@/lib/services/carteraService'

export default async function CobrosPage() {
  const [cobros, configTasas] = await Promise.all([
    // 09-cuentas-por-cobrar: facturas abiertas como documentos de cartera
    // (estado, vencimiento) + resumen global; sin montos para el operador.
    cobrosAbiertos(),
    // 08-tasas Fase D: fuente default + umbral de desviación para el
    // `TasaSelector` del abono.
    getConfigTasas(),
  ])

  return <CobrosScreen cobros={cobros} configTasas={configTasas} />
}
