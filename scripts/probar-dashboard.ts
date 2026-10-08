/**
 * Pruebas del dominio puro del dashboard (15). Sin framework de tests: falla
 * con `process.exit(1)` si algún caso no coincide.
 *
 *   npx tsx scripts/probar-dashboard.ts
 */
import {
  granularidadSpread,
  inicioSemana,
  mesesVentas,
  periodosDelRango,
  presetDeRango,
  rangoDesdePreset,
} from '../src/lib/dashboard/rangos'
import {
  flujoAcumulado,
  mezclaDesdeFilas,
  ordenarTramosAging,
  paretoAcumulado,
  rellenarSerie,
  topConResto,
} from '../src/lib/dashboard/series'
import { diasFlujoDesdeParam, rangoDesdeParams } from '../src/lib/dashboardValidation'

let fallas = 0

function igual<T>(nombre: string, obtenido: T, esperado: T) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  console.log(
    `${ok ? 'OK  ' : 'FALLA'} ${nombre}${ok ? '' : ` → obtenido ${JSON.stringify(obtenido)}, esperado ${JSON.stringify(esperado)}`}`
  )
  if (!ok) fallas++
}

// ---------- Presets ----------
igual('mes en curso el día 1', rangoDesdePreset('mes_en_curso', '2026-10-01'), {
  desde: '2026-10-01',
  hasta: '2026-10-01',
})
igual('mes en curso a mitad de mes', rangoDesdePreset('mes_en_curso', '2026-10-08'), {
  desde: '2026-10-01',
  hasta: '2026-10-08',
})
igual('mes anterior en enero', rangoDesdePreset('mes_anterior', '2026-01-15'), {
  desde: '2025-12-01',
  hasta: '2025-12-31',
})
igual('mes anterior en marzo (febrero no bisiesto)', rangoDesdePreset('mes_anterior', '2026-03-31'), {
  desde: '2026-02-01',
  hasta: '2026-02-28',
})
igual('año en curso', rangoDesdePreset('anio_en_curso', '2026-10-08'), {
  desde: '2026-01-01',
  hasta: '2026-10-08',
})
igual('últimos 7 días', rangoDesdePreset('ultimos_7', '2026-03-03'), {
  desde: '2026-02-25',
  hasta: '2026-03-03',
})
igual('últimos 90 días', rangoDesdePreset('ultimos_90', '2026-10-08'), {
  desde: '2026-07-11',
  hasta: '2026-10-08',
})
igual('hoy', rangoDesdePreset('hoy', '2026-10-08'), { desde: '2026-10-08', hasta: '2026-10-08' })
igual('preset detectado', presetDeRango({ desde: '2026-10-01', hasta: '2026-10-08' }, '2026-10-08'), 'mes_en_curso')
igual('rango personalizado', presetDeRango({ desde: '2026-09-03', hasta: '2026-10-08' }, '2026-10-08'), 'personalizado')

// ---------- Granularidad y meses ----------
igual('spread semanal con 120 días', granularidadSpread({ desde: '2026-01-01', hasta: '2026-05-01' }), 'semana')
igual('spread mensual con 121 días', granularidadSpread({ desde: '2026-01-01', hasta: '2026-05-02' }), 'mes')
igual('lunes de la semana ISO (domingo)', inicioSemana('2026-10-11'), '2026-10-05')
igual('lunes de la semana ISO (lunes)', inicioSemana('2026-10-05'), '2026-10-05')
const meses = mesesVentas('2026-02-14')
igual('12 meses hasta febrero', [meses.length, meses[0], meses[11]], [12, '2025-03-01', '2026-02-01'])
igual(
  'semanas del rango',
  periodosDelRango({ desde: '2026-10-01', hasta: '2026-10-14' }, 'semana'),
  ['2026-09-28', '2026-10-05', '2026-10-12']
)

// ---------- Relleno de serie ----------
igual(
  'relleno con ceros',
  rellenarSerie(
    ['2026-08-01', '2026-09-01', '2026-10-01'],
    [{ mes: '2026-09-01', usd: 5 }],
    (f) => f.mes,
    (mes) => ({ mes, usd: 0 })
  ),
  [
    { mes: '2026-08-01', usd: 0 },
    { mes: '2026-09-01', usd: 5 },
    { mes: '2026-10-01', usd: 0 },
  ]
)

// ---------- Pareto ----------
const pareto = paretoAcumulado(
  [
    { cliente_id: 'a', cliente_nombre: 'A', ventas_usd: 50, facturas: 3 },
    { cliente_id: 'b', cliente_nombre: 'B', ventas_usd: 30, facturas: 2 },
    { cliente_id: 'c', cliente_nombre: 'C', ventas_usd: 10, facturas: 1 },
  ],
  100,
  5
)
igual('Pareto: corte exacto en 80 %', pareto.indice_corte_80, 1)
igual('Pareto: dentro del 80 %', pareto.clientes.map((c) => c.dentro_80), [true, true, false, false])
igual(
  'Pareto: resto y acumulado',
  pareto.clientes.map((c) => [c.cliente_nombre, Math.round(c.pct_acumulado * 100)]),
  [
    ['A', 50],
    ['B', 80],
    ['C', 90],
    ['Resto', 100],
  ]
)
const paretoResto = paretoAcumulado(
  [{ cliente_id: 'a', cliente_nombre: 'A', ventas_usd: 40, facturas: 1 }],
  100,
  9
)
igual('Pareto: el corte cae en el resto', paretoResto.indice_corte_80, 1)
igual('Pareto sin ventas', paretoAcumulado([], 0, 0).indice_corte_80, null)

// ---------- Aging ----------
igual(
  'aging en orden fijo y huecos en 0',
  ordenarTramosAging([
    { tramo: '>30', orden: 4, saldo_usd: 10, facturas: 1 },
    { tramo: 'por_vencer', orden: 1, saldo_usd: 5, facturas: 2 },
  ]).map((t) => [t.tramo, t.saldo_usd]),
  [
    ['por_vencer', 5],
    ['1-15', 0],
    ['16-30', 0],
    ['>30', 10],
  ]
)

// ---------- Flujo ----------
const flujo = flujoAcumulado(
  [
    { tipo: 'vencido', fecha: null, cobros_usd: 89.2, pagos_usd: 90 },
    { tipo: 'dia', fecha: '2026-10-09', cobros_usd: 0, pagos_usd: 30 },
    { tipo: 'dia', fecha: '2026-10-08', cobros_usd: 100, pagos_usd: 0 },
  ],
  7
)
igual('flujo: acumulado ordenado por fecha', flujo.serie.map((d) => d.acumulado_usd), [100, 70])
igual('flujo: vencido aparte', [flujo.vencido_cobros_usd, flujo.vencido_pagos_usd], [89.2, 90])

// ---------- Mezcla y ticket ----------
const mezcla = mezclaDesdeFilas([
  { grupo: 'total', clave: 'ventas', usd: 216, cantidad: 2, kg: 28 },
  { grupo: 'condicion', clave: 'contado', usd: 120, cantidad: 1, kg: 20 },
  { grupo: 'condicion', clave: 'credito', usd: 96, cantidad: 1, kg: 8 },
  { grupo: 'metodo', clave: 'zelle', usd: 30, cantidad: 1, kg: null },
])
igual('ticket promedio', [mezcla.ticket_promedio_usd, mezcla.kg_por_factura], [108, 14])
igual('contado vs crédito %', mezcla.condicion.map((c) => [c.clave, c.pct]), [
  ['contado', 120 / 216],
  ['credito', 96 / 216],
])

// ---------- Top + resto ----------
const productos = Array.from({ length: 12 }, (_, i) => ({
  producto_id: `p${i}`,
  producto_nombre: `P${i}`,
  lotes: 1,
  stock_kg: 1,
  valor_usd: 12 - i,
  valor_bs: (12 - i) * 40,
}))
const top = topConResto(productos, 10)
igual('top 10 + resto', [top.length, top[10].producto_nombre, top[10].valor_usd, top[10].valor_bs], [11, 'Resto (2)', 3, 120])

// ---------- Validación ----------
const HOY = '2026-10-08'
igual('rango válido', rangoDesdeParams({ desde: '2026-09-01', hasta: '2026-09-30' }, HOY), {
  rango: { desde: '2026-09-01', hasta: '2026-09-30' },
  valido: true,
})
igual('sin params → mes en curso', rangoDesdeParams({}, HOY).rango, { desde: '2026-10-01', hasta: HOY })
igual('desde > hasta → default', rangoDesdeParams({ desde: '2026-10-05', hasta: '2026-10-01' }, HOY).valido, false)
igual('fecha imposible → default', rangoDesdeParams({ desde: '2026-02-30', hasta: '2026-03-01' }, HOY).valido, false)
igual('formato inválido → default', rangoDesdeParams({ desde: '01/10/2026', hasta: HOY }, HOY).valido, false)
igual('731 días → válido', rangoDesdeParams({ desde: '2024-10-08', hasta: '2026-10-08' }, HOY).valido, true)
igual('732 días → default', rangoDesdeParams({ desde: '2024-10-07', hasta: '2026-10-08' }, HOY).valido, false)
igual('flujo 30', diasFlujoDesdeParam('30'), 30)
igual('flujo inválido → 7', diasFlujoDesdeParam('10'), 7)

if (fallas > 0) {
  console.error(`\n${fallas} caso(s) fallaron`)
  process.exit(1)
}
console.log('\nTodo OK')
