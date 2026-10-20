/**
 * Pruebas del dominio puro de la edición de compras (19).
 * Sin framework de tests: falla con `process.exit(1)` si algún caso no coincide.
 *
 *   npx tsx scripts/probar-edicion-compra.ts
 *   npx tsx scripts/probar-edicion-compra.ts --sql > paridad.sql
 *
 * Con `--sql` no corre las pruebas: imprime un script SQL con los 200 casos
 * aleatorios de la paridad de `recalcularRepartoProceso`, que compara el
 * resultado TS con `public.procesamiento_repartir_costo` /
 * `procesamiento_div_redondeo` en un Postgres con todas las migraciones
 * (falla con una excepción si alguno difiere).
 *
 * Las cifras del caso del cliente (tarea 21) son las mismas que deja la RPC
 * `editar_compra` en un Postgres local con todas las migraciones.
 */
import { costoUsdKg, subtotalUsd } from '../src/lib/compras/costo'
import {
  costosSalidasRecalculados,
  estadoCompra,
  kgMinimoLinea,
  pagadoTrasEdicion,
  previsualizarEdicionCompra,
  type ValoresEdicionCompra,
} from '../src/lib/compras/edicion'
import { recalcularRepartoProceso, repartirCostoProceso, type SalidaReparto } from '../src/lib/services/costingService'
import { editarCompraSchema } from '../src/lib/compraEdicionValidation'
import type { DetalleCompra, RepartoCosto } from '../src/types/domain'

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

// ---------- Generador determinista (mismo que los scripts de 16/17) ----------
let semilla = 19
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return semilla / 2147483648
}

interface CasoReparto {
  entrada: number
  costo: number
  reparto: RepartoCosto | null
  salidas: SalidaReparto[]
}

function casosAleatorios(n: number): CasoReparto[] {
  // Misma semilla siempre: la corrida normal y `--sql` comparan los mismos casos.
  semilla = 1019
  const casos: CasoReparto[] = []
  for (let k = 0; k < n; k++) {
    const ns = 1 + Math.floor(azar() * 5)
    const salidas = Array.from({ length: ns }, () => ({
      kg: (1 + Math.floor(azar() * 9000)) / 1000,
      // Uno de cada cinco sin precio (salida única o legado).
      precio: azar() < 0.2 ? null : Math.floor(azar() * 40_000_000) / 1e6,
    }))
    const suma = salidas.reduce((s, x) => s + x.kg, 0)
    casos.push({
      entrada: Math.round((suma + azar() * 5) * 1000) / 1000,
      costo: Math.floor(azar() * 20_000_000) / 1e6,
      reparto: (['valor', 'peso', null] as const)[Math.floor(azar() * 3)],
      salidas,
    })
  }
  return casos
}

// ---------- Espejo BigInt de las funciones SQL (procesamiento_* de 16) ----------
const big = (n: number, dec: number) => BigInt(n.toFixed(dec).replace('.', ''))
const divRedondeoSql = (a: bigint, b: bigint) => (BigInt(2) * a + b) / (BigInt(2) * b)
function sqlRecalcular(c: CasoReparto): number[] {
  const kgsMil = c.salidas.map((s) => big(s.kg, 3))
  const precios = c.salidas.map((s) => big(s.precio ?? 0, 6))
  const sumaValor = kgsMil.reduce((s, k, i) => s + k * precios[i], BigInt(0))
  const pesos = (c.reparto ?? 'peso') === 'valor' && c.salidas.length >= 2 && sumaValor > BigInt(0)
    ? kgsMil.map((k, i) => k * precios[i])
    : kgsMil
  // round(entrada × costo, 6) en micro-USD
  const totalMicro = divRedondeoSql(big(c.entrada, 3) * big(c.costo, 6), BigInt(1000))
  let suma = BigInt(0)
  let max = 0
  pesos.forEach((w, i) => {
    suma += w
    if (w > pesos[max]) max = i
  })
  const res = pesos.map((w) => divRedondeoSql(totalMicro * w, suma))
  res[max] += totalMicro - res.reduce((s, x) => s + x, BigInt(0))
  return res.map((c2, i) => Number(divRedondeoSql(c2 * BigInt(1000), kgsMil[i])) / 1e6)
}

if (process.argv.includes('--sql')) {
  const casos = casosAleatorios(200)
  const lineas: string[] = ['-- Paridad TS ↔ SQL de recalcularRepartoProceso (19), generado por probar-edicion-compra.ts', 'do $$', 'declare v numeric[]; begin']
  casos.forEach((c, k) => {
    const ts = recalcularRepartoProceso(c.salidas, c.entrada, c.costo, c.reparto).salidas.map((s) => s.costo_usd_kg)
    const kgsMil = c.salidas.map((s) => `round(${s.kg.toFixed(3)} * 1000)`)
    const valor = c.salidas.map((s) => `round(${s.kg.toFixed(3)} * 1000) * round(${(s.precio ?? 0).toFixed(6)} * 1000000)`)
    const sumaValor = c.salidas.reduce((s, x) => s + x.kg * (x.precio ?? 0), 0)
    const usaValor = (c.reparto ?? 'peso') === 'valor' && c.salidas.length >= 2 && sumaValor > 0
    lineas.push(
      `  v := public.procesamiento_repartir_costo(round(round(${c.entrada.toFixed(3)} * ${c.costo.toFixed(6)}, 6) * 1000000), array[${(usaValor ? valor : kgsMil).join(', ')}]::numeric[]);`,
      `  if array[${c.salidas
        .map((s, i) => `public.procesamiento_div_redondeo(v[${i + 1}] * 1000, round(${s.kg.toFixed(3)} * 1000)) / 1000000`)
        .join(', ')}]::numeric[] <> array[${ts.map((x) => x.toFixed(6)).join(', ')}]::numeric[] then raise exception 'caso ${k} difiere'; end if;`
    )
  })
  lineas.push("  raise notice 'paridad SQL: 200 casos iguales';", 'end $$;')
  console.log(lineas.join('\n'))
  process.exit(0)
}

// ---------- Costo pactado ↔ USD ----------
igual('Bs 182,50 a 36,50 → $5', costoUsdKg(182.5, 'bs', 36.5), 5)
igual('Bs 219,00 a 36,50 → $6', costoUsdKg(219, 'bs', 36.5), 6)
igual('Bs 219,00 a 43,80 → $5 (cambio de tasa)', costoUsdKg(219, 'bs', 43.8), 5)
igual('Bs 3.500 a 36,50 → 95,890411', costoUsdKg(3500, 'bs', 36.5), 95.890411)
igual('USD 4,5 → 4,5 (la tasa no importa)', costoUsdKg(4.5, 'usd', 99), 4.5)
igual('subtotal 12 kg × $5', subtotalUsd([{ peso_kg: 12, costo_usd_kg: 5 }]), 60)
{
  // Relleno de 20261019120000: round(usd × tasa, 2) recupera el pactado de 2 decimales.
  let diferencias = 0
  for (let k = 0; k < 500; k++) {
    const pactado = Math.floor(azar() * 1_000_000) / 100
    const tasa = Math.floor((20 + azar() * 600) * 100) / 100
    const usd = costoUsdKg(pactado, 'bs', tasa)
    if (Math.round(usd * tasa * 100) / 100 !== pactado) diferencias++
  }
  verdadero('relleno Bs: round(usd × tasa, 2) recupera el pactado en 500 casos', diferencias === 0, `${diferencias} diferencias`)
}

// ---------- Reparto recalculado (caso de 16) ----------
{
  const salidas: SalidaReparto[] = [
    { kg: 6, precio: 12 },
    { kg: 1, precio: 2 },
    { kg: 0.5, precio: 1 },
  ]
  const a5 = recalcularRepartoProceso(salidas, 10, 5, 'valor')
  const original = repartirCostoProceso({ pesoEntradaKg: 10, costoLoteUsdKg: 5, salidas })
  igual('reparto a $5 = el de 16', a5.salidas.map((s) => s.costo_usd_kg), [8.053691, 1.342282, 0.67114])
  igual('paridad con repartirCostoProceso', a5, original)
  const a6 = recalcularRepartoProceso(salidas, 10, 6, 'valor')
  igual('lote de $5 → $6: costo total 60', a6.costo_total_usd, 60)
  igual('lote de $5 → $6: 9,664430 / 1,610738 / 0,805370', a6.salidas.map((s) => s.costo_usd_kg), [9.66443, 1.610738, 0.80537])
  igual('Σ costos = total', Math.round(a6.salidas.reduce((s, x) => s + x.costo_usd, 0) * 1e6) / 1e6, 60)
  const porPeso = recalcularRepartoProceso(salidas, 10, 6, 'peso')
  igual('reparto guardado por peso se respeta (legado con precios)', porPeso.reparto, 'peso')
  igual('legado sin reparto → por peso', recalcularRepartoProceso(salidas, 10, 6, null).reparto, 'peso')
  igual('valor con Σ precio 0 → por peso', recalcularRepartoProceso([{ kg: 2, precio: 0 }, { kg: 1, precio: 0 }], 4, 3, 'valor').reparto, 'peso')
}

// ---------- Pagado y estado (D1–D3) ----------
igual('D1 contado que sube: pagado = total', pagadoTrasEdicion('contado', 0, 70), 70)
igual('D1 contado con pagos por encima: pagado = pagos (saldo a favor)', pagadoTrasEdicion('contado', 80, 70), 80)
igual('D2 crédito → contado con $20 pagados: pagado = total', pagadoTrasEdicion('contado', 20, 30), 30)
igual('D3 contado → crédito sin pagos: pagado 0', pagadoTrasEdicion('credito', 0, 50), 0)
igual('crédito con $60 pagados baja a $50: pagado 60', pagadoTrasEdicion('credito', 60, 50), 60)
igual('estado: 60 pagado sobre 50 → pagada', estadoCompra(50, 60), 'pagada')
igual('estado: 0 pagado sobre 50 → abierta', estadoCompra(50, 0), 'abierta')
igual('estado: crédito con total 0 → pagada', estadoCompra(0, 0), 'pagada')

// ---------- Kg mínimo por consumo ----------
igual('kg mínimo: 12 inicial, 2 en stock → 10', kgMinimoLinea({ peso_inicial_kg: 12, stock_kg: 2 }), 10)
igual('kg mínimo sin lote → 0', kgMinimoLinea(null), 0)
igual('kg mínimo sin consumo → 0', kgMinimoLinea({ peso_inicial_kg: 5, stock_kg: 5 }), 0)

// ---------- Vista previa: caso del cliente (tarea 21) ----------
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const ventas = (kg: number, lineas = 1, facturas = 1) => ({ kg, lineas, facturas })
function detalleCliente(): DetalleCompra {
  return {
    compra: {
      id: ID(1),
      fecha: '2026-10-05',
      condicion: 'credito',
      moneda: 'bs',
      tasa_snapshot: 36.5,
      tasa_origen: 'referencial',
      tasa_fuente: 'bcv',
      tasa_referencial: 36.5,
      subtotal_usd: 50,
      pagado_usd: 20,
      estado: 'abierta',
      notas: null,
      created_at: '2026-10-05T12:00:00Z',
      proveedor: { id: ID(90), nombre: 'Pesquera X', rif_ci: 'J-1', activo: true, bloqueado: false, motivo_bloqueo: null },
    },
    pagos_registrados_usd: 20,
    primera_salida: '2026-10-06',
    ventas_arbol: { lineas: 1, facturas: 1 },
    lineas: [
      {
        id: ID(2),
        producto: { id: ID(3), nombre: 'Salmón entero', codigo: 'SALM', controla_stock: true },
        peso_kg: 10,
        costo_kg_pactado: 182.5,
        costo_usd_kg: 5,
        lote: {
          id: ID(4),
          codigo: 'SALM-261005-1',
          estado: 'agotado',
          fecha_ingreso: '2026-10-05',
          peso_inicial_kg: 10,
          costo_usd_kg: 5,
          stock_kg: 0,
          kg_procesados: 10,
          kg_vendidos: 0,
          kg_perdidos: 0,
          primera_salida: '2026-10-06',
          ventas: ventas(0, 0, 0),
          procesamientos: [
            {
              id: ID(5),
              fecha: '2026-10-06',
              legado: false,
              peso_entrada_kg: 10,
              costo_total_usd: 50,
              reparto_costo: 'valor',
              salidas: [
                { proceso_item_id: ID(6), producto_id: ID(7), producto_nombre: 'Filete', peso_entrada_kg: 8, peso_salida_kg: 6, precio_referencia_usd_kg: 12, costo_total_usd: 48.322147,
                  lote: { id: ID(8), codigo: 'FILE-261006-1', estado: 'abierto', peso_inicial_kg: 6, stock_kg: 4, costo_usd_kg: 8.053691, ventas: ventas(2) } },
                { proceso_item_id: ID(9), producto_id: ID(10), producto_nombre: 'Cabeza', peso_entrada_kg: 1.333, peso_salida_kg: 1, precio_referencia_usd_kg: 2, costo_total_usd: 1.342282,
                  lote: { id: ID(11), codigo: 'CABE-261006-1', estado: 'abierto', peso_inicial_kg: 1, stock_kg: 1, costo_usd_kg: 1.342282, ventas: ventas(0, 0, 0) } },
                { proceso_item_id: ID(12), producto_id: ID(13), producto_nombre: 'Piel', peso_entrada_kg: 0.667, peso_salida_kg: 0.5, precio_referencia_usd_kg: 1, costo_total_usd: 0.33557,
                  lote: { id: ID(14), codigo: 'PIEL-261006-1', estado: 'abierto', peso_inicial_kg: 0.5, stock_kg: 0.5, costo_usd_kg: 0.67114, ventas: ventas(0, 0, 0) } },
              ],
            },
          ],
        },
      },
    ],
    pagos: [],
    contrato: { id: ID(20), numero: 7, estado: 'firmado', created_at: '2026-10-05T13:00:00Z', desactualizado: false },
    correcciones: [],
  }
}
function valores(d: DetalleCompra, over: Partial<ValoresEdicionCompra> = {}, items: Record<string, { peso_kg?: number | null; costo_kg?: number | null }> = {}): ValoresEdicionCompra {
  return {
    proveedor_id: d.compra.proveedor.id,
    fecha: d.compra.fecha,
    condicion: d.compra.condicion,
    moneda: d.compra.moneda,
    notas: d.compra.notas ?? '',
    cambiar_tasa: false,
    tasa_origen: d.compra.tasa_origen,
    tasa_fuente: d.compra.tasa_fuente,
    tasa: d.compra.tasa_snapshot,
    items: d.lineas.map((l) => ({
      compra_item_id: l.id,
      peso_kg: items[l.id]?.peso_kg !== undefined ? (items[l.id].peso_kg as number | null) : l.peso_kg,
      costo_kg: items[l.id]?.costo_kg !== undefined ? (items[l.id].costo_kg as number | null) : l.costo_kg_pactado,
    })),
    ...over,
  }
}
{
  const d = detalleCliente()
  const sin = previsualizarEdicionCompra(d, valores(d))
  verdadero('sin cambios → sin_cambios y sin avisos', sin.sin_cambios && sin.avisos.length === 0)

  const v = previsualizarEdicionCompra(d, valores(d, {}, { [ID(2)]: { costo_kg: 219 } }))
  igual('C21 costo USD/kg 5 → 6', [v.lineas[0].costo_antes_usd_kg, v.lineas[0].costo_despues_usd_kg], [5, 6])
  igual('C21 hijos 9,664430 / 1,610738 / 0,805370', v.hijos.map((h) => h.costo_despues_usd_kg), [9.66443, 1.610738, 0.80537])
  igual('C21 total 50 → 60, pagado 20, saldo 40, abierta', [v.despues.total_usd, v.despues.pagado_usd, v.despues.saldo_usd, v.despues.estado], [60, 20, 40, 'abierta'])
  igual('C21 costo de lo vendido 2 × 8,053691 → 2 × 9,664430', [v.costo_vendido.antes_usd, v.costo_vendido.despues_usd], [16.107382, 19.32886])
  verdadero('C21 aviso de contrato desactualizado', v.avisos.some((a) => a.tipo === 'contrato' && a.mensaje.includes('N.º 0007')))
  verdadero('C21 aviso de pagos registrados', v.avisos.some((a) => a.tipo === 'pagos'))

  const t = previsualizarEdicionCompra(d, valores(d, { cambiar_tasa: true, tasa_origen: 'manual', tasa: 43.8 }, { [ID(2)]: { costo_kg: 182.5 } }))
  igual('C21 tasa 36,50 → 43,80: costo 5 → 4,166667', t.lineas[0].costo_despues_usd_kg, 4.166667)
  verdadero('C21 tasa en Bs: aviso tasa_bs y ganancia cambiaria', t.avisos.some((a) => a.tipo === 'tasa_bs') && t.avisos.some((a) => a.tipo === 'ganancia_cambiaria'))

  const k = previsualizarEdicionCompra(d, valores(d, {}, { [ID(2)]: { peso_kg: 12 } }))
  igual('C21 kg 10 → 12: delta +2, reabre (agotado)', [k.lineas[0].delta_kg, k.lineas[0].reabre], [2, true])
  verdadero('C21 aviso de reapertura (D7)', k.avisos.some((a) => a.tipo === 'reabre_lote'))
  const b = previsualizarEdicionCompra(d, valores(d, {}, { [ID(2)]: { peso_kg: 9.5 } }))
  verdadero('C21 kg 10 → 9,5 con 10 consumidos → bajo mínimo', b.bajo_minimo && b.lineas[0].minimo_kg === 10)

  const usd = previsualizarEdicionCompra(d, valores(d, { moneda: 'usd' }))
  igual('D6 Bs → USD conserva el número: 182,50 USD', usd.lineas[0].costo_despues_usd_kg, 182.5)
  verdadero('D6 aviso de moneda', usd.avisos.some((a) => a.tipo === 'moneda'))

  const contado = previsualizarEdicionCompra(d, valores(d, { condicion: 'contado' }))
  igual('D2 crédito → contado: pagado = total, pagada', [contado.despues.pagado_usd, contado.despues.estado], [50, 'pagada'])
  verdadero('D2 aviso de condición', contado.avisos.some((a) => a.tipo === 'condicion_a_contado'))

  const prov = previsualizarEdicionCompra(d, valores(d, { proveedor_id: ID(91), proveedor_nombre: 'Pesquera Y' }))
  verdadero('D4 aviso de proveedor con el árbol', prov.avisos.some((a) => a.tipo === 'proveedor' && a.mensaje.includes('3 lotes procesados')))
  verdadero('D4 contrato nombra al anterior', prov.avisos.some((a) => a.tipo === 'contrato' && a.mensaje.includes('Pesquera X')))

  // Saldo a favor: crédito con 60 pagados que baja a 50.
  const pagada = { ...detalleCliente(), pagos_registrados_usd: 60 }
  pagada.compra = { ...pagada.compra, subtotal_usd: 60, pagado_usd: 60, estado: 'pagada' }
  pagada.lineas = [{ ...pagada.lineas[0], peso_kg: 12, costo_kg_pactado: 182.5, costo_usd_kg: 5 }]
  const f = previsualizarEdicionCompra(pagada, valores(pagada, {}, { [ID(2)]: { peso_kg: 10 } }))
  igual('saldo a favor 10, pagada', [f.despues.saldo_a_favor_usd, f.despues.estado], [10, 'pagada'])
  verdadero('aviso de saldo a favor', f.avisos.some((a) => a.tipo === 'saldo_a_favor'))
}

// ---------- Costo de lo vendido con una línea repartida en dos lotes ----------
{
  // Venta de 20 kg: 12 del lote 1 de esta compra (3 → 3,2) y 4 del lote 2
  // (3,5 → 3,6); los otros 4 kg son de otra compra y no cambian.
  const d = detalleCliente()
  d.compra = { ...d.compra, moneda: 'usd', tasa_snapshot: 38, condicion: 'contado', subtotal_usd: 74, pagado_usd: 74, estado: 'pagada' }
  d.pagos_registrados_usd = 0
  d.contrato = null
  d.ventas_arbol = { lineas: 1, facturas: 1 }
  const lote = (id: number, codigo: string, costo: number, kg: number, vend: number) => ({
    id: ID(id), codigo, estado: 'abierto' as const, fecha_ingreso: '2026-10-08', peso_inicial_kg: kg, costo_usd_kg: costo, stock_kg: kg - vend,
    kg_procesados: 0, kg_vendidos: vend, kg_perdidos: 0, primera_salida: '2026-10-11', ventas: ventas(vend), procesamientos: [],
  })
  d.lineas = [
    { id: ID(30), producto: { id: ID(31), nombre: 'Merluza', codigo: 'MERL', controla_stock: true }, peso_kg: 20, costo_kg_pactado: 3, costo_usd_kg: 3, lote: lote(32, 'MERL-1', 3, 20, 12) },
    { id: ID(33), producto: { id: ID(31), nombre: 'Merluza', codigo: 'MERL', controla_stock: true }, peso_kg: 4, costo_kg_pactado: 3.5, costo_usd_kg: 3.5, lote: lote(34, 'MERL-2', 3.5, 4, 4) },
  ]
  const v = previsualizarEdicionCompra(d, valores(d, {}, { [ID(30)]: { costo_kg: 3.2 }, [ID(33)]: { costo_kg: 3.6 } }))
  igual('vendido 12 × 3 + 4 × 3,5 → 12 × 3,2 + 4 × 3,6', [v.costo_vendido.antes_usd, v.costo_vendido.despues_usd], [50, 52.8])
  igual('una línea, una factura (sin contar dos veces)', [v.costo_vendido.lineas, v.costo_vendido.facturas], [1, 1])
  igual('D1 contado que sube: pagado = total = 78,4', [v.despues.total_usd, v.despues.pagado_usd, v.despues.estado], [78.4, 78.4, 'pagada'])
}

// ---------- Legado sin cabecera ----------
igual(
  'legado: cada salida al 100 % de su entrada (4 kg × $6 / 3 kg)',
  costosSalidasRecalculados(
    { id: 'p', fecha: '2026-10-15', legado: true, peso_entrada_kg: 4, costo_total_usd: null, reparto_costo: null,
      salidas: [{ proceso_item_id: 'x', producto_id: 'y', producto_nombre: 'Filete', peso_entrada_kg: 4, peso_salida_kg: 3, precio_referencia_usd_kg: null, costo_total_usd: 20, lote: null }] },
    6
  ),
  [8]
)

// ---------- Esquema ----------
{
  const base = {
    compra_id: ID(1), proveedor_id: ID(90), fecha: '2026-10-05', condicion: 'credito', moneda: 'bs', notas: '',
    cambiar_tasa: false, tasa_origen: 'referencial', tasa_fuente: 'bcv', tasa: null,
    items: [{ compra_item_id: ID(2), peso_kg: 10, costo_kg: 219 }],
    motivo: '  costo mal capturado ',
  }
  const ok = editarCompraSchema.safeParse(base)
  igual('esquema: válido sin tasa y motivo con trim', ok.success ? ok.data.motivo : null, 'costo mal capturado')
  verdadero('esquema: cambiar_tasa exige la tasa', !editarCompraSchema.safeParse({ ...base, cambiar_tasa: true }).success)
  verdadero('esquema: motivo corto', !editarCompraSchema.safeParse({ ...base, motivo: 'abc' }).success)
  verdadero('esquema: peso 0', !editarCompraSchema.safeParse({ ...base, items: [{ compra_item_id: ID(2), peso_kg: 0, costo_kg: 1 }] }).success)
  verdadero('esquema: costo negativo', !editarCompraSchema.safeParse({ ...base, items: [{ compra_item_id: ID(2), peso_kg: 1, costo_kg: -1 }] }).success)
  verdadero('esquema: sin líneas', !editarCompraSchema.safeParse({ ...base, items: [] }).success)
}

// ---------- Paridad TS ↔ SQL de recalcularRepartoProceso (200 casos) ----------
{
  let diferencias = 0
  const ejemplos: string[] = []
  for (const c of casosAleatorios(200)) {
    const ts = recalcularRepartoProceso(c.salidas, c.entrada, c.costo, c.reparto).salidas.map((s) => s.costo_usd_kg)
    const sql = sqlRecalcular(c)
    if (JSON.stringify(ts) !== JSON.stringify(sql)) {
      diferencias++
      if (ejemplos.length < 3) ejemplos.push(JSON.stringify({ c, ts, sql }))
    }
  }
  verdadero('paridad recalcularRepartoProceso con la fórmula SQL en 200 casos', diferencias === 0, `${diferencias} diferencias: ${ejemplos.join(' | ')}`)
}

if (fallas > 0) {
  console.log(`\n${fallas} caso(s) fallaron`)
  process.exit(1)
}
console.log('\nTodos los casos pasaron')
