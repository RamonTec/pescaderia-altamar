/**
 * Enlace público de una cotización (21-cotizaciones, P7): funciones puras.
 */

/** Token: 32 caracteres `base64url` (24 bytes aleatorios). */
export const TOKEN_REGEX = /^[A-Za-z0-9_-]{32}$/

export function tokenValido(token: string | null | undefined): token is string {
  return typeof token === 'string' && TOKEN_REGEX.test(token)
}

/** `${base}/c/${token}`, sin barra doble. */
export function urlPublica(token: string, base: string): string {
  return `${base.replace(/\/+$/, '')}/c/${token}`
}
