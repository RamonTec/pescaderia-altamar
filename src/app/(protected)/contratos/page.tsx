import { redirect } from 'next/navigation'
import { ContratosScreen } from './contratos-screen'
import { requireAdmin } from '@/lib/services/authService'
import { listar } from '@/lib/services/contratoService'
import { filtrosContratosSchema } from '@/lib/contratoValidation'

/**
 * Bitácora de contratos (06-contratos), solo admin. Filtros y página en la
 * URL (`?pagina=`, `?tipo=`, `?estado=`, `?q=`); el servidor trae la página.
 */
export default async function ContratosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await requireAdmin())) redirect('/')

  const params = await searchParams
  const plano = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  )
  const filtros = filtrosContratosSchema.parse(plano)
  const pagina = await listar(filtros)

  return <ContratosScreen contratos={pagina.rows} total={pagina.total} filtros={filtros} />
}
