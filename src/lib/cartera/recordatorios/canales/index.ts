import type { CanalRecordatorioId } from '../../types'
import { emailCanal } from './email'
import type { CanalRecordatorio } from './types'
import { whatsappCanal } from './whatsapp'

/** Registro de canales: agregar uno nuevo es registrarlo aquí (abierto/cerrado). */
export const CANALES: Record<CanalRecordatorioId, CanalRecordatorio> = {
  whatsapp: whatsappCanal,
  email: emailCanal,
}

export function obtenerCanal(id: CanalRecordatorioId): CanalRecordatorio {
  return CANALES[id]
}

export type {
  CanalRecordatorio,
  DestinatarioRecordatorio,
  Disponibilidad,
  MensajeEntrega,
  ResultadoEntrega,
} from './types'
