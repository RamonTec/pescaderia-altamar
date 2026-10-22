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
 * (falla con una excepción si alguno difiere).
 */
import { montoUsdGasto, redondea6Gasto } from '../src/lib/gastos/montos'
import {
  anularGastoSchema,
  descartarGastoSchema,
  editarGastoSchema,
  gastoFormSchema,
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
  lineas.push("  raise notice 'paridad SQL montoUsdGasto: 200 casos iguales';", 'end $$;')
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

if (fallas > 0) {
  console.log(`\n${fallas} caso(s) fallaron`)
  process.exit(1)
}
console.log('\nTodos los casos pasaron')
