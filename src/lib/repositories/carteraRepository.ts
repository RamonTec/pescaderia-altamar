import type { SupabaseClient } from '@supabase/supabase-js'
import type { FacturaCartera, FilaCarteraCliente, ICarteraRepository } from './interfaces'
import type { NotaCredito } from '@/types/domain'
import type { DocumentoCartera } from '@/lib/cartera/types'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de cartera (09-cuentas-por-cobrar).
 * Solo lectura: el resumen por cliente sale de `cartera_clientes_view` (una
 * consulta para todos) y los documentos, de `facturas` con sus notas de
 * crédito embebidas (una consulta).
 */

const SELECT_FACTURA_CARTERA =
  '*, cliente:clientes(id, nombre, rif_ci), notas_credito(total_usd, estado)'

type FilaFactura = Omit<FacturaCartera, 'creditos_usd'> & {
  notas_credito: Pick<NotaCredito, 'total_usd' | 'estado'>[] | null
}

function conCreditos(fila: FilaFactura): FacturaCartera {
  const { notas_credito, ...factura } = fila
  const creditos = (notas_credito ?? [])
    .filter((n) => n.estado === 'emitida')
    .reduce((s, n) => s + Number(n.total_usd), 0)
  return { ...factura, creditos_usd: Math.round(creditos * 1e6) / 1e6 }
}

/** `123` → `F-000123`. */
export function numeroFactura(numero: number | string): string {
  return `F-${String(numero).padStart(6, '0')}`
}

/** Adaptador factura → documento de cartera (el núcleo no conoce `Factura`). */
export function facturaADocumentoCartera(f: FacturaCartera): DocumentoCartera {
  return {
    id: f.id,
    numero: numeroFactura(f.numero),
    fecha: String(f.fecha).slice(0, 10),
    // Facturas anteriores a la migración sin vencimiento: vencen el día de emisión.
    fecha_vencimiento: String(f.fecha_vencimiento ?? f.fecha).slice(0, 10),
    total_usd: Number(f.total_usd),
    pagado_usd: Number(f.pagado_usd),
    creditos_usd: Number(f.creditos_usd),
    anulado: f.estado === 'anulada',
    contraparte: f.cliente
      ? { id: f.cliente.id, nombre: f.cliente.nombre, detalle: f.cliente.rif_ci }
      : null,
  }
}

export function makeCarteraRepository(db: SupabaseClient = createClient()): ICarteraRepository {
  return {
    async resumenPorCliente() {
      const { data, error } = await db.from('cartera_clientes_view').select('*')
      if (error) throw error
      return ((data ?? []) as FilaCarteraCliente[]).map((f) => ({
        ...f,
        saldo_usd: f.saldo_usd === null ? null : Number(f.saldo_usd),
        saldo_vencido_usd: f.saldo_vencido_usd === null ? null : Number(f.saldo_vencido_usd),
      }))
    },
    async documentosPorCliente(clienteId) {
      const { data, error } = await db
        .from('facturas')
        .select(SELECT_FACTURA_CARTERA)
        .eq('cliente_id', clienteId)
        .order('numero', { ascending: false })
      if (error) throw error
      return ((data ?? []) as unknown as FilaFactura[]).map(conCreditos)
    },
    async documentosAbiertos() {
      const { data, error } = await db
        .from('facturas')
        .select(SELECT_FACTURA_CARTERA)
        .eq('estado', 'abierta')
        .order('fecha_vencimiento', { ascending: true })
      if (error) throw error
      return ((data ?? []) as unknown as FilaFactura[]).map(conCreditos)
    },
  }
}
