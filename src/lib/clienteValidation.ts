import { z } from 'zod'
import {
  MSG_NOMBRE_REQUERIDO,
  MSG_RIF_CI_INVALIDO,
  MSG_CEDULA_INVALIDA,
  MSG_EMAIL_INVALIDO,
} from './validationMessages'

export const RIF_CI_REGEX = /^[VEJG]-\d{6,10}(-\d)?$/
export const CEDULA_REGEX = /^[VE]-\d{6,10}$/

/**
 * Teléfono venezolano: `0` + código de área de 3 dígitos + 7 dígitos.
 * Admite guion opcional entre el código de área y el número.
 */
export const TELEFONO_VE_REGEX = /^0(2\d{2}|4(12|14|16|24|26|22))-?\d{7}$/

export const representanteSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, MSG_NOMBRE_REQUERIDO),
  cedula: z.string().regex(CEDULA_REGEX, MSG_CEDULA_INVALIDA),
  cargo: z.string(),
  telefono: z.string(),
})

export type RepresentanteFormValues = z.infer<typeof representanteSchema>

export const clienteFormSchema = z
  .object({
    nombre: z.string().min(1, MSG_NOMBRE_REQUERIDO),
    tipo_persona: z.enum(['natural', 'juridica']),
    rif_ci: z.string().regex(RIF_CI_REGEX, MSG_RIF_CI_INVALIDO),
    telefono: z.string(),
    email: z.string().email(MSG_EMAIL_INVALIDO).or(z.literal('')),
    direccion: z.string(),
    notas: z.string(),
    limite_credito_usd: z.number().nullable(),
    dias_credito: z
      .number()
      .int('Usa un número entero de días')
      .min(0, 'No puede ser negativo')
      .max(365, 'Máximo 365 días')
      .nullable(),
    representantes: z.array(representanteSchema),
  })
  .superRefine((data, ctx) => {
    if (data.tipo_persona === 'juridica') {
      const validos = data.representantes.filter(
        (r) => r.nombre.trim() && r.cedula.trim()
      )
      if (validos.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Un cliente persona jurídica requiere al menos un representante legal',
          path: ['representantes'],
        })
      }
    }
  })

export type ClienteFormValues = z.infer<typeof clienteFormSchema>
