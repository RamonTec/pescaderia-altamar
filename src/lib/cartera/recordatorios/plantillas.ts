import { formatBs, formatFecha, formatUsd } from '../../format'
import { ETIQUETA_ESTADO, estadoDe, ordenarPorGravedad, saldoDocumento } from '../estado'
import type { CanalRecordatorioId, DocumentoCartera, EstadoCartera } from '../types'

/**
 * Plantillas de recordatorio de cobro (09-cuentas-por-cobrar). Puras: a
 * partir del destinatario, sus documentos y los datos del negocio arman el
 * texto de WhatsApp o el correo (`asunto`, `html`, `texto`).
 *
 * Todo dato variable se escapa en el HTML del correo.
 */

export interface DatosNegocio {
  nombre_comercial: string
  instrucciones_pago: string | null
  email_respuesta: string | null
}

export interface DatosRecordatorio {
  negocio: DatosNegocio
  destinatario: { nombre: string }
  documentos: readonly DocumentoCartera[]
  hoy: string
  diasAviso: number
  /** Bs por USD vigente, para el equivalente en Bs; `null` si no hay. */
  tasaBs: number | null
}

export interface MensajeWhatsApp {
  canal: 'whatsapp'
  texto: string
}

export interface MensajeCorreo {
  canal: 'email'
  asunto: string
  html: string
  texto: string
}

export type MensajeRecordatorio = MensajeWhatsApp | MensajeCorreo

/**
 * Colores de marca para el correo. Los clientes de correo no usan el theme
 * de MUI: es la única excepción documentada a "ningún hex suelto" (spec 09,
 * § Correo). Valores de `palette` / `palette.brand` (modo claro) de
 * `src/theme/theme.ts`.
 */
const MARCA = {
  casco: '#0E4A5C',
  ocre: '#E8B931',
  blanco: '#FFFFFF',
  rojo: '#B8402E',
  texto: '#13262C',
  textoSecundario: '#4A5D63',
  hielo: '#F3F6F6',
  borde: '#D5DEE0',
}

interface Linea {
  doc: DocumentoCartera
  estado: EstadoCartera
  saldo: number
}

function lineas(datos: DatosRecordatorio): Linea[] {
  return ordenarPorGravedad(datos.documentos, datos.hoy, datos.diasAviso).map((doc) => ({
    doc,
    estado: estadoDe(doc, datos.hoy, datos.diasAviso),
    saldo: saldoDocumento(doc),
  }))
}

function total(ls: Linea[]): number {
  return Math.round(ls.reduce((s, l) => s + Math.max(0, l.saldo), 0) * 100) / 100
}

function textoBs(usd: number, tasa: number | null): string | null {
  return tasa && tasa > 0 ? formatBs(usd * tasa) : null
}

function verboVencimiento(l: Linea): string {
  return l.estado === 'vencida'
    ? `venció el ${formatFecha(l.doc.fecha_vencimiento)}`
    : `vence el ${formatFecha(l.doc.fecha_vencimiento)}`
}

/** Texto plano (correo) o con formato de WhatsApp (`*negrita*`). */
function textoPlano(datos: DatosRecordatorio, ls: Linea[], negrita: (s: string) => string): string {
  const vencidas = ls.filter((l) => l.estado === 'vencida')
  const resto = ls.filter((l) => l.estado !== 'vencida')
  const t = total(ls)
  const bs = textoBs(t, datos.tasaBs)

  const partes: string[] = []
  partes.push(
    `Hola, ${negrita(datos.destinatario.nombre)}. Le escribimos de ${negrita(
      datos.negocio.nombre_comercial
    )} para recordarle el estado de sus facturas:`
  )
  const item = (l: Linea) => `• ${l.doc.numero} · ${verboVencimiento(l)} · ${formatUsd(l.saldo)}`
  if (vencidas.length > 0) {
    partes.push([negrita('Vencidas'), ...vencidas.map(item)].join('\n'))
  }
  if (resto.length > 0) {
    partes.push(
      [negrita(vencidas.length > 0 ? 'Por vencer' : 'Pendientes'), ...resto.map(item)].join('\n')
    )
  }
  partes.push(negrita(`Total adeudado: ${formatUsd(t)}`) + (bs ? ` (${bs} a la tasa de hoy)` : ''))
  if (datos.negocio.instrucciones_pago?.trim()) {
    partes.push(`Datos de pago:\n${datos.negocio.instrucciones_pago.trim()}`)
  }
  partes.push('Si ya realizó el pago, envíenos el comprobante y no tome en cuenta este mensaje. ¡Gracias!')
  return partes.join('\n\n')
}

export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function asunto(datos: DatosRecordatorio, ls: Linea[]): string {
  const vencidas = ls.filter((l) => l.estado === 'vencida').length
  const base = vencidas > 0 ? 'Recordatorio de facturas vencidas' : 'Recordatorio de facturas pendientes'
  return `${base} · ${datos.negocio.nombre_comercial}`
}

function html(datos: DatosRecordatorio, ls: Linea[]): string {
  const e = escaparHtml
  const t = total(ls)
  const bs = textoBs(t, datos.tasaBs)
  const celda = `padding:8px 10px;border-bottom:1px solid ${MARCA.borde};font-size:14px;`
  const num = `${celda}text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;`

  const filas = ls
    .map((l) => {
      const colorEstado = l.estado === 'vencida' ? MARCA.rojo : MARCA.textoSecundario
      const lineaBs = textoBs(l.saldo, datos.tasaBs)
      return `<tr>
<td style="${celda}">${e(l.doc.numero)}</td>
<td style="${celda}white-space:nowrap;">${e(formatFecha(l.doc.fecha))}</td>
<td style="${celda}white-space:nowrap;">${e(formatFecha(l.doc.fecha_vencimiento))}</td>
<td style="${num}">${e(formatUsd(l.saldo))}${lineaBs ? `<br><span style="color:${MARCA.textoSecundario};font-size:12px;">${e(lineaBs)}</span>` : ''}</td>
<td style="${celda}color:${colorEstado};font-weight:600;">${e(ETIQUETA_ESTADO[l.estado])}</td>
</tr>`
    })
    .join('')

  const instrucciones = datos.negocio.instrucciones_pago?.trim()
  const bloqueInstrucciones = instrucciones
    ? `<h2 style="font-size:16px;margin:24px 0 8px;color:${MARCA.texto};">Datos de pago</h2>
<p style="margin:0;font-size:14px;line-height:1.5;white-space:pre-line;">${e(instrucciones)}</p>`
    : ''

  const franja = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
<td style="height:6px;background:${MARCA.ocre};width:34%;"></td>
<td style="height:6px;background:${MARCA.blanco};width:33%;"></td>
<td style="height:6px;background:${MARCA.rojo};width:33%;"></td>
</tr></table>`

  const th = `padding:8px 10px;text-align:left;font-size:12px;color:${MARCA.textoSecundario};border-bottom:1px solid ${MARCA.borde};`

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(asunto(datos, ls))}</title></head>
<body style="margin:0;padding:0;background:${MARCA.hielo};font-family:Arial,Helvetica,sans-serif;color:${MARCA.texto};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${MARCA.hielo};"><tr><td align="center" style="padding:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${MARCA.blanco};border:1px solid ${MARCA.borde};border-radius:8px;overflow:hidden;">
<tr><td style="background:${MARCA.casco};padding:18px 24px;color:${MARCA.blanco};font-size:20px;font-weight:700;">${e(datos.negocio.nombre_comercial)}</td></tr>
<tr><td>${franja}</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hola, <strong>${e(datos.destinatario.nombre)}</strong>. Le escribimos para recordarle el estado de sus facturas:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<thead><tr><th style="${th}">Factura</th><th style="${th}">Fecha</th><th style="${th}">Vence</th><th style="${th}text-align:right;">Saldo</th><th style="${th}">Estado</th></tr></thead>
<tbody>${filas}</tbody>
</table>
<p style="margin:16px 0 0;font-size:16px;text-align:right;"><strong>Total adeudado: ${e(formatUsd(t))}</strong>${bs ? `<br><span style="font-size:13px;color:${MARCA.textoSecundario};">${e(bs)} a la tasa de hoy</span>` : ''}</p>
${bloqueInstrucciones}
<p style="margin:24px 0 0;font-size:14px;line-height:1.5;">Si ya realizó el pago, responda a este correo con el comprobante y no tome en cuenta este mensaje. ¡Gracias!</p>
</td></tr>
<tr><td style="padding:14px 24px;background:${MARCA.hielo};font-size:12px;color:${MARCA.textoSecundario};">Para cualquier duda, responda a este correo.</td></tr>
</table>
</td></tr></table>
</body></html>`
}

export function construirRecordatorio(datos: DatosRecordatorio, canal: 'whatsapp'): MensajeWhatsApp
export function construirRecordatorio(datos: DatosRecordatorio, canal: 'email'): MensajeCorreo
export function construirRecordatorio(
  datos: DatosRecordatorio,
  canal: CanalRecordatorioId
): MensajeRecordatorio
export function construirRecordatorio(
  datos: DatosRecordatorio,
  canal: CanalRecordatorioId
): MensajeRecordatorio {
  const ls = lineas(datos)
  if (canal === 'whatsapp') {
    return { canal, texto: textoPlano(datos, ls, (s) => `*${s}*`) }
  }
  return {
    canal,
    asunto: asunto(datos, ls),
    html: html(datos, ls),
    texto: textoPlano(datos, ls, (s) => s),
  }
}

/** Total que se va a recordar (saldo positivo de los documentos). */
export function totalRecordado(docs: readonly DocumentoCartera[]): number {
  return Math.round(docs.reduce((s, d) => s + Math.max(0, saldoDocumento(d)), 0) * 100) / 100
}
