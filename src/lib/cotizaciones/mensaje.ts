/**
 * Mensajes de WhatsApp de cotizaciones (21-cotizaciones): funciones puras,
 * usables en el servidor y en el navegador (el `wa.me` se abre en el mismo
 * gesto del clic, regla de 09).
 */
import { telefonoAWhatsApp } from '@/lib/cartera/recordatorios/telefono'
import { urlWhatsApp } from '@/lib/cartera/recordatorios/canales/whatsapp'
import { formatFecha, formatUsd } from '@/lib/format'
import { NOMBRE_MARCA } from '@/theme/marca'
import { formatNumeroCotizacion } from './numero'

export interface DatosMensajeCotizacion {
  cliente: string
  numero: number
  nombreComercial: string | null
  totalUsd: number
  fechaVencimiento: string
  url: string
}

/**
 * «Hola {cliente}, le enviamos la cotización {COT-000123} de {negocio} por
 * {total USD} (válida hasta {fecha}). Puede verla y descargarla aquí: {url}».
 */
export function mensajeWhatsAppCotizacion(d: DatosMensajeCotizacion): string {
  return (
    `Hola ${d.cliente}, le enviamos la cotización ${formatNumeroCotizacion(d.numero)} ` +
    `de ${d.nombreComercial || NOMBRE_MARCA} por ${formatUsd(d.totalUsd)} ` +
    `(válida hasta ${formatFecha(d.fechaVencimiento)}). Puede verla y descargarla aquí: ${d.url}`
  )
}

/** Respaldo «vencida» del enlace: «Hola, la cotización COT-000123 venció. Quisiera una nueva.» */
export function mensajeCotizacionVencida(numero: number): string {
  return `Hola, la cotización ${formatNumeroCotizacion(numero)} venció. Quisiera una nueva.`
}

/** Desde la página pública vigente, al negocio: consulta sobre la cotización. */
export function mensajeConsultaCotizacion(numero: number): string {
  return `Hola, les escribo por la cotización ${formatNumeroCotizacion(numero)}.`
}

/** Respaldo genérico del enlace. */
export function mensajeCotizacionGenerica(): string {
  return 'Hola, quisiera una cotización.'
}

/**
 * `wa.me` con el número (móvil venezolano válido, `telefonoAWhatsApp`) o, si
 * no hay, `https://wa.me/?text=…` para que el usuario elija el contacto.
 */
export function urlWhatsAppCotizacion(telefono: string | null | undefined, texto: string): string {
  const numero = telefonoAWhatsApp(telefono)
  return numero ? urlWhatsApp(numero, texto) : `https://wa.me/?text=${encodeURIComponent(texto)}`
}
