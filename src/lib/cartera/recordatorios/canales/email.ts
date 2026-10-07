import type { CanalRecordatorio, ResultadoEntrega } from './types'

/**
 * Correo por la API REST de Resend (`fetch`, sin SDK). Solo en el servidor:
 * lee `RESEND_API_KEY` y `RECORDATORIO_EMAIL_FROM`. Sin ellas el canal queda
 * deshabilitado con "Correo no configurado" (WhatsApp sigue funcionando).
 */

const RESEND_URL = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MSG_CORREO_NO_CONFIGURADO = 'Correo no configurado'

function configuracion(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RECORDATORIO_EMAIL_FROM?.trim()
  return apiKey && from ? { apiKey, from } : null
}

export function correoConfigurado(): boolean {
  return configuracion() !== null
}

function errorPorEstado(status: number, detalle: string | null): string {
  if (status === 401 || status === 403) {
    return 'La clave de Resend no es válida o el dominio del remitente no está verificado.'
  }
  if (status === 422 || status === 400) {
    return `Resend rechazó el correo${detalle ? `: ${detalle}` : '.'}`
  }
  if (status === 429) return 'Se alcanzó el límite de envíos de Resend. Intenta de nuevo en unos minutos.'
  if (status >= 500) return 'El servicio de correo falló. Intenta de nuevo en unos minutos.'
  return `No se pudo enviar el correo (error ${status}${detalle ? `: ${detalle}` : ''}).`
}

export const emailCanal: CanalRecordatorio = {
  id: 'email',
  etiqueta: 'Correo',
  disponible(destinatario) {
    if (!correoConfigurado()) return { ok: false, motivo: MSG_CORREO_NO_CONFIGURADO }
    const email = destinatario.email?.trim()
    if (!email || !EMAIL_RE.test(email)) return { ok: false, motivo: 'El cliente no tiene correo' }
    return { ok: true, destino: email }
  },
  async entregar(mensaje): Promise<ResultadoEntrega> {
    const cfg = configuracion()
    if (!cfg) return { estado: 'fallido', error: MSG_CORREO_NO_CONFIGURADO }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: cfg.from,
          to: [mensaje.destino],
          subject: mensaje.asunto ?? 'Recordatorio de pago',
          html: mensaje.html,
          text: mensaje.texto,
          ...(mensaje.responderA ? { reply_to: mensaje.responderA } : {}),
        }),
        signal: controller.signal,
      })
      const cuerpo = (await res.json().catch(() => null)) as
        | { id?: string; message?: string; error?: string }
        | null
      if (!res.ok) {
        return {
          estado: 'fallido',
          error: errorPorEstado(res.status, cuerpo?.message ?? cuerpo?.error ?? null),
        }
      }
      return { estado: 'enviado', proveedorIdMensaje: cuerpo?.id ?? null }
    } catch (e) {
      const abortado = e instanceof Error && e.name === 'AbortError'
      return {
        estado: 'fallido',
        error: abortado
          ? 'El servicio de correo no respondió a tiempo. Intenta de nuevo.'
          : 'No se pudo conectar con el servicio de correo. Revisa la conexión e intenta de nuevo.',
      }
    } finally {
      clearTimeout(timer)
    }
  },
}
