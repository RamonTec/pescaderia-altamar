/**
 * Períodos de los gastos (20-gastos). Funciones puras sobre fechas
 * `YYYY-MM-DD` (sin zona horaria): sin Supabase ni React.
 *
 * Fase B: atajos de período de la nómina (1.ª quincena, 2.ª quincena, mes),
 * tipo de un período y solapamiento. La Fase C agrega aquí
 * `periodosRecurrente` / `proximasFechas` (espejo de la SQL).
 */

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Último día (28–31) del mes de `anio`/`mes` (1–12). */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate()
}

function partes(fecha: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return { anio, mes, dia }
}

const fechaDe = (anio: number, mes: number, dia: number) => `${anio}-${pad2(mes)}-${pad2(dia)}`

/** Primer y último día del mes de `fecha`. */
export function mesDe(fecha: string): { desde: string; hasta: string } {
  const { anio, mes } = partes(fecha)
  return { desde: fechaDe(anio, mes, 1), hasta: fechaDe(anio, mes, diasDelMes(anio, mes)) }
}

export type TipoPeriodoNomina = 'primera_quincena' | 'segunda_quincena' | 'mes'

export interface AtajoPeriodo {
  tipo: TipoPeriodoNomina
  /** «1.ª quincena», «2.ª quincena», «Mes». */
  label: string
  desde: string
  hasta: string
}

/**
 * Atajos del mes de `fecha` para el período de un pago de nómina: 1–15,
 * 16–último día y el mes completo.
 */
export function atajosPeriodo(fecha: string): AtajoPeriodo[] {
  const { anio, mes } = partes(fecha)
  const ultimo = diasDelMes(anio, mes)
  return [
    { tipo: 'primera_quincena', label: '1.ª quincena', desde: fechaDe(anio, mes, 1), hasta: fechaDe(anio, mes, 15) },
    { tipo: 'segunda_quincena', label: '2.ª quincena', desde: fechaDe(anio, mes, 16), hasta: fechaDe(anio, mes, ultimo) },
    { tipo: 'mes', label: 'Mes', desde: fechaDe(anio, mes, 1), hasta: fechaDe(anio, mes, ultimo) },
  ]
}

/**
 * Tipo del período si coincide exactamente con un atajo de su mes (1–15,
 * 16–último o mes completo); `null` para cualquier otro rango.
 */
export function tipoPeriodoNomina(desde: string, hasta: string): TipoPeriodoNomina | null {
  if (!desde || !hasta || desde > hasta) return null
  const atajo = atajosPeriodo(desde).find((a) => a.desde === desde && a.hasta === hasta)
  return atajo?.tipo ?? null
}

/** Dos períodos (inclusive) comparten al menos un día. */
export function periodosSeSolapan(
  a: { desde: string; hasta: string },
  b: { desde: string; hasta: string }
): boolean {
  return a.desde <= b.hasta && b.desde <= a.hasta
}

/** Meses calendario que toca el rango `[desde, hasta]` (mínimo 1). */
export function mesesDelRango(desde: string, hasta: string): number {
  if (!desde || !hasta || desde > hasta) return 1
  const a = partes(desde)
  const b = partes(hasta)
  return Math.max(1, (b.anio - a.anio) * 12 + (b.mes - a.mes) + 1)
}
