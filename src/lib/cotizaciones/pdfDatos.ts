/**
 * Datos del PDF de una cotización (21-cotizaciones, Fase B): función pura.
 */
import type { ConfigNegocio, CotizacionDetalle, DatosCotizacionPdf } from '@/types/domain'
import { documentoDesdeDetalle } from './documento'
import { estadoEfectivo } from './estado'

const SELLO: Partial<Record<ReturnType<typeof estadoEfectivo>, string>> = {
  vencida: 'VENCIDA',
  aceptada: 'ACEPTADA',
  rechazada: 'RECHAZADA',
}

type ConfigPdf = Pick<
  ConfigNegocio,
  'nombre_comercial' | 'razon_social' | 'rif' | 'direccion' | 'telefono' | 'instrucciones_pago'
>

export function negocioDesdeConfig(config: ConfigPdf | null) {
  return {
    nombre_comercial: config?.nombre_comercial ?? null,
    razon_social: config?.razon_social ?? null,
    rif: config?.rif ?? null,
    direccion: config?.direccion ?? null,
    telefono: config?.telefono ?? null,
  }
}

export function datosPdfDesdeDetalle(
  detalle: CotizacionDetalle,
  config: ConfigPdf | null,
  hoy: string
): DatosCotizacionPdf {
  return {
    documento: documentoDesdeDetalle(detalle),
    negocio: negocioDesdeConfig(config),
    instrucciones_pago: config?.instrucciones_pago?.trim() || null,
    sello: SELLO[estadoEfectivo(detalle, hoy)] ?? null,
    actualizada_at: detalle.updated_at,
  }
}
