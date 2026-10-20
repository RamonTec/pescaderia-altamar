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

// 09-cuentas-por-cobrar / 06-contratos: días de crédito (entero 0–365).
export const MSG_DIAS_REQUERIDOS = 'Días requeridos'
export const MSG_DIAS_ENTERO = 'Usa un número entero de días'
export const MSG_DIAS_NO_NEGATIVO = 'No puede ser negativo'
export const MSG_DIAS_MAX_365 = 'Máximo 365 días'

// 17-trazabilidad-y-correccion-facturas: corrección de una línea de factura.
export const MSG_PESO_REQUERIDO = 'Peso requerido'
export const MSG_PESO_MAYOR_0 = 'El peso debe ser mayor a 0'
export const MSG_PESO_3_DECIMALES = 'Usa como máximo 3 decimales'
export const MSG_PRECIO_REQUERIDO = 'Precio requerido'
export const MSG_PRECIO_NO_NEGATIVO = 'El precio no puede ser negativo'
export const MSG_PRECIO_6_DECIMALES = 'Usa como máximo 6 decimales'
export const MSG_MOTIVO_CORRECCION = 'Indica el motivo de la corrección (mínimo 5 caracteres)'
export const MSG_MOTIVO_MAX_500 = 'Máximo 500 caracteres'
export const MSG_MOTIVO_CAMBIO_IVA = 'Indica el motivo del cambio de IVA (mínimo 5 caracteres)'
export const MSG_APLICA_IVA_REQUERIDO = 'Indica si la factura lleva IVA'

// 19-edicion-compras: edición de una compra registrada.
export const MSG_MOTIVO_EDICION_COMPRA = 'Indica el motivo de la edición (mínimo 5 caracteres)'
export const MSG_COSTO_REQUERIDO = 'Costo requerido'
export const MSG_COSTO_NO_NEGATIVO = 'El costo no puede ser negativo'
export const MSG_COSTO_6_DECIMALES = 'Usa como máximo 6 decimales'
export const MSG_PROVEEDOR_REQUERIDO = 'Selecciona un proveedor'
export const MSG_FECHA_INVALIDA = 'Fecha inválida'
export const MSG_LINEAS_NO_COINCIDEN = 'Las líneas no coinciden con las de la compra'
