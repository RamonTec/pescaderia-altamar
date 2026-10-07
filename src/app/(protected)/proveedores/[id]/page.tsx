import { notFound } from 'next/navigation'
import { ProveedorFicha } from './proveedor-ficha'
import { makeProveedorRepository } from '@/lib/repositories/proveedorRepository'
import { makeRepresentanteProveedorRepository } from '@/lib/repositories/representanteProveedorRepository'
import { makeMetodoPagoProveedorRepository } from '@/lib/repositories/metodoPagoProveedorRepository'
import { makeDocumentoProveedorRepository } from '@/lib/repositories/documentoProveedorRepository'
import { createClient } from '@/lib/supabase/server'
import { getSaldoPendiente } from '@/lib/services/proveedorBalanceService'
import { requireAdmin } from '@/lib/services/authService'
import type { Compra } from '@/types/domain'

/** Compra del historial de la ficha (el total real de una compra es `subtotal_usd`). */
export type CompraFicha = Pick<Compra, 'id' | 'fecha' | 'condicion' | 'subtotal_usd' | 'estado'>

/**
 * Ficha del proveedor: todo se carga aquí, en paralelo, y llega por props
 * (proveedor, saldo, representantes, métodos de pago, documentos con su URL
 * firmada y compras con su total real). La espera la cubre `loading.tsx` y un
 * fallo lo captura `error.tsx` (nunca secciones vacías).
 */
export default async function ProveedorFichaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // El proveedor primero: un id inexistente va a not-found sin lanzar las
  // demás consultas.
  const db = await createClient()
  const proveedor = await makeProveedorRepository(db).getById(id)
  if (!proveedor) notFound()

  const [saldo, esAdmin, representantes, metodos, documentos, compras] = await Promise.all([
    getSaldoPendiente(id, db),
    requireAdmin(),
    makeRepresentanteProveedorRepository(db).listByProveedor(id),
    makeMetodoPagoProveedorRepository(db).listByProveedor(id),
    makeDocumentoProveedorRepository(db).listByProveedor(id),
    // Historial del más reciente al más antiguo; el total real de la compra
    // es `subtotal_usd` (Σ peso × costo, congelado en USD al registrarla).
    db
      .from('compras')
      .select('id, fecha, condicion, subtotal_usd, estado')
      .eq('proveedor_id', id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .then(
        ({ data }): CompraFicha[] =>
          (data ?? []).map((c) => {
            const cruda = c as Record<string, unknown>
            return {
              id: String(cruda.id),
              fecha: String(cruda.fecha),
              condicion: cruda.condicion as CompraFicha['condicion'],
              subtotal_usd: Number(cruda.subtotal_usd),
              estado: cruda.estado as CompraFicha['estado'],
            }
          })
      ),
  ])

  // URL firmada de cada documento (para "Ver" en pestaña nueva). Si una
  // falla, la ficha sigue: esa fila queda sin botón.
  const docUrls: Record<string, string> = {}
  await Promise.all(
    documentos.map(async (d) => {
      const url = await makeDocumentoProveedorRepository(db).getUrlDescarga(d.id)
      if (url) docUrls[d.id] = url
    })
  )

  return (
    <ProveedorFicha
      proveedor={proveedor}
      saldo={saldo}
      esAdmin={esAdmin}
      representantes={representantes}
      metodos={metodos}
      documentos={documentos}
      docUrls={docUrls}
      compras={compras}
    />
  )
}