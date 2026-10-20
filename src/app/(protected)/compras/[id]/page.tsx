import { notFound } from 'next/navigation'
import { CompraFicha } from './compra-ficha'
import { requireAdmin } from '@/lib/services/authService'
import { getDetalleCompra } from '@/lib/services/edicionCompraService'
import { getConfigTasas } from '@/lib/services/tasaService'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Ficha de una compra con sus líneas, lotes, pagos, contrato e historial de
 * ediciones (19). Solo admin: muestra costos. Para el operador,
 * `notFound()`: no revela que la compra existe. `?editar=1` abre el diálogo
 * "Editar compra" al cargar (entrada desde el `⋮` de `/compras` y del
 * historial del proveedor). Todo se carga aquí y llega por props; la espera
 * la cubre `loading.tsx` y un fallo `error.tsx`.
 */
export default async function CompraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  if (!UUID.test(id)) notFound()
  if (!(await requireAdmin())) notFound()

  const db = await createClient()
  const [detalle, proveedores, configTasas] = await Promise.all([
    getDetalleCompra(id, db),
    makeProveedorRepository(db).list({ incluirInactivos: true }),
    getConfigTasas(db),
  ])
  if (!detalle) notFound()

  return (
    <CompraFicha
      detalle={detalle}
      // Activos y el actual de la compra (aunque esté inactivo).
      proveedores={proveedores.filter((p) => p.activo || p.id === detalle.compra.proveedor.id)}
      configTasas={configTasas}
      editarAlCargar={query.editar === '1' && detalle.compra.estado !== 'anulada'}
    />
  )
}
