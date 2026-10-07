import type { EstadoEnvio } from '../../../../types/domain'
import type { CanalRecordatorioId } from '../../types'

/**
 * Strategy de canal de recordatorio (09-cuentas-por-cobrar). Cada canal sabe
 * si puede llegarle a un destinatario y cómo entregar el mensaje. Agregar un
 * canal (SMS, WhatsApp Business) = otra implementación registrada en
 * `index.ts`, sin tocar `recordatorioService`.
 */

export interface DestinatarioRecordatorio {
  nombre: string
  telefono: string | null
  email: string | null
}

export type Disponibilidad = { ok: true; destino: string } | { ok: false; motivo: string }

export interface MensajeEntrega {
  /** Teléfono `58…` o correo, según el canal (lo da `disponible`). */
  destino: string
  texto: string
  asunto?: string
  html?: string
  /** Correo del negocio para "responder a". */
  responderA?: string | null
}

export interface ResultadoEntrega {
  estado: EstadoEnvio
  /** WhatsApp: enlace `wa.me` a abrir en el navegador. */
  url?: string
  /** Id del mensaje en el proveedor (Resend). */
  proveedorIdMensaje?: string | null
  /** Error legible si `estado = 'fallido'`. */
  error?: string | null
}

export interface CanalRecordatorio {
  id: CanalRecordatorioId
  etiqueta: string
  disponible(destinatario: DestinatarioRecordatorio): Disponibilidad
  entregar(mensaje: MensajeEntrega): Promise<ResultadoEntrega>
}
