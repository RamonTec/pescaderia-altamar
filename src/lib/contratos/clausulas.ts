import { formatTasa } from '@/lib/format'

/**
 * Cláusula de ganancia cambiaria (06-contratos, /SPEC.md §4.5). Texto único
 * para ambos tipos de contrato: habla de "EL ACREEDOR" y "EL DEUDOR", y solo
 * se parametriza con la tasa pactada (`{TASA}`). Ninguna plantilla escribe su
 * propio texto de cláusula. Solo caracteres WinAnsi (Helvetica estándar del
 * PDF): sin signo menos tipográfico (U+2212).
 */
export const CLAUSULA_GANANCIA_CAMBIARIA =
  'La deuda objeto de este acuerdo se expresa en dólares de los Estados Unidos de América (USD) ' +
  'y se pacta a la tasa de {TASA} Bs por USD. EL DEUDOR podrá realizar abonos en USD o en ' +
  'bolívares (Bs). Cada abono en bolívares se convertirá a USD a la tasa de cambio vigente el día ' +
  'del pago, y el saldo adeudado se reducirá en el monto en USD resultante. La diferencia entre la ' +
  'tasa del día del pago y la tasa pactada, multiplicada por los USD abonados ' +
  '((tasa del pago - tasa pactada) × USD pagados), constituye ganancia o pérdida cambiaria para ' +
  'EL ACREEDOR y no modifica el saldo en USD adeudado por EL DEUDOR.'

export function textoClausulaGananciaCambiaria(tasaPactada: number): string {
  return CLAUSULA_GANANCIA_CAMBIARIA.replace('{TASA}', formatTasa(tasaPactada))
}
