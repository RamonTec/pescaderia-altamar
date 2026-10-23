/**
 * Valores iniciales de `CotizacionForm` (21-cotizaciones): funciones puras.
 * Modos `crear` / `editar` / `duplicar` / `renovar`.
 */
import type { CotizacionDetalle } from '@/types/domain'
import type { CotizacionFormInput } from '@/lib/cotizacionValidation'

export type ModoCotizacionForm = 'crear' | 'editar' | 'duplicar' | 'renovar'

export interface DefaultsFormCotizacion {
  validez_dias: number
  terminos: string
}

export function valoresNuevaCotizacion(d: DefaultsFormCotizacion, hoy: string): CotizacionFormInput {
  return {
    tipo_cliente: 'registrado',
    cliente_id: null,
    cliente_nombre: '',
    cliente_telefono: '',
    fecha: hoy,
    validez_dias: d.validez_dias,
    // Cliente libre o aún sin elegir: sí (P1); al elegir cliente se precarga con su `aplica_iva`.
    con_iva: true,
    descuento_usd: 0,
    notas_cliente: '',
    notas_internas: '',
    terminos: d.terminos,
    items: [],
  }
}

/**
 * Precarga desde una cotización existente. `duplicar` y `renovar` ponen la
 * fecha de hoy; `editar` conserva la de la cotización.
 */
export function valoresDesdeDetalle(
  c: CotizacionDetalle,
  modo: Exclude<ModoCotizacionForm, 'crear'>,
  hoy: string
): CotizacionFormInput {
  return {
    tipo_cliente: c.cliente_id ? 'registrado' : 'libre',
    cliente_id: c.cliente_id,
    cliente_nombre: c.cliente_nombre ?? '',
    cliente_telefono: c.cliente_telefono ?? '',
    fecha: modo === 'editar' ? c.fecha : hoy,
    validez_dias: c.validez_dias,
    con_iva: c.iva_pct > 0,
    descuento_usd: c.descuento_usd,
    notas_cliente: c.notas_cliente ?? '',
    notas_internas: c.notas_internas ?? '',
    terminos: c.terminos ?? '',
    items: c.items.map((i) => ({
      producto_id: i.producto_id,
      peso_kg: i.peso_kg,
      precio_usd_kg: i.precio_usd_kg,
      nota: i.nota ?? '',
    })),
  }
}
