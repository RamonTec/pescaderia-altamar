import type { DatosContratoPdf, TasaOperacion, TipoContrato } from '@/types/domain'
import { formatTasa } from '@/lib/format'

/**
 * Textos y helpers puros de los contratos (06-contratos). Sin I/O: los usan
 * las plantillas del PDF, el servicio y la UI.
 */

export const TITULO_CONTRATO: Record<TipoContrato, string> = {
  venta_credito: 'Acuerdo de venta a crédito',
  compra_credito: 'Acuerdo de compra a crédito',
}

/** Rol del negocio y de la contraparte en cada tipo. */
export const ROLES_CONTRATO: Record<TipoContrato, { negocio: string; contraparte: string }> = {
  venta_credito: { negocio: 'EL ACREEDOR', contraparte: 'EL DEUDOR' },
  compra_credito: { negocio: 'EL DEUDOR', contraparte: 'EL ACREEDOR' },
}

export const ETIQUETA_TIPO_CONTRATO: Record<TipoContrato, string> = {
  venta_credito: 'Venta',
  compra_credito: 'Compra',
}

/** `7` → `N.º 0007`. */
export function numeroContrato(numero: number): string {
  return `N.º ${String(numero).padStart(4, '0')}`
}

/** `7` → `contrato-0007.pdf`. */
export function nombreArchivoContrato(numero: number): string {
  return `contrato-${String(numero).padStart(4, '0')}.pdf`
}

const FUENTE: Record<'bcv' | 'paralela', string> = { bcv: 'BCV', paralela: 'paralela' }

/** Procedencia de la tasa pactada, sin recalcular (spec › Contenido del PDF › 6). */
export function describirTasa(
  tasa: Pick<TasaOperacion, 'tasa_origen' | 'tasa_fuente' | 'tasa_referencial' | 'tasa_snapshot'>
): string {
  if (tasa.tasa_origen === 'referencial') {
    const fuente = tasa.tasa_fuente ? FUENTE[tasa.tasa_fuente] : 'BCV'
    return `Tasa referencial ${fuente} vigente a la fecha del documento`
  }
  if (tasa.tasa_referencial === null || tasa.tasa_referencial === undefined) {
    return 'Tasa acordada entre las partes'
  }
  return `Tasa acordada entre las partes (referencial vigente: ${formatTasa(tasa.tasa_referencial)})`
}

/** Fecha corta `dd/mm/aaaa` (`2026-10-07` → `07/10/2026`), sin zona horaria. */
export function fechaCorta(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

/** Referencia de una compra (no tienen número): "Compra del 07/10/2026 (ref. 1a2b3c4d)". */
export function referenciaCompra(fecha: string, id: string): string {
  return `Compra del ${fechaCorta(fecha)} (ref. ${id.slice(0, 8)})`
}

/** "Factura N.º F-000123" o "Compra del 07/10/2026 (ref. 1a2b3c4d)". */
export function referenciaDocumento(
  datos: Pick<DatosContratoPdf, 'tipo' | 'documento'>
): string {
  if (datos.tipo === 'venta_credito') {
    return `Factura N.º ${datos.documento.numero ?? '—'}`
  }
  return `Compra del ${fechaCorta(datos.documento.fecha)} (ref. ${datos.documento.referencia})`
}

/** "Persona natural" / "Persona jurídica". */
export function textoTipoPersona(tipo: 'natural' | 'juridica'): string {
  return tipo === 'juridica' ? 'Persona jurídica' : 'Persona natural'
}

/** Días con su plural: "1 día", "30 días". */
export function textoDias(dias: number): string {
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}
