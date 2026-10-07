import { telefonoAWhatsApp } from '../telefono'
import type { CanalRecordatorio } from './types'

/** `https://wa.me/58412…?text=…`. Pura: la usa también el navegador para abrir la pestaña en el clic. */
export function urlWhatsApp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

/**
 * WhatsApp vía `wa.me`: el sistema no envía nada; arma el enlace con el
 * texto listo y el usuario lo envía desde su teléfono o computadora. Por eso
 * el resultado queda `generado`.
 */
export const whatsappCanal: CanalRecordatorio = {
  id: 'whatsapp',
  etiqueta: 'WhatsApp',
  disponible(destinatario) {
    const numero = telefonoAWhatsApp(destinatario.telefono)
    return numero
      ? { ok: true, destino: numero }
      : { ok: false, motivo: 'El cliente no tiene teléfono móvil válido' }
  },
  async entregar(mensaje) {
    return { estado: 'generado', url: urlWhatsApp(mensaje.destino, mensaje.texto) }
  },
}
