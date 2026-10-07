import { TELEFONO_VE_REGEX } from '../../clienteValidation'

/**
 * Teléfono venezolano → número para `wa.me` (sin `+`, con código de país).
 *
 *   `0412-1234567`, `04121234567`, `+58 412 123 4567`, `58 412-1234567`
 *   → `584121234567`
 *
 * `null` si no es un móvil venezolano válido (los fijos `02xx` no tienen
 * WhatsApp). Reusa `TELEFONO_VE_REGEX` (02-clientes) para validar el formato
 * local y exige además el prefijo móvil `04`.
 */
export function telefonoAWhatsApp(tel: string | null | undefined): string | null {
  if (!tel) return null
  const digitos = tel.replace(/\D/g, '')
  let local: string
  if (digitos.startsWith('58') && digitos.length === 12) {
    local = `0${digitos.slice(2)}`
  } else if (digitos.startsWith('0') && digitos.length === 11) {
    local = digitos
  } else if (digitos.length === 10 && digitos.startsWith('4')) {
    local = `0${digitos}`
  } else {
    return null
  }
  if (!TELEFONO_VE_REGEX.test(local) || !local.startsWith('04')) return null
  return `58${local.slice(1)}`
}
