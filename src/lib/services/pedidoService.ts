import type { SupabaseClient } from '@supabase/supabase-js'
import type { Pedido } from '@/types/domain'
import type { PedidoItemNuevo } from '@/lib/repositories/interfaces'
import { makePedidoRepository } from '@/lib/repositories/pedidoRepository'
import { createClient } from '@/lib/supabase/server'
import { crearFactura, InvoiceError } from './invoiceService'

/**
 * PedidoService (SRP): pedidos agendados y su entrega.
 *
 * - `crearPedido`: guarda cliente + items con peso estimado, sin tocar stock.
 * - `entregarPedido`: captura el peso real por item y genera la factura con
 *   esos kg (no el estimado), marcando el pedido como `facturado`.
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
  pesos_reales: { pedido_item_id: string; peso_kg: number }[]
  fecha?: string
  forzar_limite?: boolean
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
): Promise<string> {
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
    }
  })

  const resultado = await crearFactura(
    {
      cliente_id: pedido.cliente_id,
      pedido_id: pedido.id,
      items,
      condicion: input.condicion,
      fecha: input.fecha,
      forzar_limite: input.forzar_limite,
      pesos_reales: input.pesos_reales,
    },
    client
  )
  return resultado.factura_id
}
