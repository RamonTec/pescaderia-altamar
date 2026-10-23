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

export interface PlantillaPeriodoInput {
  frecuencia: 'mensual' | 'quincenal'
  dia_mes: number | null
  fecha_inicio: string
  fecha_fin: string | null
}

/**
 * Espejo TypeScript de la RPC `generar_gastos_recurrentes` (Fase C).
 * Genera hasta 12 períodos cuya fecha programada esté en `[fecha_inicio, min(fecha_fin, hasta)]`.
 */
export function periodosRecurrente(
  plantilla: PlantillaPeriodoInput,
  hasta: string
): Array<{ desde: string; hasta: string; fecha_programada: string }> {
  if (!plantilla.fecha_inicio || !hasta) return []
  const limite = plantilla.fecha_fin && plantilla.fecha_fin < hasta ? plantilla.fecha_fin : hasta
  if (plantilla.fecha_inicio > limite) return []

  const inicio = partes(plantilla.fecha_inicio)
  let curAnio = inicio.anio
  let curMes = inicio.mes
  const out: Array<{ desde: string; hasta: string; fecha_programada: string }> = []

  while (out.length < 12) {
    const primerDia = fechaDe(curAnio, curMes, 1)
    if (primerDia > limite) break

    const ultimoDia = diasDelMes(curAnio, curMes)
    if (plantilla.frecuencia === 'mensual') {
      const pDesde = primerDia
      const pHasta = fechaDe(curAnio, curMes, ultimoDia)
      const diaProg = plantilla.dia_mes ? Math.min(plantilla.dia_mes, ultimoDia) : ultimoDia
      const fechaProg = fechaDe(curAnio, curMes, diaProg)

      if (fechaProg >= plantilla.fecha_inicio && fechaProg <= limite) {
        out.push({ desde: pDesde, hasta: pHasta, fecha_programada: fechaProg })
      }
    } else {
      // quincenal: 1.ª quincena (1 a 15)
      const q1Desde = primerDia
      const q1Hasta = fechaDe(curAnio, curMes, 15)
      const q1Prog = q1Hasta
      if (q1Prog >= plantilla.fecha_inicio && q1Prog <= limite) {
        out.push({ desde: q1Desde, hasta: q1Hasta, fecha_programada: q1Prog })
      }

      // 2.ª quincena (16 a fin de mes)
      if (out.length < 12) {
        const q2Desde = fechaDe(curAnio, curMes, 16)
        const q2Hasta = fechaDe(curAnio, curMes, ultimoDia)
        const q2Prog = q2Hasta
        if (q2Prog >= plantilla.fecha_inicio && q2Prog <= limite) {
          out.push({ desde: q2Desde, hasta: q2Hasta, fecha_programada: q2Prog })
        }
      }
    }

    curMes++
    if (curMes > 12) {
      curMes = 1
      curAnio++
    }
  }

  return out
}

/**
 * Próximas `n` fechas programadas de una plantilla a partir de `desdeFecha`
 * (por defecto `fecha_inicio`), respetando `fecha_fin`.
 */
export function proximasFechas(
  plantilla: PlantillaPeriodoInput,
  n = 3,
  desdeFecha?: string
): string[] {
  const base = desdeFecha && desdeFecha > plantilla.fecha_inicio ? desdeFecha : plantilla.fecha_inicio
  if (!base) return []
  const { anio: a, mes: m } = partes(base)
  let curAnio = a
  let curMes = m
  const out: string[] = []

  while (out.length < n) {
    const ultimoDia = diasDelMes(curAnio, curMes)
    if (plantilla.frecuencia === 'mensual') {
      const diaProg = plantilla.dia_mes ? Math.min(plantilla.dia_mes, ultimoDia) : ultimoDia
      const f = fechaDe(curAnio, curMes, diaProg)
      if (f >= base && (!plantilla.fecha_fin || f <= plantilla.fecha_fin)) {
        out.push(f)
      }
    } else {
      // quincenal
      const q1 = fechaDe(curAnio, curMes, 15)
      if (q1 >= base && (!plantilla.fecha_fin || q1 <= plantilla.fecha_fin)) {
        out.push(q1)
      }
      if (out.length < n) {
        const q2 = fechaDe(curAnio, curMes, ultimoDia)
        if (q2 >= base && (!plantilla.fecha_fin || q2 <= plantilla.fecha_fin)) {
          out.push(q2)
        }
      }
    }

    curMes++
    if (curMes > 12) {
      curMes = 1
      curAnio++
    }
    // Salvaguarda
    if (curAnio > a + 10) break
  }

  return out
}

