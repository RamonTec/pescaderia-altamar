/**
 * Pruebas del dominio puro del procesamiento multisalida (16). Sin framework
 * de tests: falla con `process.exit(1)` si algún caso no coincide.
 *
 *   npx tsx scripts/probar-procesamiento.ts
 *
 * Las cifras del caso del cliente son las mismas que deja la RPC
 * `registrar_procesamiento` (validado en un Postgres local con todas las
 * migraciones): el cálculo de la UI es espejo exacto de la base.
 */
import { prorratearEntrada, repartirCostoProceso } from '../src/lib/services/costingService'
import {
  precioEfectivo,
  procesamientoFormSchema,
  validarPreciosSalidas,
} from '../src/lib/procesamientoValidation'
import { resultadoLote } from '../src/lib/lotes'
import type { Lote, TrazabilidadLote, VentaLote } from '../src/types/domain'

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

/** Suma en micro-USD (enteros) para comparar sin coma flotante. */
const microSuma = (xs: number[]) => xs.reduce((s, x) => s + Math.round(x * 1e6), 0)
const milSuma = (xs: number[]) => xs.reduce((s, x) => s + Math.round(x * 1e3), 0)

// ---------- Caso del cliente: lote de 10 kg a $5, piel de 0,5 kg ----------
{
  const r = repartirCostoProceso({
    pesoEntradaKg: 10,
    costoLoteUsdKg: 5,
    salidas: [
      { kg: 6, precio: 12 }, // filete
      { kg: 1, precio: 2 }, // cabeza
      { kg: 0.5, precio: 1 }, // piel
    ],
  })
  igual('cliente: costo total', r.costo_total_usd, 50)
  igual('cliente: reparto por valor', r.reparto, 'valor')
  igual(
    'cliente: costo asignado',
    r.salidas.map((s) => s.costo_usd),
    [48.322148, 1.342282, 0.33557]
  )
  igual(
    'cliente: costo/kg',
    r.salidas.map((s) => s.costo_usd_kg),
    [8.053691, 1.342282, 0.67114]
  )
  igual('cliente: Σ costo = 50 exacto', microSuma(r.salidas.map((s) => s.costo_usd)), 50_000_000)
  igual('cliente: salida total', r.salida_total_kg, 7.5)
  igual('cliente: merma', r.merma_kg, 2.5)
  igual('cliente: merma %', r.merma_pct, 0.25)
  igual('cliente: rendimiento', r.rendimiento, 0.75)
  igual(
    'cliente: % de la entrada',
    r.salidas.map((s) => s.participacion_kg),
    [0.6, 0.1, 0.05]
  )
  igual('cliente: entrada prorrateada', prorratearEntrada(10, [6, 1, 0.5]), [8, 1.333, 0.667])
}

// ---------- Una sola salida sin precio = transferencia total ----------
{
  const r = repartirCostoProceso({
    pesoEntradaKg: 10,
    costoLoteUsdKg: 5,
    salidas: [{ kg: 6, precio: null }],
  })
  igual('una salida: reparto por peso', r.reparto, 'peso')
  igual('una salida: 100 % del costo', r.salidas[0].costo_usd, 50)
  igual('una salida: costo/kg = 50 / 6', r.salidas[0].costo_usd_kg, 8.333333)
  igual('una salida: participación', r.salidas[0].participacion_costo, 1)
}
{
  const r = repartirCostoProceso({
    pesoEntradaKg: 10,
    costoLoteUsdKg: 5,
    salidas: [{ kg: 10, precio: null }],
  })
  igual('una salida sin merma: $50 a $5/kg', [r.salidas[0].costo_usd, r.salidas[0].costo_usd_kg], [50, 5])
}

// ---------- Todos los precios en 0 → reparto por peso ----------
{
  const r = repartirCostoProceso({
    pesoEntradaKg: 10,
    costoLoteUsdKg: 5,
    salidas: [
      { kg: 6, precio: 0 },
      { kg: 2, precio: 0 },
    ],
  })
  igual('todo en 0: reparto por peso', r.reparto, 'peso')
  igual(
    'todo en 0: mismo costo/kg = 50 / 8',
    r.salidas.map((s) => s.costo_usd_kg),
    [6.25, 6.25]
  )
  igual('todo en 0: costo asignado', r.salidas.map((s) => s.costo_usd), [37.5, 12.5])
}

// ---------- Precio 0 junto a otras con precio → costo 0 ----------
{
  const r = repartirCostoProceso({
    pesoEntradaKg: 10,
    costoLoteUsdKg: 5,
    salidas: [
      { kg: 6, precio: 12 },
      { kg: 1, precio: 0 },
    ],
  })
  igual('precio 0: reparto por valor', r.reparto, 'valor')
  igual('precio 0: costos', r.salidas.map((s) => s.costo_usd), [50, 0])
  igual('precio 0: costo/kg 0', r.salidas[1].costo_usd_kg, 0)
}

// ---------- Residuo de redondeo a la de mayor peso ----------
{
  const r = repartirCostoProceso({
    pesoEntradaKg: 1,
    costoLoteUsdKg: 0.000001, // 1 micro-USD a repartir entre 3 iguales
    salidas: [
      { kg: 0.3, precio: 1 },
      { kg: 0.3, precio: 1 },
      { kg: 0.3, precio: 1 },
    ],
  })
  igual('residuo: al primero en empate', r.salidas.map((s) => s.costo_usd), [0.000001, 0, 0])
}

// ---------- 50 repartos aleatorios: Σ costo = costo total exacto ----------
{
  // Generador determinista (mulberry32) para que el script sea reproducible.
  let semilla = 20261019
  const azar = () => {
    semilla |= 0
    semilla = (semilla + 0x6d2b79f5) | 0
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const redondear = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

  let exactos = 0
  let prorrateosOk = 0
  for (let caso = 0; caso < 50; caso++) {
    const n = 1 + Math.floor(azar() * 10)
    const entrada = redondear(1 + azar() * 200, 3)
    const costo = redondear(azar() * 20, 6)
    // Salidas que suman ≤ entrada (a veces exactamente la entrada).
    const partes = Array.from({ length: n }, () => 0.05 + azar())
    const total = partes.reduce((s, p) => s + p, 0)
    const fraccion = caso % 5 === 0 ? 1 : 0.4 + azar() * 0.6
    let kgs = partes.map((p) => Math.max(0.001, redondear((entrada * fraccion * p) / total, 3)))
    // Ajuste fino para no pasarse de la entrada por redondeo.
    while (milSuma(kgs) > Math.round(entrada * 1000)) {
      const i = kgs.indexOf(Math.max(...kgs))
      kgs = kgs.map((k, j) => (j === i ? redondear(k - 0.001, 3) : k))
    }
    const salidas = kgs.map((kg) => ({
      kg,
      precio: azar() < 0.15 ? 0 : redondear(azar() * 30, 2),
    }))
    const r = repartirCostoProceso({ pesoEntradaKg: entrada, costoLoteUsdKg: costo, salidas })
    if (microSuma(r.salidas.map((s) => s.costo_usd)) === Math.round(r.costo_total_usd * 1e6)) {
      exactos++
    } else {
      console.log('  caso', caso, JSON.stringify({ entrada, costo, salidas }))
    }

    const e = prorratearEntrada(entrada, kgs)
    if (
      milSuma(e) === Math.round(entrada * 1000) &&
      e.every((ei, i) => Math.round(ei * 1000) >= Math.round(kgs[i] * 1000))
    ) {
      prorrateosOk++
    } else {
      console.log('  prorrateo', caso, JSON.stringify({ entrada, kgs, e }))
    }
  }
  igual('aleatorios: Σ costo = costo total en 50 repartos', exactos, 50)
  igual('aleatorios: prorrateo Σ = entrada y e_i ≥ kg_i en 50 casos', prorrateosOk, 50)
}

// ---------- Prorrateo de la entrada ----------
igual('prorrateo: sin merma (Σ salidas = entrada)', prorratearEntrada(7.5, [6, 1, 0.5]), [6, 1, 0.5])
igual('prorrateo: tercios', prorratearEntrada(1, [0.3, 0.3, 0.3]), [0.334, 0.333, 0.333])
{
  const e = prorratearEntrada(10, [3.333, 3.333, 3.334])
  verdadero(
    'prorrateo: e_i ≥ kg_i y Σ = 10',
    milSuma(e) === 10_000 && e[0] >= 3.333 && e[1] >= 3.333 && e[2] >= 3.334,
    JSON.stringify(e)
  )
}

// ---------- Esquema del formulario ----------
{
  const CRUDO = '11111111-1111-4111-8111-111111111111'
  const LOTE = '22222222-2222-4222-8222-222222222222'
  const FILETE = '33333333-3333-4333-8333-333333333333'
  const CABEZA = '44444444-4444-4444-8444-444444444444'
  const PIEL = '55555555-5555-4555-8555-555555555555'
  const base = {
    fecha: '2026-10-19',
    producto_origen_id: CRUDO,
    lote_origen_id: LOTE,
    peso_entrada_kg: 10,
    notas: '',
  }
  const caminos = (r: ReturnType<typeof procesamientoFormSchema.safeParse>) =>
    r.success ? [] : r.error.issues.map((i) => i.path.join('.'))

  const ok = procesamientoFormSchema.safeParse({
    ...base,
    salidas: [
      { producto_destino_id: FILETE, peso_salida_kg: 6, precio_referencia_usd_kg: null },
      { producto_destino_id: CABEZA, peso_salida_kg: 1, precio_referencia_usd_kg: 2 },
      { producto_destino_id: PIEL, peso_salida_kg: 0.5, precio_referencia_usd_kg: 1 },
    ],
  })
  igual('esquema: caso del cliente válido', ok.success, true)

  const duplicado = procesamientoFormSchema.safeParse({
    ...base,
    salidas: [
      { producto_destino_id: FILETE, peso_salida_kg: 6, precio_referencia_usd_kg: null },
      { producto_destino_id: FILETE, peso_salida_kg: 1, precio_referencia_usd_kg: null },
    ],
  })
  igual('esquema: producto duplicado', caminos(duplicado), ['salidas.1.producto_destino_id'])

  const exceso = procesamientoFormSchema.safeParse({
    ...base,
    salidas: [
      { producto_destino_id: FILETE, peso_salida_kg: 8, precio_referencia_usd_kg: null },
      { producto_destino_id: CABEZA, peso_salida_kg: 2.5, precio_referencia_usd_kg: null },
    ],
  })
  igual('esquema: Σ salidas > entrada', caminos(exceso), ['salidas'])

  const sinMerma = procesamientoFormSchema.safeParse({
    ...base,
    salidas: [
      { producto_destino_id: FILETE, peso_salida_kg: 8, precio_referencia_usd_kg: null },
      { producto_destino_id: CABEZA, peso_salida_kg: 2, precio_referencia_usd_kg: null },
    ],
  })
  igual('esquema: Σ salidas = entrada es válido', sinMerma.success, true)

  const once = procesamientoFormSchema.safeParse({
    ...base,
    salidas: Array.from({ length: 11 }, () => ({
      producto_destino_id: FILETE,
      peso_salida_kg: 0.1,
      precio_referencia_usd_kg: null,
    })),
  })
  verdadero('esquema: máximo 10 salidas', caminos(once).includes('salidas'))

  const catalogo = [
    { id: FILETE, precio_referencia_usd_kg: 12 },
    { id: CABEZA, precio_referencia_usd_kg: null },
    { id: PIEL, precio_referencia_usd_kg: null },
  ]
  igual(
    'precios: falta el de la piel (sin catálogo ni formulario)',
    validarPreciosSalidas(
      [
        { producto_destino_id: FILETE, precio_referencia_usd_kg: null },
        { producto_destino_id: CABEZA, precio_referencia_usd_kg: 2 },
        { producto_destino_id: PIEL, precio_referencia_usd_kg: null },
      ],
      catalogo
    ),
    { 2: 'Indica el precio de referencia' }
  )
  igual(
    'precios: una sola salida no exige precio',
    validarPreciosSalidas([{ producto_destino_id: PIEL, precio_referencia_usd_kg: null }], catalogo),
    {}
  )
  igual(
    'precios: el catálogo manda sobre el formulario',
    precioEfectivo({ producto_destino_id: FILETE, precio_referencia_usd_kg: 99 }, catalogo),
    { precio: 12, delCatalogo: true }
  )
}

// ---------- Resultado del árbol del caso del cliente ----------
{
  const lote = (id: string, costo: number, kg: number, padre: string | null): Lote => ({
    id,
    codigo: id.toUpperCase(),
    producto_id: `p-${id}`,
    producto_nombre: id,
    producto_codigo: null,
    producto_tipo: padre ? 'procesado' : 'crudo',
    origen: padre ? 'proceso' : 'compra',
    compra_item_id: null,
    compra_id: null,
    proceso_item_id: padre ? `pi-${id}` : null,
    procesamiento_id: padre ? 'pr-1' : null,
    lote_padre_id: padre,
    lote_padre_codigo: padre ? padre.toUpperCase() : null,
    proveedor_id: null,
    proveedor_nombre: null,
    fecha_ingreso: '2026-10-19',
    peso_inicial_kg: kg,
    stock_kg: 0,
    costo_usd_kg: costo,
    moneda: 'usd',
    tasa_snapshot: 40,
    estado: 'abierto',
    notas: null,
    created_at: '2026-10-19T00:00:00Z',
  })
  const crudo = lote('pes', 5, 10, null)
  const hijos = [
    lote('fil', 8.053691, 6, 'pes'),
    lote('cab', 1.342282, 1, 'pes'),
    lote('pie', 0.67114, 0.5, 'pes'),
  ]
  const venta = (loteId: string, kg: number, precio: number): VentaLote => ({
    id: `v-${loteId}`,
    lote_id: loteId,
    factura_id: 'f',
    factura_numero: 1,
    factura_estado: 'pagada',
    cliente_id: 'c',
    cliente_nombre: 'Cliente',
    fecha: '2026-10-19',
    peso_kg: kg,
    precio_usd_kg: precio,
    costo_usd_kg: null,
    tasa_factura: 40,
  })
  const traza: TrazabilidadLote = {
    lote: crudo,
    arbol: [crudo, ...hijos],
    procesos: [
      {
        procesamiento_id: 'pr-1',
        fecha: '2026-10-19',
        lote_origen_id: 'pes',
        peso_entrada_kg: 10,
        salidas: hijos.map((h) => ({
          proceso_item_id: `pi-${h.id}`,
          producto_nombre: h.producto_nombre,
          peso_salida_kg: h.peso_inicial_kg,
          lote_destino_id: h.id,
          lote_destino_codigo: h.codigo,
        })),
      },
    ],
    ventas: [venta('fil', 3, 15), venta('cab', 1, 3), venta('pie', 0.25, 2)],
    perdidas: [],
    devoluciones: [],
  }
  const r = resultadoLote(traza)
  igual('árbol: merma y rendimiento del proceso', [r?.mermaKg, r?.rendimiento], [2.5, 0.75])
  igual('árbol: kg vendidos de los 3 hijos', r?.kgVendidos, 4.25)
  // 48,5 − (3 × 8,053691 + 1 × 1,342282 + 0,25 × 0,67114) = 22,82886
  igual('árbol: resultado USD consolidado', [r?.ingresoUsd, r?.costoVendidoUsd, r?.resultadoUsd], [48.5, 25.67114, 22.82886])
  igual('árbol: resultado Bs a tasa 40 y sin efecto cambiario', [r?.resultadoBs, r?.efectoCambiarioBs], [913.1544, 0])
}

if (fallas > 0) {
  console.error(`\n${fallas} caso(s) fallaron`)
  process.exit(1)
}
console.log('\nTodos los casos pasaron')
