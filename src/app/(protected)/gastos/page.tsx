import { notFound } from 'next/navigation'
import { GastosScreen } from './gastos-screen'
import { requireAdmin } from '@/lib/services/authService'
import { listarGastos, resumirGastos } from '@/lib/services/gastoService'
import { listarCategorias } from '@/lib/services/categoriaGastoService'
import { getConfigTasas } from '@/lib/services/tasaService'
import { listarEmpleados, pagadoPorEmpleado } from '@/lib/services/empleadoService'
import { mesDe } from '@/lib/gastos/periodos'
import { rangoDesdeParams } from '@/lib/dashboardValidation'
import { mapaCategorias } from '@/lib/gastos/textos'
import { fechaHoy } from '@/lib/format'

/**
 * Gastos operativos (20-gastos), solo admin: el operador recibe 404 (no se
 * revela que la pantalla existe, precedente `/compras/[id]`). El rango va en
 * `?desde`/`?hasta` (por defecto el mes en curso) y el servidor trae los
 * gastos de ese rango por `fecha` (P2); estado (`?estado=`), categoría
 * (`?categoria=`) y pestaña (`?tab=`) se filtran en el cliente. Fase B:
 * empleados con lo pagado en el mes en curso (pestaña Empleados).
 */
export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!(await requireAdmin())) notFound()

  const params = await searchParams
  const hoy = fechaHoy()
  const { rango } = rangoDesdeParams(params, hoy)
  // "Pagado este mes" de la pestaña Empleados: mes en curso hasta hoy.
  const mesEnCurso = { desde: mesDe(hoy).desde, hasta: hoy }
  const [gastos, categorias, configTasas, empleados, pagadoMes] = await Promise.all([
    listarGastos({ rango }),
    listarCategorias(),
    getConfigTasas(),
    listarEmpleados(),
    pagadoPorEmpleado(mesEnCurso),
  ])
  // Totales del rango con la misma lista (sin otra lectura): solo confirmados.
  const resumen = resumirGastos(gastos, [...mapaCategorias(categorias).values()])

  return (
    <GastosScreen
      gastos={gastos}
      categorias={categorias}
      resumen={resumen}
      rango={rango}
      hoy={hoy}
      configTasas={configTasas}
      empleados={empleados}
      pagadoMes={pagadoMes}
    />
  )
}
