import type { SupabaseClient } from '@supabase/supabase-js'
import type { AsignacionLote, Pedido } from '@/types/domain'
import type { PedidoItemNuevo } from '@/lib/repositories/interfaces'
import type { EntradaTasaOperacion } from './tasaService'
import { makePedidoRepository } from '@/lib/repositories/pedidoRepository'
import { createClient } from '@/lib/supabase/server'
import { crearFactura, InvoiceError } from './invoiceService'

/**
 * PedidoService (SRP): pedidos agendados y su entrega.
 *
 * - `crearPedido`: guarda cliente + items con peso estimado, sin tocar stock.
 * - `entregarPedido`: captura el peso real por item y genera la factura con
 *   esos kg (no el estimado), marcando el pedido como `facturado`. La tasa
 *   se resuelve para la **fecha de entrega** (08-tasas). El pedido no
 *   reserva lotes: se asignan al entregar (PEPS o los que elija el vendedor,
 *   07-lotes); los errores de lote vuelven marcados en el peso de la línea.
 */

export interface CrearPedidoInput {
  cliente_id: string
  fecha_entrega: string | null
  notas: string
  items: PedidoItemNuevo[]
}

export interface EntregarPedidoInput {
  pedido_id: string
  condicion: 'contado' | 'credito'
  fecha: string
  pesos_reales: { pedido_item_id: string; peso_kg: number; asignaciones?: AsignacionLote[] }[]
  forzar_limite?: boolean
  /** Días de crédito de la factura (09); sin valor, los del cliente o el default. */
  dias_credito?: number | null
  /** Tasa elegida en la entrega; resuelta en el servidor para la fecha de entrega. */
  tasa?: EntradaTasaOperacion
}

export async function crearPedido(
  input: CrearPedidoInput,
  db?: SupabaseClient
): Promise<string> {
  const client = db ?? (await createClient())
  const pedido: Pedido = {
    id: crypto.randomUUID(),
    cliente_id: input.cliente_id,
    fecha: new Date().toISOString().slice(0, 10),
    fecha_entrega: input.fecha_entrega,
    estado: 'pendiente',
    notas: input.notas.trim() || null,
  }
  return makePedidoRepository(client).create(pedido, input.items)
}

export async function entregarPedido(
  input: EntregarPedidoInput,
  db?: SupabaseClient
): Promise<{ factura_id: string; aviso?: 'referencial_cambio' }> {
  const client = db ?? (await createClient())
  const repo = makePedidoRepository(client)
  const pedido = await repo.getById(input.pedido_id)
  if (!pedido) throw new InvoiceError('El pedido no existe')
  if (pedido.estado !== 'pendiente') {
    throw new InvoiceError('El pedido no está pendiente de entrega')
  }
  if (input.pesos_reales.length === 0) {
    throw new InvoiceError('Debe capturar el peso real de al menos un item')
  }

  const items = pedido.items.map((item) => {
    const real = input.pesos_reales.find((p) => p.pedido_item_id === item.id)
    if (!real) throw new InvoiceError('Falta el peso real de un item')
    if (real.peso_kg <= 0) throw new InvoiceError('El peso real debe ser mayor a 0')
    return {
      producto_id: item.producto_id,
      peso_kg: real.peso_kg,
      precio_usd_kg: item.precio_usd_kg,
      asignaciones: real.asignaciones,
    }
  })

  // Sin tasa en el input (flujo viejo), se pide la referencial del servidor;
  // si no hay ninguna, `crearFactura` falla con el mensaje claro del spec.
  const tasa: EntradaTasaOperacion = input.tasa ?? {
    tasa_origen: 'referencial',
    tasa_fuente: null,
  }

  let resultado
  try {
    resultado = await crearFactura(
      {
        cliente_id: pedido.cliente_id,
        pedido_id: pedido.id,
        items,
        condicion: input.condicion,
        fecha: input.fecha,
        forzar_limite: input.forzar_limite,
        dias_credito: input.dias_credito,
        pesos_reales: input.pesos_reales.map((p) => ({
          pedido_item_id: p.pedido_item_id,
          peso_kg: p.peso_kg,
        })),
        tasa,
      },
      client
    )
  } catch (e) {
    // `items.N.*` de la factura → `pesos_reales.M.*` del formulario de entrega.
    const m = e instanceof InvoiceError ? /^items\.(\d+)\.(.+)$/.exec(e.campo ?? '') : null
    if (m && e instanceof InvoiceError) {
      const pedidoItem = pedido.items[Number(m[1])]
      const indice = input.pesos_reales.findIndex((p) => p.pedido_item_id === pedidoItem?.id)
      if (indice >= 0) throw new InvoiceError(e.message, `pesos_reales.${indice}.${m[2]}`)
    }
    throw e
  }
  return { factura_id: resultado.factura_id, aviso: resultado.aviso }
}
