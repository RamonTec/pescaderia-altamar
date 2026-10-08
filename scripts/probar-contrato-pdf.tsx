/**
 * Pruebas de los contratos en PDF (06-contratos). Sin framework de tests:
 * falla con `process.exit(1)` si algún caso no coincide.
 *
 *   node --require @react-pdf/renderer --import tsx scripts/probar-contrato-pdf.tsx
 *
 * El `--require` precarga `@react-pdf/renderer` (ESM-only) con el
 * `require(esm)` nativo de Node antes de que tsx registre su hook CJS, que
 * resuelve mal los imports internos del paquete (`ERR_PACKAGE_PATH_NOT_EXPORTED`
 * en `@react-pdf/hyphenate/en-us`). Ver tasks.md › Resultado de la evaluación.
 *
 * - Casos de `describirTasa` y `referenciaDocumento` (tarea 7).
 * - Dos PDFs de muestra (tarea 10): venta a persona jurídica con 2
 *   representantes, tasa manual y 30 items (salto de página); compra con tasa
 *   referencial. Se escriben en un directorio temporal.
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatosContratoPdf } from '../src/types/domain'
import { describirTasa, nombreArchivoContrato, referenciaDocumento } from '../src/lib/contratos/textos'
import { CLAUSULA_GANANCIA_CAMBIARIA, textoClausulaGananciaCambiaria } from '../src/lib/contratos/clausulas'
import { reactPdfContratoRenderer } from '../src/lib/services/contratoPdfService'

let fallas = 0

function igual<T>(nombre: string, obtenido: T, esperado: T) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado)
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}${ok ? '' : ` → obtenido ${JSON.stringify(obtenido)}, esperado ${JSON.stringify(esperado)}`}`)
  if (!ok) fallas++
}

// ---------- describirTasa ----------
igual(
  'tasa referencial BCV',
  describirTasa({ tasa_origen: 'referencial', tasa_fuente: 'bcv', tasa_referencial: 40, tasa_snapshot: 40 }),
  'Tasa referencial BCV vigente a la fecha del documento'
)
igual(
  'tasa referencial paralela',
  describirTasa({ tasa_origen: 'referencial', tasa_fuente: 'paralela', tasa_referencial: 55, tasa_snapshot: 55 }),
  'Tasa referencial paralela vigente a la fecha del documento'
)
igual(
  'tasa manual con referencial',
  describirTasa({ tasa_origen: 'manual', tasa_fuente: 'bcv', tasa_referencial: 40.5, tasa_snapshot: 42 }),
  'Tasa acordada entre las partes (referencial vigente: 40,500000)'
)
igual(
  'tasa manual sin referencial',
  describirTasa({ tasa_origen: 'manual', tasa_fuente: null, tasa_referencial: null, tasa_snapshot: 42 }),
  'Tasa acordada entre las partes'
)
igual('nombre de archivo', nombreArchivoContrato(7), 'contrato-0007.pdf')
igual(
  'cláusula parametrizada solo con la tasa',
  textoClausulaGananciaCambiaria(40).replace('40,000000', '{TASA}'),
  CLAUSULA_GANANCIA_CAMBIARIA
)

// ---------- Datos de muestra ----------
const NEGOCIO: DatosContratoPdf['negocio'] = {
  nombre_comercial: 'Altamar Sea Food',
  razon_social: 'Inversiones Altamar Sea Food, C.A.',
  rif: 'J-50123456-7',
  direccion: 'Av. Principal de Boca de Río, local 3, Isla de Margarita, Nueva Esparta',
  telefono: '0295-2911234',
}

const items = Array.from({ length: 30 }, (_, i) => {
  const peso_kg = 5 + i * 1.25
  const precio_usd_kg = 6.5 + (i % 5)
  return {
    codigo: `P-${String(i + 1).padStart(3, '0')}`,
    producto: ['Pargo rojo entero', 'Filete de mero', 'Camarón 31/35', 'Calamar limpio', 'Atún en lomo'][i % 5],
    peso_kg,
    precio_usd_kg,
    subtotal_usd: Math.round(peso_kg * precio_usd_kg * 100) / 100,
  }
})
const subtotalVenta = items.reduce((s, i) => s + i.subtotal_usd, 0)
const ivaVenta = Math.round(subtotalVenta * 0.16 * 100) / 100
const totalVenta = subtotalVenta + ivaVenta

const VENTA: DatosContratoPdf = {
  tipo: 'venta_credito',
  numero: 7,
  fecha_emision: '2026-10-07',
  dias_credito: 45,
  fecha_vencimiento: '2026-11-20',
  notas: 'Entrega en el local del cliente. Abonos por Pago Móvil o transferencia.',
  negocio: NEGOCIO,
  contraparte: {
    nombre: 'Restaurante El Muelle, C.A.',
    tipo_persona: 'juridica',
    rif_ci: 'J-40987654-3',
    direccion: 'Calle La Marina, Pampatar',
    telefono: '0414-1234567',
    representantes: [
      { nombre: 'María Pérez', cedula: 'V-12345678', cargo: 'Directora' },
      { nombre: 'José Rodríguez', cedula: 'V-14567890', cargo: 'Gerente general' },
    ],
  },
  documento: { numero: 'F-000123', fecha: '2026-10-06', referencia: 'a1b2c3d4', moneda: null },
  items,
  totales: {
    subtotal_usd: subtotalVenta,
    iva_pct: 16,
    iva_usd: ivaVenta,
    total_usd: totalVenta,
    pagado_usd: 200,
    creditos_usd: 35.5,
    saldo_usd: totalVenta - 200 - 35.5,
  },
  tasa: { tasa_origen: 'manual', tasa_fuente: 'bcv', tasa_referencial: 40.5, tasa_snapshot: 42 },
}

const COMPRA: DatosContratoPdf = {
  tipo: 'compra_credito',
  numero: 8,
  fecha_emision: '2026-10-07',
  dias_credito: 15,
  fecha_vencimiento: '2026-10-20',
  notas: null,
  negocio: NEGOCIO,
  contraparte: {
    nombre: 'Pedro González',
    tipo_persona: 'natural',
    rif_ci: 'V-9876543',
    direccion: null,
    telefono: null,
    representantes: [],
  },
  documento: { numero: null, fecha: '2026-10-05', referencia: '9f8e7d6c', moneda: 'bs' },
  items: items.slice(0, 3).map((i) => ({ ...i, precio_usd_kg: 4, subtotal_usd: Math.round(i.peso_kg * 4 * 100) / 100 })),
  totales: {
    subtotal_usd: 0,
    iva_pct: null,
    iva_usd: null,
    total_usd: 0,
    pagado_usd: 10,
    creditos_usd: 0,
    saldo_usd: 0,
  },
  tasa: { tasa_origen: 'referencial', tasa_fuente: 'bcv', tasa_referencial: 40.25, tasa_snapshot: 40.25 },
}
COMPRA.totales.subtotal_usd = COMPRA.items.reduce((s, i) => s + i.subtotal_usd, 0)
COMPRA.totales.total_usd = COMPRA.totales.subtotal_usd
COMPRA.totales.saldo_usd = COMPRA.totales.total_usd - COMPRA.totales.pagado_usd

igual('referencia venta', referenciaDocumento(VENTA), 'Factura N.º F-000123')
igual('referencia compra', referenciaDocumento(COMPRA), 'Compra del 05/10/2026 (ref. 9f8e7d6c)')

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'contratos-'))
  for (const [nombre, datos] of [
    ['venta-juridica-tasa-manual.pdf', VENTA],
    ['compra-tasa-referencial.pdf', COMPRA],
  ] as const) {
    const bytes = await reactPdfContratoRenderer.render(datos)
    const cabecera = Buffer.from(bytes.slice(0, 5)).toString()
    igual(`${nombre} es un PDF`, cabecera, '%PDF-')
    const ruta = join(dir, nombre)
    writeFileSync(ruta, bytes)
    console.log(`     ${ruta} (${bytes.length} bytes)`)
  }
  if (fallas > 0) {
    console.error(`\n${fallas} caso(s) fallaron`)
    process.exit(1)
  }
  console.log('\nTodo OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
