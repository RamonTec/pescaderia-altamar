import { notFound } from 'next/navigation'
import { EmpleadoFicha } from './empleado-ficha'
import { requireAdmin } from '@/lib/services/authService'
import { getCostoEmpleado, getEmpleado } from '@/lib/services/empleadoService'
import { listarGastos } from '@/lib/services/gastoService'
import { listarCategorias } from '@/lib/services/categoriaGastoService'
import { getConfigTasas } from '@/lib/services/tasaService'
import { rangoDesdeParams } from '@/lib/dashboardValidation'
import { fechaHoy } from '@/lib/format'
import { SinPermiso } from '@/components/organisms/PaginaFallback'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ficha del empleado (20-gastos, Fase B), solo admin: el operador recibe 404
 * (precedente `/gastos` y `/compras/[id]`). El rango va en `?desde`/`?hasta`
 * (por defecto el mes en curso): costo (solo pagos confirmados, por `fecha`,
 * P2) y pagos del rango en cualquier estado.
 */
export default async function EmpleadoFichaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await requireAdmin())) return <SinPermiso />

  const { id } = await params
  if (!UUID.test(id)) notFound()
  // El empleado primero: un id inexistente va a not-found sin lanzar lo demás.
  const empleado = await getEmpleado(id)
  if (!empleado) notFound()

  const hoy = fechaHoy()
  const { rango } = rangoDesdeParams(await searchParams, hoy)
  const [pagos, costo, categorias, configTasas] = await Promise.all([
    listarGastos({ rango, empleadoId: id, estado: 'todos' }),
    getCostoEmpleado(id, rango),
    listarCategorias(),
    getConfigTasas(),
  ])

  return (
    <EmpleadoFicha
      empleado={empleado}
      costo={costo}
      pagos={pagos}
      categorias={categorias}
      configTasas={configTasas}
      rango={rango}
      hoy={hoy}
    />
  )
}
