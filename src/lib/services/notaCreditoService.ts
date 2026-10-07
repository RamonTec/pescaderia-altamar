import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotaCreditoItemNuevo, NotaCreditoNueva } from '@/lib/repositories/interfaces'
import { makeFacturaRepository } from '@/lib/repositories/facturaRepository'
import { makeNotaCreditoRepository } from '@/lib/repositories/notaCreditoRepository'
import { createClient } from '@/lib/supabase/server'

/**
 * NotaCreditoService (SRP): devoluciones/correcciones sobre facturas emitidas.
 *
 * - Nunca se edita la factura original: la nota es un documento nuevo que resta.
 * - El peso devuelto por item no puede exceder lo facturado menos lo ya
 *   devuelto en notas previas `emitida`.
 * - Si un item `afecta_inventario`, se registra movimiento `ajuste` positivo al
 *   costo original de la venta (snapshot), no al costo promedio actual.
 */

export class NotaCreditoError extends Error {
  constructor(
    message: string,
    readonly campo?: string
  ) {
    super(message)
    this.name = 'NotaCreditoError'
  }
}

const redondea6 = (n: number) => Math.round(n * 1e6) / 1e6

export interface EmitirNotaInput {
  factura_id: string
  motivo: string
  fecha?: string
  items: {
    factura_item_id: string
    peso_kg: number
    afecta_inventario: boolean
  }[]
}

export async function emitirNotaCredito(
  input: EmitirNotaInput,
  db?: SupabaseClient
): Promise<string> {
  const client = db ?? (await createClient())
  const motivo = input.motivo.trim()
  if (!motivo) throw new NotaCreditoError('El motivo es obligatorio', 'motivo')
  if (input.items.length === 0) throw new NotaCreditoError('Agrega al menos un item', 'items')

  const factura = await makeFacturaRepository(client).getById(input.factura_id)
  if (!factura) throw new NotaCreditoError('La factura no existe')

  // Peso ya devuelto en notas previas emitidas, por item.
  const devueltoPorItem = new Map<string, number>()
  for (const nota of factura.notas_credito) {
    if (nota.estado !== 'emitida') continue
    const detalle = await makeNotaCreditoRepository(client).getById(nota.id)
    if (!detalle) continue
    for (const i of detalle.items) {
      devueltoPorItem.set(
        i.factura_item_id,
        (devueltoPorItem.get(i.factura_item_id) ?? 0) + Number(i.peso_kg)
      )
    }
  }

  const items: NotaCreditoItemNuevo[] = []
  let subtotal = 0
  for (let index = 0; index < input.items.length; index++) {
    const it = input.items[index]
    const original = factura.items.find((fi) => fi.id === it.factura_item_id)
    if (!original) throw new NotaCreditoError('Item de factura no encontrado', `items.${index}`)

    const disponible =
      Number(original.peso_kg) - (devueltoPorItem.get(it.factura_item_id) ?? 0)
    if (it.peso_kg <= 0) throw new NotaCreditoError('El peso debe ser mayor a 0', `items.${index}.peso_kg`)
    if (it.peso_kg > disponible + 0.000001) {
      throw new NotaCreditoError(
        `El peso a devolver supera el disponible (${disponible.toFixed(3)} kg)`,
        `items.${index}.peso_kg`
      )
    }

    const peso = redondea6(it.peso_kg)
    const precio = Number(original.precio_usd_kg)
    subtotal = redondea6(subtotal + peso * precio)
    items.push({
      factura_item_id: it.factura_item_id,
      peso_kg: peso,
      precio_usd_kg: redondea6(precio),
      afecta_inventario: it.afecta_inventario,
    })
  }

  const ivaPct = Number(factura.iva_pct)
  const iva = redondea6(subtotal * (ivaPct / 100))
  const total = redondea6(subtotal + iva)

  const nota: NotaCreditoNueva = {
    id: crypto.randomUUID(),
    factura_id: factura.id,
    fecha: input.fecha ?? new Date().toISOString().slice(0, 10),
    motivo,
    subtotal_usd: subtotal,
    iva_usd: iva,
    total_usd: total,
  }

  return makeNotaCreditoRepository(client).create(nota, items)
}

export async function anularNotaCredito(id: string, db?: SupabaseClient): Promise<void> {
  const client = db ?? (await createClient())
  await makeNotaCreditoRepository(client).anular(id)
}
