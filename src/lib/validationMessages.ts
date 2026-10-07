/**
 * Mensajes de validación compartidos entre entidades (clientes, proveedores).
 * Se crearon al repetirse literales entre `clienteValidation.ts` y
 * `proveedorValidation.ts` (regla de `00-estandares-ui`).
 */
export const MSG_NOMBRE_REQUERIDO = 'Nombre requerido'
export const MSG_RIF_CI_INVALIDO = 'Formato inválido (V-/E-/J- + números)'
export const MSG_CEDULA_INVALIDA = 'Cédula inválida (V-/E- + números)'
export const MSG_EMAIL_INVALIDO = 'Email inválido'

// 08-tasas: campos de tasa de cada operación (compras, ventas y abonos).
export const MSG_TASA_REQUERIDA = 'Tasa requerida'
export const MSG_TASA_MAYOR_0 = 'La tasa debe ser mayor a 0'
export const MSG_TASA_FUENTE_REQUERIDA = 'Selecciona la fuente de la tasa referencial'
export const MSG_TASA_SIN_REFERENCIAL =
  'No hay tasa referencial disponible: ingresa la tasa de esta operación'
/** Aviso (canal `info` de la action): la referencial cambió mientras el formulario estaba abierto. */
export const MSG_TASA_REFERENCIAL_CAMBIO =
  'La tasa referencial cambió desde que abriste el formulario: se guardó la vigente del servidor'
