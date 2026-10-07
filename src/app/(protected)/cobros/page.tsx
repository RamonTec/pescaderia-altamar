import { CobrosScreen } from './cobros-screen'
import { getConfigTasas } from '@/lib/services/tasaService'
import { cobrosAbiertos } from '@/lib/services/carteraService'
import { requireAdmin } from '@/lib/services/authService'
import { elegibilidadFacturas } from '@/lib/services/contratoService'

export default async function CobrosPage() {
  const [cobros, configTasas] = await Promise.all([
    // 09-cuentas-por-cobrar: facturas abiertas como documentos de cartera
    // (estado, vencimiento) + resumen global; sin montos para el operador.
    cobrosAbiertos(),
    // 08-tasas Fase D: fuente default + umbral de desviación para el
    // `TasaSelector` del abono.
    getConfigTasas(),
  ])

  // 06-contratos: elegibilidad de contrato de las facturas listadas, en lote
  // (solo admin; el operador no ve opciones de contrato).
  const contratos =
    cobros.facturas.length > 0 && (await requireAdmin())
      ? Object.fromEntries(await elegibilidadFacturas(cobros.facturas.map((f) => f.id)))
      : {}

  return <CobrosScreen cobros={cobros} configTasas={configTasas} contratos={contratos} />
}
