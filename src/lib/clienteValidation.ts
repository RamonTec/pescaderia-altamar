import { z } from 'zod'

export const RIF_CI_REGEX = /^[VEJG]-\d{6,10}(-\d)?$/
export const CEDULA_REGEX = /^[VE]-\d{6,10}$/

export const representanteSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'Nombre requerido'),
  cedula: z.string().regex(CEDULA_REGEX, 'Cédula inválida (V-/E- + números)'),
  cargo: z.string(),
  telefono: z.string(),
})

export type RepresentanteFormValues = z.infer<typeof representanteSchema>

export const clienteFormSchema = z
  .object({
    nombre: z.string().min(1, 'Nombre requerido'),
    tipo_persona: z.enum(['natural', 'juridica']),
    rif_ci: z.string().regex(RIF_CI_REGEX, 'Formato inválido (V-/E-/J- + números)'),
    telefono: z.string(),
    email: z.string().email('Email inválido').or(z.literal('')),
    direccion: z.string(),
    notas: z.string(),
    limite_credito_usd: z.number().nullable(),
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
