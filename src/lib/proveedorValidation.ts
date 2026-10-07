import { z } from 'zod'
import { RIF_CI_REGEX, representanteSchema } from './clienteValidation'
import { esCuentaValida } from './bancosVe'
import {
  MSG_NOMBRE_REQUERIDO,
  MSG_RIF_CI_INVALIDO,
  MSG_EMAIL_INVALIDO,
} from './validationMessages'

const TEL_REQUERIDO = 'Teléfono requerido'
const RIF_REQUERIDO = 'RIF/CI requerido'
const BANCO_REQUERIDO = 'Banco requerido'

const baseCampos = {
  id: z.string().optional(),
  preferido: z.boolean(),
}

const transferenciaSchema = z.object({
  ...baseCampos,
  tipo: z.literal('transferencia'),
  numero_cuenta: z
    .string()
    .min(1, 'Número de cuenta requerido')
    .refine((v) => /^\d{20}$/.test(v), 'La cuenta debe tener 20 dígitos')
    .refine((v) => esCuentaValida(v), 'Prefijo de banco no reconocido'),
  tipo_cuenta: z.enum(['corriente', 'ahorro']).nullable(),
  titular: z.string().min(1, 'Titular requerido'),
  titular_rif_ci: z.string().min(1, RIF_REQUERIDO),
  banco_codigo: z.string(),
  telefono: z.string(),
  email: z.string(),
})

const pagoMovilSchema = z.object({
  ...baseCampos,
  tipo: z.literal('pago_movil'),
  banco_codigo: z.string().min(1, BANCO_REQUERIDO),
  telefono: z.string().min(1, TEL_REQUERIDO),
  titular_rif_ci: z.string().min(1, RIF_REQUERIDO),
  numero_cuenta: z.string(),
  tipo_cuenta: z.enum(['corriente', 'ahorro']).nullable(),
  titular: z.string(),
  email: z.string(),
})

const zelleSchema = z
  .object({
    ...baseCampos,
    tipo: z.literal('zelle'),
    titular: z.string().min(1, 'Titular requerido'),
    email: z.string(),
    telefono: z.string(),
    numero_cuenta: z.string(),
    tipo_cuenta: z.enum(['corriente', 'ahorro']).nullable(),
    banco_codigo: z.string(),
    titular_rif_ci: z.string(),
  })
  .refine((v) => v.email.trim() !== '' || v.telefono.trim() !== '', {
    message: 'Zelle requiere email o teléfono',
    path: ['email'],
  })

export const metodoPagoSchema = z.discriminatedUnion('tipo', [
  transferenciaSchema,
  pagoMovilSchema,
  zelleSchema,
])

export type MetodoPagoFormValues = z.infer<typeof metodoPagoSchema>

export const proveedorFormSchema = z
  .object({
    nombre: z.string().min(1, MSG_NOMBRE_REQUERIDO),
    tipo_persona: z.enum(['natural', 'juridica']),
    rif_ci: z.string().regex(RIF_CI_REGEX, MSG_RIF_CI_INVALIDO),
    telefono: z.string(),
    email: z.string().email(MSG_EMAIL_INVALIDO).or(z.literal('')),
    direccion: z.string(),
    contacto_nombre: z.string(),
    contacto_telefono: z.string(),
    notas: z.string(),
    representantes: z.array(representanteSchema),
    metodosPago: z.array(metodoPagoSchema),
  })
  .superRefine((data, ctx) => {
    if (data.tipo_persona === 'juridica') {
      const validos = data.representantes.filter(
        (r) => r.nombre.trim() && r.cedula.trim()
      )
      if (validos.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Un proveedor persona jurídica requiere al menos un representante legal',
          path: ['representantes'],
        })
      }
    }

    const preferidos = data.metodosPago.filter((m) => m.preferido)
    if (preferidos.length > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Solo puede haber un método de pago preferido',
        path: ['metodosPago'],
      })
    }

    const cuentas = new Set<string>()
    const telefonosPagoMovil = new Set<string>()
    for (const [i, m] of data.metodosPago.entries()) {
      if (m.tipo === 'transferencia' && m.numero_cuenta) {
        if (cuentas.has(m.numero_cuenta)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Ya existe un método con esta cuenta',
            path: ['metodosPago', i, 'numero_cuenta'],
          })
        }
        cuentas.add(m.numero_cuenta)
      }
      if (m.tipo === 'pago_movil' && m.telefono) {
        if (telefonosPagoMovil.has(m.telefono)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Ya existe un método con este teléfono',
            path: ['metodosPago', i, 'telefono'],
          })
        }
        telefonosPagoMovil.add(m.telefono)
      }
    }
  })

export type ProveedorFormValues = z.infer<typeof proveedorFormSchema>

export const bloqueoSchema = z.object({
  motivo: z.string().trim().min(10, 'El motivo debe tener al menos 10 caracteres'),
})

/** Campos que valida cada paso del Stepper (para `trigger([...])`). */
export const CAMPOS_POR_PASO: [string[], string[], string[]] = [
  [
    'nombre',
    'tipo_persona',
    'rif_ci',
    'telefono',
    'email',
    'direccion',
    'contacto_nombre',
    'contacto_telefono',
    'notas',
    'representantes',
  ],
  ['metodosPago'],
  [],
]
