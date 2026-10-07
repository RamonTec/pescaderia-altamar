/**
 * Catálogo estático de bancos venezolanos (código SUDEBAN de 4 dígitos → nombre).
 * Sirve para el Autocomplete de Pago Móvil y para detectar el banco automáticamente
 * con los primeros 4 dígitos de una cuenta bancaria.
 *
 * Nota: lista estándar vigente al momento de escribir; pendiente de verificar
 * contra la lista oficial de SUDEBAN antes de producción.
 */

export const BANCOS_VE: Record<string, string> = {
  '0102': 'Banco de Venezuela',
  '0104': 'Venezolano de Crédito',
  '0105': 'Banco Mercantil',
  '0108': 'Banco Provincial',
  '0114': 'Bancaribe',
  '0115': 'Banco Exterior',
  '0116': 'Banco Occidental de Descuento (BOD)',
  '0128': 'Banco Caroní',
  '0134': 'Banesco',
  '0137': 'Banco Sofitasa',
  '0138': 'Banco Plaza',
  '0146': 'Banco de la Gente Emprendedora (Bangente)',
  '0151': 'BFC Banco Fondo Común',
  '0156': '100% Banco',
  '0157': 'Del Sur Banco Universal',
  '0163': 'Banco del Tesoro',
  '0166': 'Banco Agrícola de Venezuela',
  '0168': 'Bancrecer',
  '0169': 'Mi Banco',
  '0171': 'Banco Activo',
  '0172': 'Bancamiga',
  '0173': 'Banco Internacional de Desarrollo',
  '0174': 'Banplus',
  '0175': 'Bicentenario del Pueblo',
  '0177': 'Banco de la Fuerza Armada Nacional Bolivariana (Banfanb)',
  '0190': 'Banco Nacional de Crédito (BNC)',
  '0191': 'Banco de Exportación y Comercio (Bancoex)',
}

const PREFIJOS_CONOCIDOS = new Set(Object.keys(BANCOS_VE))

/** Detecta el banco a partir de los primeros 4 dígitos de una cuenta (o código directo). */
export function bancoDesdeCuenta(cuenta: string): string | null {
  const prefijo = cuenta.replace(/\D/g, '').slice(0, 4)
  return BANCOS_VE[prefijo] ?? null
}

/** Enmascara una cuenta de 20 dígitos: `0105 •••• •••• 1234`. */
export function enmascararCuenta(cuenta: string): string {
  const limpia = cuenta.replace(/\D/g, '')
  if (limpia.length !== 20) return cuenta
  return `${limpia.slice(0, 4)} •••• •••• ${limpia.slice(-4)}`
}

/** Cuenta válida = 20 dígitos y prefijo de banco conocido. */
export function esCuentaValida(cuenta: string): boolean {
  const limpia = cuenta.replace(/\D/g, '')
  if (!/^\d{20}$/.test(limpia)) return false
  return PREFIJOS_CONOCIDOS.has(limpia.slice(0, 4))
}
