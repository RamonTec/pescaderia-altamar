/**
 * Pruebas del dominio puro de la trazabilidad y corrección de facturas (17).
 * Sin framework de tests: falla con `process.exit(1)` si algún caso no coincide.
 *
 *   npx tsx scripts/probar-correccion-factura.ts [traza.json …]
 *
 * Las cifras del caso del cliente (tarea 21) son las mismas que deja la RPC
 * `corregir_linea_factura` en un Postgres local con todas las migraciones.
 * Opcional: rutas a JSON de `trazabilidad_factura` (salida de `psql -At`)
 * para ver las señales que la ficha calcularía con tolerancia 0 y 5 %.
 */
import { readFileSync } from 'node:fs'
import { ivaSobre, subtotalItems, totalesDe } from '../src/lib/facturas/totales'
import { margenFactura, margenLinea } from '../src/lib/facturas/margen'
import {
  precioReferenciaLinea,
  senalFactura,
  senalesLinea,
  textoConteoSenales,
} from '../src/lib/facturas/senales'
import { previsualizarCorreccion, repartoBajaPeso, type FacturaParaCorreccion } from '../src/lib/facturas/correccion'
import { corregirLineaSchema } from '../src/lib/correccionFacturaValidation'
import { mapearTrazabilidad } from '../src/lib/repositories/trazabilidadFacturaMapper'
import type { EslabonLoteVendido, LineaTrazabilidad } from '../src/types/domain'

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

// ---------- Fábricas de líneas ----------
const base = {
  fil_id: 'fil',
  costo_usd_kg: 8,
  kg_devueltos: 0,
  fecha_ingreso: '2026-10-01',
  estado: 'abierto' as const,
  stock_kg: 1,
  moneda: 'usd' as const,
  tasa_snapshot: 36.5,
  lote_costo_usd_kg: 8,
}

function loteProceso(codigo: string, kg: number, ref: number | null, orden = 1): EslabonLoteVendido {
  return {
    ...base,
    lote_id: codigo,
    codigo,
    orden,
    peso_kg: kg,
    origen: 'proceso',
    proceso: {
      procesamiento_id: 'p',
      proceso_item_id: 'pi',
      fecha: '2026-10-01',
      reparto_costo: 'valor',
      legado: false,
      peso_entrada_kg: 10,
      peso_salida_total_kg: 7.5,
      salidas: 3,
      peso_salida_kg: 6,
      costo_total_usd: 48.322148,
      precio_referencia_usd_kg: ref,
      lote_padre: null,
    },
  }
}

function loteCompra(codigo: string, kg: number, orden = 1): EslabonLoteVendido {
  return {
    ...base,
    lote_id: codigo,
    codigo,
    orden,
    peso_kg: kg,
    origen: 'compra',
    compra: { compra_id: 'c', fecha: '2026-10-01', proveedor_id: 'pv', proveedor_nombre: 'Pesquera' },
  }
}

function linea(
  precio: number,
  costo: number,
  lotes: EslabonLoteVendido[],
  catalogo: number | null = null,
  controlaStock = true
): LineaTrazabilidad {
  return {
    id: 'l',
    producto: {
      id: 'p',
      nombre: 'Filete',
      codigo: 'FIL',
      tipo: 'procesado',
      controla_stock: controlaStock,
      precio_referencia_usd_kg: catalogo,
    },
    peso_kg: lotes.reduce((s, l) => s + l.peso_kg, 0) || 1,
    precio_usd_kg: precio,
    costo_usd_kg: costo,
    kg_devueltos: 0,
    lotes,
  }
}

// ---------- Tarea 21: totales del caso del cliente ----------
{
  igual('21) factura original 2 × 12 con IVA 16 %', totalesDe([{ peso_kg: 2, precio_usd_kg: 12 }], 16), {
    subtotal_usd: 24,
    iva_usd: 3.84,
    total_usd: 27.84,
  })

  const factura: FacturaParaCorreccion = {
    subtotal_usd: 24,
    iva_usd: 3.84,
    total_usd: 27.84,
    iva_pct: 16,
    pagado_usd: 20,
    creditos_usd: 0,
    lineas: [{ id: 'fi', peso_kg: 2, precio_usd_kg: 12, kg_devueltos: 0 }],
  }
  const a = previsualizarCorreccion(factura, 'fi', 1.5, 12)
  igual('21a) 2,000 → 1,500: total y saldo', [a.despues.total_usd, a.saldo_despues_usd, a.estado_despues], [20.88, 0.88, 'abierta'])
  igual('21a) delta de kg', a.delta_kg, -0.5)

  const f2 = { ...factura, ...a.despues, lineas: [{ id: 'fi', peso_kg: 1.5, precio_usd_kg: 12, kg_devueltos: 0 }] }
  const b = previsualizarCorreccion(f2, 'fi', 1.5, 10)
  igual(
    '21b) precio 12 → 10: total 17,40 y saldo a favor 2,60 (pagada)',
    [b.despues.total_usd, b.saldo_despues_usd, b.saldo_a_favor_despues_usd, b.estado_despues],
    [17.4, 0, 2.6, 'pagada']
  )
  igual('21b) solo precio: delta de kg 0', b.delta_kg, 0)

  const f3 = { ...factura, ...b.despues, lineas: [{ id: 'fi', peso_kg: 1.5, precio_usd_kg: 10, kg_devueltos: 0 }] }
  const c = previsualizarCorreccion(f3, 'fi', 2.5, 10)
  igual('21c) 1,500 → 2,500: total 29, saldo 9, abierta', [c.despues.total_usd, c.saldo_despues_usd, c.estado_despues], [29, 9, 'abierta'])
  igual('sin cambios', previsualizarCorreccion(f3, 'fi', 1.5, 10).sin_cambios, true)
}

// ---------- Saldo a favor y mínimo por kg devueltos ----------
{
  const factura: FacturaParaCorreccion = {
    subtotal_usd: 24,
    iva_usd: 3.84,
    total_usd: 27.84,
    iva_pct: 16,
    pagado_usd: 27.84,
    creditos_usd: 0,
    lineas: [{ id: 'fi', peso_kg: 2, precio_usd_kg: 12, kg_devueltos: 1 }],
  }
  const p = previsualizarCorreccion(factura, 'fi', 1.2, 12)
  // Pagada en 27,84; baja a 1,2 × 12 = 16,704 con IVA → 11,136 a favor.
  igual('saldo a favor de una factura pagada que baja', [p.saldo_a_favor_despues_usd, p.estado_despues], [11.136, 'pagada'])
  igual('mínimo por kg devueltos: 0,900 < 1,000', previsualizarCorreccion(factura, 'fi', 0.9, 12).bajo_minimo, true)
  igual('mínimo por kg devueltos: 1,000 permitido', previsualizarCorreccion(factura, 'fi', 1, 12).bajo_minimo, false)
  igual('mínimo informado', p.minimo_kg, 1)

  // Tarea 22: la baja vuelve en orden inverso con tope por lo ya devuelto.
  igual(
    '22) baja de 0,8: FIL-C (orden 2) tiene tope 0, vuelve todo a FIL-2',
    repartoBajaPeso(
      [
        { codigo: 'FIL-2', orden: 1, peso_kg: 1, kg_devueltos: 0 },
        { codigo: 'FIL-C', orden: 2, peso_kg: 1, kg_devueltos: 1 },
      ],
      0.8
    ),
    [{ codigo: 'FIL-2', peso_kg: 0.8 }]
  )
  igual(
    'baja de 1,2 sin notas: orden inverso',
    repartoBajaPeso(
      [
        { codigo: 'A', orden: 1, peso_kg: 1, kg_devueltos: 0 },
        { codigo: 'B', orden: 2, peso_kg: 0.7, kg_devueltos: 0 },
      ],
      1.2
    ),
    [
      { codigo: 'B', peso_kg: 0.7 },
      { codigo: 'A', peso_kg: 0.5 },
    ]
  )
}

// ---------- Señales (tarea 25) ----------
{
  const s0 = (l: LineaTrazabilidad) => senalesLinea(l, 0)
  igual('25) precio 7 con costo 8,05 → Pérdida', s0(linea(7, 8.05, [loteProceso('A', 1, 7)])).senales, ['perdida'])
  igual('25) precio 11,50 con ref 12 → Por debajo', s0(linea(11.5, 8, [loteProceso('A', 1, 12)])).senales, ['por_debajo'])
  igual('25) precio 120 con ref 12 → Cobro mayor', s0(linea(120, 8, [loteProceso('A', 1, 12)])).senales, ['cobro_mayor'])
  igual('25) precio 12 con ref 12 → sin señal', s0(linea(12, 8, [loteProceso('A', 1, 12)])).senales, [])
  igual('25) borde exacto: nivel ok', s0(linea(12, 8, [loteProceso('A', 1, 12)])).nivel, 'ok')
  // Ref ponderada 11,999999 contra 12: sin señal (al centavo).
  const pond = linea(12, 8, [loteProceso('A', 1, 11.999998), loteProceso('B', 1, 12, 2)])
  igual('ref ponderada 11,999999 vs 12 → sin señal', [precioReferenciaLinea(pond).precio, s0(pond).senales], [11.999999, []])
  igual('25) crudo sin referencia → "Sin referencia"', s0(linea(11, 5, [loteCompra('SALM', 1)])).indicadores, ['sin_referencia'])
  igual(
    '25) sin control de stock → "Sin costo" (y sin referencia)',
    s0(linea(1, 0, [], null, false)).indicadores,
    ['sin_costo', 'sin_referencia']
  )
  igual('perdida es nivel error', s0(linea(7, 8.05, [loteProceso('A', 1, 7)])).nivel, 'error')
  igual('por_debajo es nivel aviso', s0(linea(11.5, 8, [loteProceso('A', 1, 12)])).nivel, 'aviso')

  // Tolerancia 5 %: 11,50 deja de marcarse (umbral 11,40); 120 sigue; 12,60 es el borde.
  const s5 = (l: LineaTrazabilidad) => senalesLinea(l, 5).senales
  igual('tol 5 %: 11,50 con ref 12 → sin señal', s5(linea(11.5, 8, [loteProceso('A', 1, 12)])), [])
  igual('tol 5 %: 11,39 con ref 12 → Por debajo', s5(linea(11.39, 8, [loteProceso('A', 1, 12)])), ['por_debajo'])
  igual('tol 5 %: 120 con ref 12 → Cobro mayor', s5(linea(120, 8, [loteProceso('A', 1, 12)])), ['cobro_mayor'])
  igual('tol 5 %: 12,60 con ref 12 (borde) → sin señal', s5(linea(12.6, 8, [loteProceso('A', 1, 12)])), [])
  igual('tol 5 %: 12,61 con ref 12 → Cobro mayor', s5(linea(12.61, 8, [loteProceso('A', 1, 12)])), ['cobro_mayor'])
  igual('tol 5 %: la pérdida no usa tolerancia', s5(linea(8, 8.05, [loteProceso('A', 1, 8)])), ['perdida'])

  // Precio de referencia ponderado.
  igual(
    'ref: solo los lotes con snapshot, ponderados por kg',
    precioReferenciaLinea(linea(12, 8, [loteProceso('A', 1, 12), loteProceso('B', 3, 10, 2), loteCompra('C', 2, 3)])),
    { precio: 10.5, fuente: 'proceso' }
  )
  igual(
    'ref: sin snapshot → catálogo',
    precioReferenciaLinea(linea(12, 8, [loteProceso('A', 1, null), loteCompra('C', 2, 2)], 9)),
    { precio: 9, fuente: 'catalogo' }
  )
  igual('ref: sin snapshot ni catálogo → null', precioReferenciaLinea(linea(12, 8, [loteCompra('C', 2)])), {
    precio: null,
    fuente: null,
  })

  // Nivel de la factura y conteo.
  const lineas = [
    s0(linea(7, 8.05, [loteProceso('A', 1, 7)])),
    s0(linea(120, 8, [loteProceso('A', 1, 12)])),
    s0(linea(130, 8, [loteProceso('A', 1, 12)])),
  ]
  const r = senalFactura(lineas)
  igual('factura: peor nivel', r.nivel, 'error')
  igual('factura: conteo', textoConteoSenales(r.conteo), '1 pérdida · 2 cobro mayor')
}

// ---------- Margen ----------
{
  igual('margen de línea 2 × 12 con costo 8', margenLinea({ peso_kg: 2, precio_usd_kg: 12, costo_usd_kg: 8 }), {
    venta_usd: 24,
    costo_usd: 16,
    margen_usd: 8,
    margen_pct: 1 / 3,
  })
  igual('margen con venta 0 → % null', margenLinea({ peso_kg: 1, precio_usd_kg: 0, costo_usd_kg: 2 }).margen_pct, null)
  const m = margenFactura(
    [
      { id: 'a', peso_kg: 2, precio_usd_kg: 12, costo_usd_kg: 8 },
      { id: 'b', peso_kg: 1, precio_usd_kg: 3, costo_usd_kg: 0 },
    ],
    [
      { estado: 'emitida', items: [{ factura_item_id: 'a', peso_kg: 0.5, precio_usd_kg: 12 }] },
      { estado: 'anulada', items: [{ factura_item_id: 'a', peso_kg: 1, precio_usd_kg: 12 }] },
    ]
  )
  igual('margen neto con nota emitida (la anulada no cuenta)', [m.venta_usd, m.costo_usd, m.margen_usd], [21, 12, 9])
}

// ---------- Validación ----------
{
  const id = '3f1c2a54-9b7e-4d2a-8c11-0a9e5f6b7c21'
  igual(
    'esquema: motivo corto',
    corregirLineaSchema.safeParse({ factura_id: id, factura_item_id: id, peso_kg: 1, precio_usd_kg: 1, motivo: ' abc ' }).success,
    false
  )
  igual(
    'esquema: peso con 4 decimales',
    corregirLineaSchema.safeParse({ factura_id: id, factura_item_id: id, peso_kg: 1.0005, precio_usd_kg: 1, motivo: 'Error de báscula' }).success,
    false
  )
  igual(
    'esquema: peso 0',
    corregirLineaSchema.safeParse({ factura_id: id, factura_item_id: id, peso_kg: 0, precio_usd_kg: 1, motivo: 'Error de báscula' }).success,
    false
  )
  const ok = corregirLineaSchema.safeParse({ factura_id: id, factura_item_id: id, peso_kg: 1.5, precio_usd_kg: 0, motivo: '  Error de báscula ' })
  igual('esquema: válido, precio 0 y motivo con trim', ok.success ? ok.data.motivo : null, 'Error de báscula')
}

// ---------- Paridad de subtotalItems / ivaSobre con la fórmula SQL ----------
{
  // Decimal exacto como `numeric` de Postgres: round(Σ peso × precio, 6),
  // round(subtotal × iva / 100, 6), mitad lejos de cero.
  const redondeaDiv = (n: bigint, d: bigint) => (n >= BigInt(0) ? (n + d / BigInt(2)) / d : -((-n + d / BigInt(2)) / d))
  function sql(items: { p: number; q: number }[], ivaCent: number) {
    // peso en milésimas × precio en millonésimas = escala 1e-9.
    const suma = items.reduce((s, i) => s + BigInt(i.p) * BigInt(i.q), BigInt(0))
    const sub = redondeaDiv(suma, BigInt(1000)) // escala 1e-6
    const iva = redondeaDiv(sub * BigInt(ivaCent), BigInt(10000)) // 1e-6 × 1e-2 / 100 → 1e-6
    return { sub: Number(sub), iva: Number(iva), total: Number(sub + iva) }
  }
  let semilla = 17
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648
    return semilla / 2147483648
  }
  let diferencias = 0
  const ejemplos: string[] = []
  for (let k = 0; k < 200; k++) {
    const n = 1 + Math.floor(azar() * 5)
    // Precios con 2 decimales (los reales) y uno de cada cuatro casos con 6.
    const seis = k % 4 === 0
    const items = Array.from({ length: n }, () => ({
      p: 1 + Math.floor(azar() * 50000),
      q: seis ? Math.floor(azar() * 50_000_000) : Math.floor(azar() * 5000) * 10000,
    }))
    const ivaCent = [0, 800, 1600, 1250][Math.floor(azar() * 4)]
    const esperado = sql(items, ivaCent)
    const lineas = items.map((i) => ({ peso_kg: i.p / 1000, precio_usd_kg: i.q / 1e6 }))
    const sub = subtotalItems(lineas)
    const iva = ivaSobre(sub, ivaCent / 100)
    const obtenido = { sub: Math.round(sub * 1e6), iva: Math.round(iva * 1e6), total: Math.round((sub + iva) * 1e6) }
    if (obtenido.sub !== esperado.sub || obtenido.iva !== esperado.iva || obtenido.total !== esperado.total) {
      diferencias++
      if (ejemplos.length < 3) ejemplos.push(JSON.stringify({ items, ivaCent, esperado, obtenido }))
    }
  }
  verdadero('paridad subtotalItems / ivaSobre con SQL en 200 casos', diferencias === 0, `${diferencias} diferencias: ${ejemplos.join(' | ')}`)
}

// ---------- Opcional: señales de JSON reales de `trazabilidad_factura` ----------
for (const ruta of process.argv.slice(2)) {
  const traza = mapearTrazabilidad(JSON.parse(readFileSync(ruta, 'utf8')))
  if (!traza) continue
  console.log(`\nFactura ${traza.factura.numero} (${ruta}):`)
  for (const tol of [0, 5]) {
    const lineas = traza.lineas.map((l) => ({ l, s: senalesLinea(l, tol) }))
    for (const { l, s } of lineas) {
      const ref = s.precio_referencia_usd_kg == null ? '—' : s.precio_referencia_usd_kg.toFixed(6)
      console.log(
        `  tol ${tol} % · ${l.producto.nombre}: ${l.peso_kg} kg × ${l.precio_usd_kg} (costo ${l.costo_usd_kg}, ref ${ref} ${s.fuente_referencia ?? ''}) → [${s.senales.join(', ')}] {${s.indicadores.join(', ')}}`
      )
    }
    const r = senalFactura(lineas.map((x) => x.s))
    console.log(`  tol ${tol} % · factura: ${r.nivel} ${textoConteoSenales(r.conteo)}`)
  }
}

if (fallas > 0) {
  console.error(`\n${fallas} caso(s) fallaron`)
  process.exit(1)
}
console.log('\nTodos los casos pasaron')
