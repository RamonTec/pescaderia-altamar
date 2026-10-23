/**
 * Pruebas del dominio puro de gastos operativos (20-gastos).
 * Sin framework de tests: falla con `process.exit(1)` si algún caso no coincide.
 *
 *   npx tsx scripts/probar-gastos.ts
 *   npx tsx scripts/probar-gastos.ts --sql > paridad-gastos.sql
 *
 * Con `--sql` no corre las pruebas: imprime un script SQL con los 200 casos
 * aleatorios de `montoUsdGasto` y los compara con la expresión del check
 * `gastos_monto_usd` (`round(monto, 6)` / `round(monto / tasa, 6)` sobre
 * `numeric(14,6)`) en un Postgres con la migración `20261022000000`
 * (falla con una excepción si alguno difiere). Fase B: también 200 casos de
 * `montoNominaPeriodo` contra la misma regla en SQL (mes completo →
 * salario; quincena → `round(salario / 2, 6)`; otro período → `null`), la
 * que usará `gasto_recurrente_monto` en la Fase C.
 */
import { montoNominaPeriodo, montoUsdGasto, redondea6Gasto, resumirCostoEmpleado } from '../src/lib/gastos/montos'
import {
  atajosPeriodo,
  diasDelMes,
  mesesDelRango,
  periodosRecurrente,
  periodosSeSolapan,
  proximasFechas,
  tipoPeriodoNomina,
} from '../src/lib/gastos/periodos'
import { empleadoSchema } from '../src/lib/empleadoValidation'
import { gastoRecurrenteSchema } from '../src/lib/gastoRecurrenteValidation'
import {
  anularGastoSchema,
  descartarGastoSchema,
  editarGastoSchema,
  gastoFormSchema,
  pagoNominaSchema,
  type GastoFormInput,
} from '../src/lib/gastoValidation'
import { categoriaGastoSchema } from '../src/lib/categoriaGastoValidation'
import { fechaHoy } from '../src/lib/format'
import { sumarDias } from '../src/lib/dashboard/rangos'
import type { Moneda } from '../src/types/domain'

let fallas = 0

function igual<T>(nombre: string, obtenido: T, esperado: T) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  console.log(
    `${ok ? 'OK  ' : 'FALLA'} ${nombre}${ok ? '' : ` → obtenido ${JSON.stringify(obtenido)}, esperado ${JSON.stringify(esperado)}`}`
  )
  if (!ok) fallas++
}

function verdadero(nombre: string, condicion: boolean, detalle = '') {
  console.log(`${condicion ? 'OK  ' : 'FALLA'} ${nombre}${condicion ? '' : ` → ${detalle}`}`)
  if (!condicion) fallas++
}

// ---------- Generador determinista (mismo que los scripts de 16/17/19) ----------
let semilla = 20
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return semilla / 2147483648
}

interface CasoMonto {
  moneda: Moneda
  /** 2 decimales (lo que captura la UI). */
  monto: number
  /** Hasta 6 decimales (`numeric(14,6)`). */
  tasa: number
}

function casosAleatorios(n: number): CasoMonto[] {
  // Misma semilla siempre: la corrida normal y `--sql` comparan los mismos casos.
  semilla = 1020
  const casos: CasoMonto[] = []
  for (let k = 0; k < n; k++) {
    const moneda: Moneda = azar() < 0.8 ? 'bs' : 'usd'
    const monto = (1 + Math.floor(azar() * 5_000_000)) / 100
    // Tasas con 2 a 6 decimales, de 1 a ~600 Bs/USD.
    const dec = 2 + Math.floor(azar() * 5)
    const tasa = Math.round((1 + azar() * 600) * 10 ** dec) / 10 ** dec
    casos.push({ moneda, monto, tasa })
  }
  return casos
}

/** Espejo BigInt independiente del `round(x, 6)` de Postgres (mitad hacia arriba). */
const big = (n: number, dec: number) => BigInt(n.toFixed(dec).replace('.', ''))
function sqlMontoUsd(c: CasoMonto): number {
  const m = big(c.monto, 6)
  if (c.moneda === 'usd') return Number(m) / 1e6
  const t = big(c.tasa, 6)
  const q = (BigInt(2) * m * BigInt(1_000_000) + t) / (BigInt(2) * t)
  return Number(q) / 1e6
}

interface CasoNomina {
  salario: number
  desde: string
  hasta: string
}

/** Salarios con 2 a 6 decimales y períodos de mes, quincena u otros (incluye febreros bisiestos). */
function casosNomina(n: number): CasoNomina[] {
  semilla = 2020
  const casos: CasoNomina[] = []
  const pad = (x: number) => String(x).padStart(2, '0')
  for (let k = 0; k < n; k++) {
    const dec = 2 + Math.floor(azar() * 5)
    const salario = Math.round(azar() * 20_000 * 10 ** dec) / 10 ** dec
    const anio = 2024 + Math.floor(azar() * 5)
    const mes = 1 + Math.floor(azar() * 12)
    const ultimo = diasDelMes(anio, mes)
    const f = (d: number) => `${anio}-${pad(mes)}-${pad(d)}`
    const r = azar()
    let desde: string
    let hasta: string
    if (r < 0.3) [desde, hasta] = [f(1), f(ultimo)]
    else if (r < 0.55) [desde, hasta] = [f(1), f(15)]
    else if (r < 0.8) [desde, hasta] = [f(16), f(ultimo)]
    else {
      const a = 1 + Math.floor(azar() * ultimo)
      const b = a + Math.floor(azar() * (ultimo - a + 1))
      ;[desde, hasta] = [f(a), f(b)]
    }
    casos.push({ salario, desde, hasta })
  }
  return casos
}

/** Misma regla que `montoNominaPeriodo`, en SQL (fechas y `numeric(14,6)`). */
function sqlNomina(c: CasoNomina): string {
  const d = `'${c.desde}'::date`
  const h = `'${c.hasta}'::date`
  const s = `${c.salario.toFixed(6)}::numeric(14,6)`
  const fin = `(date_trunc('month', ${d}) + interval '1 month - 1 day')::date`
  return (
    `(case when ${d} = date_trunc('month', ${d})::date and ${h} = ${fin} then ${s}` +
    ` when (extract(day from ${d}) = 1 and ${h} = ${d} + 14) or (extract(day from ${d}) = 16 and ${h} = ${fin})` +
    ` then round(${s} / 2, 6) else null end)`
  )
}

if (process.argv.includes('--sql')) {
  const casos = casosAleatorios(200)
  const lineas: string[] = [
    '-- Paridad TS ↔ SQL de montoUsdGasto (20), generado por probar-gastos.ts',
    'do $$',
    'begin',
  ]
  casos.forEach((c, k) => {
    const ts = montoUsdGasto(c.moneda, c.monto, c.tasa)
    const expr =
      c.moneda === 'usd'
        ? `round(${c.monto.toFixed(6)}::numeric(14,6), 6)`
        : `round(${c.monto.toFixed(6)}::numeric(14,6) / ${c.tasa.toFixed(6)}::numeric(14,6), 6)`
    lineas.push(
      `  if ${expr} <> ${ts.toFixed(6)}::numeric then raise exception 'caso ${k} difiere: % vs ${ts.toFixed(6)}', ${expr}; end if;`
    )
  })
  lineas.push("  raise notice 'paridad SQL montoUsdGasto: 200 casos iguales';")
  casosNomina(200).forEach((c, k) => {
    const ts = montoNominaPeriodo(c.salario, c.desde, c.hasta)
    const esperado = ts === null ? 'null' : `${ts.toFixed(6)}::numeric`
    lineas.push(
      `  if ${sqlNomina(c)} is distinct from ${esperado} then raise exception 'nómina ${k} difiere: % vs ${esperado}', ${sqlNomina(c)}; end if;`
    )
  })
  lineas.push("  raise notice 'paridad SQL montoNominaPeriodo: 200 casos iguales';", 'end $$;')
  console.log(lineas.join('\n'))
  process.exit(0)
}

// ---------- montoUsdGasto ----------
igual('Bs 3.650,00 a 36,50 (referencial) → $100', montoUsdGasto('bs', 3650, 36.5), 100)
igual('Bs 3.650,00 a 40,00 (manual) → $91,25', montoUsdGasto('bs', 3650, 40), 91.25)
igual('Bs 1.234,56 a 412,37 → 2,993816', montoUsdGasto('bs', 1234.56, 412.37), 2.993816)
igual('Bs 100 a 3 → 33,333333', montoUsdGasto('bs', 100, 3), 33.333333)
igual('Bs 200 a 3 → 66,666667 (redondeo hacia arriba)', montoUsdGasto('bs', 200, 3), 66.666667)
igual('Bs 1 a 2.000.000 → 0,000001 (mitad exacta hacia arriba)', montoUsdGasto('bs', 1, 2_000_000), 0.000001)
igual('Bs 0,01 a 36,50 → 0,000274', montoUsdGasto('bs', 0.01, 36.5), 0.000274)
igual('USD 45,50 → 45,50 (la tasa no importa)', montoUsdGasto('usd', 45.5, 99), 45.5)
igual('USD 0,1 + 0,2 → 0,3 (redondeo a 6)', montoUsdGasto('usd', 0.1 + 0.2, 1), 0.3)
igual('redondea6Gasto(1,0000005) → 1,000001', redondea6Gasto(1.0000005), 1.000001)
let lanzo = false
try {
  montoUsdGasto('bs', 10, 0)
} catch {
  lanzo = true
}
verdadero('Bs con tasa 0 lanza', lanzo)

{
  const casos = casosAleatorios(200)
  let diferencias = 0
  const ejemplos: string[] = []
  for (const c of casos) {
    const ts = montoUsdGasto(c.moneda, c.monto, c.tasa)
    const sql = sqlMontoUsd(c)
    if (ts !== sql) {
      diferencias++
      if (ejemplos.length < 3) ejemplos.push(JSON.stringify({ c, ts, sql }))
    }
  }
  verdadero(
    'paridad montoUsdGasto con la fórmula del check en 200 casos',
    diferencias === 0,
    `${diferencias} diferencias: ${ejemplos.join(' | ')}`
  )
}

// ---------- Esquemas ----------
const hoy = fechaHoy()
const base: GastoFormInput = {
  fecha: hoy,
  categoria_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  descripcion: 'Reparación de la cava',
  beneficiario: '',
  moneda: 'bs',
  monto: 3650,
  tasa_origen: 'referencial',
  tasa_fuente: 'bcv',
  tasa: 36.5,
  metodo_pago: 'pago_movil',
  referencia: '',
  notas: '',
  periodo_desde: '',
  periodo_hasta: '',
}

function camposConError(r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }): string[] {
  return r.success ? [] : [...new Set((r.error?.issues ?? []).map((i) => i.path.join('.')))]
}

verdadero('gasto válido pasa', gastoFormSchema.safeParse(base).success)
igual('fecha futura → fecha', camposConError(gastoFormSchema.safeParse({ ...base, fecha: sumarDias(hoy, 1) })), ['fecha'])
igual('fecha de ayer pasa', gastoFormSchema.safeParse({ ...base, fecha: sumarDias(hoy, -1) }).success, true)
igual('descripción corta → descripcion', camposConError(gastoFormSchema.safeParse({ ...base, descripcion: ' ab ' })), ['descripcion'])
igual('monto 0 → monto', camposConError(gastoFormSchema.safeParse({ ...base, monto: 0 })), ['monto'])
igual('monto vacío → monto', camposConError(gastoFormSchema.safeParse({ ...base, monto: null })), ['monto'])
igual('sin categoría → categoria_id', camposConError(gastoFormSchema.safeParse({ ...base, categoria_id: '' })), ['categoria_id'])
igual(
  'período incompleto (solo desde) → periodo_hasta',
  camposConError(gastoFormSchema.safeParse({ ...base, periodo_desde: '2026-10-01' })),
  ['periodo_hasta']
)
igual(
  'período incompleto (solo hasta) → periodo_desde',
  camposConError(gastoFormSchema.safeParse({ ...base, periodo_hasta: '2026-10-31' })),
  ['periodo_desde']
)
igual(
  'período invertido → periodo_hasta',
  camposConError(gastoFormSchema.safeParse({ ...base, periodo_desde: '2026-10-31', periodo_hasta: '2026-10-01' })),
  ['periodo_hasta']
)
verdadero(
  'período completo pasa',
  gastoFormSchema.safeParse({ ...base, periodo_desde: '2026-10-01', periodo_hasta: '2026-10-31' }).success
)
igual('tasa manual vacía → tasa', camposConError(gastoFormSchema.safeParse({ ...base, tasa_origen: 'manual', tasa: null })), ['tasa'])
igual('referencial sin fuente → tasa_fuente', camposConError(gastoFormSchema.safeParse({ ...base, tasa_fuente: null })), ['tasa_fuente'])

const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
igual('motivo corto → motivo', camposConError(anularGastoSchema.safeParse({ id, motivo: ' no ' })), ['motivo'])
verdadero('motivo "pagado dos veces" pasa', anularGastoSchema.safeParse({ id, motivo: 'pagado dos veces' }).success)
igual('motivo de 501 → motivo', camposConError(anularGastoSchema.safeParse({ id, motivo: 'x'.repeat(501) })), ['motivo'])
verdadero('descartar sin motivo pasa', descartarGastoSchema.safeParse({ id, motivo: '' }).success)
igual('descartar con 501 → motivo', camposConError(descartarGastoSchema.safeParse({ id, motivo: 'x'.repeat(501) })), ['motivo'])
verdadero(
  'editar (P1) solo acepta descripción, beneficiario, referencia y notas',
  Object.keys(editarGastoSchema.shape).sort().join(',') === 'beneficiario,descripcion,id,notas,referencia'
)

igual('categoría con nombre de 1 → nombre', camposConError(categoriaGastoSchema.safeParse({ id: '', nombre: 'a', categoria_padre_id: '', orden: 0 })), ['nombre'])
igual(
  'categoría con orden vacío → 0',
  categoriaGastoSchema.safeParse({ id: '', nombre: 'Cava', categoria_padre_id: '', orden: null }).data?.orden,
  0
)

// ---------- Fase B: nómina (P3: salario mensual) ----------
igual('quincena 1–15 de $400 → $200', montoNominaPeriodo(400, '2026-10-01', '2026-10-15'), 200)
igual('2.ª quincena de octubre (31 días) → mitad', montoNominaPeriodo(400, '2026-10-16', '2026-10-31'), 200)
igual('octubre completo (31 días) → salario', montoNominaPeriodo(400, '2026-10-01', '2026-10-31'), 400)
igual('febrero 2026 completo (28 días) → salario', montoNominaPeriodo(400, '2026-02-01', '2026-02-28'), 400)
igual('febrero 2028 completo (bisiesto, 29) → salario', montoNominaPeriodo(400, '2028-02-01', '2028-02-29'), 400)
igual('2.ª quincena de febrero 2026 (16–28) → mitad', montoNominaPeriodo(400, '2026-02-16', '2026-02-28'), 200)
igual('1 de febrero a 1 de marzo no es mes → null', montoNominaPeriodo(400, '2026-02-01', '2026-03-01'), null)
igual('2.ª quincena de octubre hasta el 30 → null (otro período)', montoNominaPeriodo(400, '2026-10-16', '2026-10-30'), null)
igual('período de dos meses → null', montoNominaPeriodo(400, '2026-09-01', '2026-10-31'), null)
igual('Bs 14.600 en quincena → 7.300', montoNominaPeriodo(14600, '2026-09-01', '2026-09-15'), 7300)
igual('mitad de 0,000001 → 0,000001 (mitad hacia arriba)', montoNominaPeriodo(0.000001, '2026-09-01', '2026-09-15'), 0.000001)
igual('mitad de 333,33 → 166,665', montoNominaPeriodo(333.33, '2026-09-16', '2026-09-30'), 166.665)
igual('salario 0 en mes → 0', montoNominaPeriodo(0, '2026-09-01', '2026-09-30'), 0)
igual(
  'atajos de febrero 2026',
  atajosPeriodo('2026-02-10').map((a) => `${a.label}:${a.desde}..${a.hasta}`),
  ['1.ª quincena:2026-02-01..2026-02-15', '2.ª quincena:2026-02-16..2026-02-28', 'Mes:2026-02-01..2026-02-28']
)
igual(
  'atajos de octubre (31 días)',
  atajosPeriodo('2026-10-31').map((a) => `${a.desde}..${a.hasta}`),
  ['2026-10-01..2026-10-15', '2026-10-16..2026-10-31', '2026-10-01..2026-10-31']
)
igual('atajos de febrero 2028 (bisiesto)', atajosPeriodo('2028-02-01')[2].hasta, '2028-02-29')
igual('tipo 1–15', tipoPeriodoNomina('2026-10-01', '2026-10-15'), 'primera_quincena')
igual('tipo invertido → null', tipoPeriodoNomina('2026-10-15', '2026-10-01'), null)
verdadero('solapan 1–15 y 10–31', periodosSeSolapan({ desde: '2026-10-01', hasta: '2026-10-15' }, { desde: '2026-10-10', hasta: '2026-10-31' }))
verdadero('solapan quincena y mes', periodosSeSolapan({ desde: '2026-10-16', hasta: '2026-10-31' }, { desde: '2026-10-01', hasta: '2026-10-31' }))
verdadero('1–15 y 16–31 no se solapan', !periodosSeSolapan({ desde: '2026-10-01', hasta: '2026-10-15' }, { desde: '2026-10-16', hasta: '2026-10-31' }))
verdadero('comparten un día (15) → se solapan', periodosSeSolapan({ desde: '2026-10-01', hasta: '2026-10-15' }, { desde: '2026-10-15', hasta: '2026-10-20' }))
igual('meses de octubre → 1', mesesDelRango('2026-10-01', '2026-10-31'), 1)
igual('meses 15/09–10/10 → 2', mesesDelRango('2026-09-15', '2026-10-10'), 2)
igual('meses dic–feb → 3', mesesDelRango('2025-12-01', '2026-02-28'), 3)
igual(
  'costo: 2 quincenas de $200 (USD y Bs) en 1 mes',
  resumirCostoEmpleado(
    [
      { monto_usd: 200, tasa_snapshot: 36.5 },
      { monto_usd: 200, tasa_snapshot: 40 },
    ],
    1
  ),
  { total_usd: 400, total_bs: 15300, n_pagos: 2, promedio_mensual_usd: 400 }
)
igual('costo sin pagos en 3 meses', resumirCostoEmpleado([], 3), { total_usd: 0, total_bs: 0, n_pagos: 0, promedio_mensual_usd: 0 })
{
  const casos = casosNomina(200)
  const mitades = casos.filter((c) => {
    const t = tipoPeriodoNomina(c.desde, c.hasta)
    return t === 'primera_quincena' || t === 'segunda_quincena'
  })
  const malas = mitades.filter((c) => {
    const m = montoNominaPeriodo(c.salario, c.desde, c.hasta) as number
    // Espejo independiente: round(s/2, 6) con BigInt.
    const s = big(c.salario, 6)
    return m !== Number((s + BigInt(1)) / BigInt(2)) / 1e6
  })
  verdadero(`paridad de la mitad en ${mitades.length} quincenas aleatorias`, malas.length === 0, JSON.stringify(malas.slice(0, 3)))
}

const empleadoBase = { id: '', nombre: 'Pedro Pérez', cedula: 'V-12345678', cargo: '', salario_base: 400, moneda: 'usd' as const, notas: '' }
verdadero('empleado válido pasa', empleadoSchema.safeParse(empleadoBase).success)
igual('cédula «v-12345678 » se normaliza', empleadoSchema.safeParse({ ...empleadoBase, cedula: ' v-12345678 ' }).data?.cedula, 'V-12345678')
igual('cédula J- → cedula', camposConError(empleadoSchema.safeParse({ ...empleadoBase, cedula: 'J-12345678' })), ['cedula'])
igual('cédula corta → cedula', camposConError(empleadoSchema.safeParse({ ...empleadoBase, cedula: 'V-123' })), ['cedula'])
igual('nombre de 1 → nombre', camposConError(empleadoSchema.safeParse({ ...empleadoBase, nombre: 'P' })), ['nombre'])
igual('salario vacío → salario_base', camposConError(empleadoSchema.safeParse({ ...empleadoBase, salario_base: null })), ['salario_base'])
igual('salario negativo → salario_base', camposConError(empleadoSchema.safeParse({ ...empleadoBase, salario_base: -1 })), ['salario_base'])
verdadero('salario 0 pasa', empleadoSchema.safeParse({ ...empleadoBase, salario_base: 0 }).success)
igual('cargo de 81 → cargo', camposConError(empleadoSchema.safeParse({ ...empleadoBase, cargo: 'x'.repeat(81) })), ['cargo'])

const pagoBase = {
  ...base,
  moneda: 'usd' as const,
  monto: 200,
  empleado_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
  periodo_desde: '2026-10-01',
  periodo_hasta: '2026-10-15',
}
verdadero('pago de nómina válido pasa', pagoNominaSchema.safeParse(pagoBase).success)
igual('pago sin empleado → empleado_id', camposConError(pagoNominaSchema.safeParse({ ...pagoBase, empleado_id: '' })), ['empleado_id'])
igual(
  'pago sin período → periodo_desde',
  camposConError(pagoNominaSchema.safeParse({ ...pagoBase, periodo_desde: '', periodo_hasta: '' })),
  ['periodo_desde']
)
igual(
  'pago con período incompleto → periodo_hasta',
  camposConError(pagoNominaSchema.safeParse({ ...pagoBase, periodo_hasta: '' })),
  ['periodo_hasta']
)
igual('pago con fecha futura → fecha', camposConError(pagoNominaSchema.safeParse({ ...pagoBase, fecha: sumarDias(hoy, 1) })), ['fecha'])

// ==================== Fase C: Gastos recurrentes ====================
{
  // 1. Mensual con dia_mes = 28
  const p1 = periodosRecurrente(
    { frecuencia: 'mensual', dia_mes: 28, fecha_inicio: '2026-01-01', fecha_fin: '2026-03-31' },
    '2026-03-31'
  )
  igual('recurrentes mensual día 28: 3 períodos', p1.length, 3)
  igual('recurrentes mensual día 28: fecha prog enero', p1[0]?.fecha_programada, '2026-01-28')
  igual('recurrentes mensual día 28: fecha prog febrero', p1[1]?.fecha_programada, '2026-02-28')

  // 2. Mensual con dia_mes = null (fin de mes)
  const p2 = periodosRecurrente(
    { frecuencia: 'mensual', dia_mes: null, fecha_inicio: '2026-02-01', fecha_fin: '2026-02-28' },
    '2026-02-28'
  )
  igual('recurrentes mensual fin de mes: febrero fecha prog', p2[0]?.fecha_programada, '2026-02-28')

  // 3. Quincenal en febrero
  const pQ = periodosRecurrente(
    { frecuencia: 'quincenal', dia_mes: null, fecha_inicio: '2026-02-01', fecha_fin: '2026-02-28' },
    '2026-02-28'
  )
  igual('recurrentes quincenal febrero: 2 períodos', pQ.length, 2)
  igual('recurrentes quincenal febrero: Q1', pQ[0], { desde: '2026-02-01', hasta: '2026-02-15', fecha_programada: '2026-02-15' })
  igual('recurrentes quincenal febrero: Q2', pQ[1], { desde: '2026-02-16', hasta: '2026-02-28', fecha_programada: '2026-02-28' })

  // 4. Inicio a mitad de mes (ej. día 20, con día programado 5)
  const pMitad = periodosRecurrente(
    { frecuencia: 'mensual', dia_mes: 5, fecha_inicio: '2026-10-20', fecha_fin: '2026-11-30' },
    '2026-11-30'
  )
  igual('recurrentes inicio mitad mes no genera período pasado', pMitad.length, 1)
  igual('recurrentes inicio mitad mes: fecha prog noviembre', pMitad[0]?.fecha_programada, '2026-11-05')

  // 5. Próximas fechas
  const prox = proximasFechas(
    { frecuencia: 'mensual', dia_mes: 10, fecha_inicio: '2026-01-01', fecha_fin: null },
    3,
    '2026-05-15'
  )
  igual('próximas 3 fechas mensuales desde mayo 15', prox, ['2026-06-10', '2026-07-10', '2026-08-10'])

  // 6. Validación de schema de recurrentes
  const recBase = {
    nombre: 'Alquiler Cava',
    categoria_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    empleado_id: null,
    descripcion: 'Pago de alquiler',
    beneficiario: 'Inmobiliaria',
    moneda: 'usd' as const,
    monto: 500,
    frecuencia: 'mensual' as const,
    dia_mes: 5,
    fecha_inicio: '2026-01-01',
    fecha_fin: null,
    metodo_pago: 'transferencia' as const,
    activo: true,
  }
  verdadero('plantilla recurrente válida pasa', gastoRecurrenteSchema.safeParse(recBase).success)

  // Sin monto ni empleado falla
  igual('recurrente sin monto ni empleado → monto', camposConError(gastoRecurrenteSchema.safeParse({ ...recBase, monto: null })), ['monto'])

  // Nómina recurrente sin monto pero con empleado pasa
  verdadero(
    'nómina recurrente sin monto pero con empleado pasa',
    gastoRecurrenteSchema.safeParse({ ...recBase, monto: null, empleado_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302' }).success
  )

  // Quincenal con dia_mes falla
  igual(
    'quincenal con dia_mes → dia_mes',
    camposConError(gastoRecurrenteSchema.safeParse({ ...recBase, frecuencia: 'quincenal', dia_mes: 5 })),
    ['dia_mes']
  )

  // fecha_fin < fecha_inicio falla
  igual(
    'fecha_fin anterior a fecha_inicio → fecha_fin',
    camposConError(gastoRecurrenteSchema.safeParse({ ...recBase, fecha_fin: '2025-12-31' })),
    ['fecha_fin']
  )
}

if (fallas > 0) {
  console.log(`\n${fallas} caso(s) fallaron`)
  process.exit(1)
}
console.log('\nTodos los casos pasaron')
