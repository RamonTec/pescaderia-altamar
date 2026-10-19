/**
 * Carga el inventario de apertura de octubre 2026 desde INVENTARIO_OCTUBRE.xlsx.
 *
 *   npx tsx --env-file=.env scripts/importar-inventario-octubre.ts <ruta.xlsx>            # simulación
 *   npx tsx --env-file=.env scripts/importar-inventario-octubre.ts <ruta.xlsx> --aplicar  # escribe
 *
 * Opcional: `--fecha=AAAA-MM-DD` (fecha de ingreso de los lotes, por defecto 2026-10-01).
 *
 * Hojas que se leen:
 * - PRODUCTOS (+ códigos que solo aparecen en ENTRADAS) → `productos`, todos `crudo`.
 * - ENTRADAS (cantidad kg + costo unidad USD) → un lote `inicial` por fila con
 *   su movimiento `ajuste` (no hay fecha ni proveedor: no son compras).
 * - clientes / proveedores → `clientes` / `proveedores` (solo nombre).
 * SALIDAS está vacía y el resto de hojas no son datos del sistema. El precio
 * sugerido no se carga: `productos` no tiene columna de precio.
 *
 * Usa la service role key (lotes y movimientos solo se escriben por RPC o
 * service role). Idempotente: no duplica productos (por código), clientes ni
 * proveedores (por nombre) ni lotes iniciales (por producto y fecha), así que
 * se puede volver a correr si falla a mitad.
 *
 * Si se quiere empezar limpio, correr antes scripts/sql/reiniciar-datos-transaccionales.sql.
 */
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'

type Categoria = 'pescado' | 'marisco' | 'otro'

interface ProductoExcel {
  codigo: string
  nombre: string
  categoria: Categoria
}

interface EntradaExcel {
  fila: number
  codigo: string
  pesoKg: number
  costoUsdKg: number
}

interface ContraparteExcel {
  nombre: string
  notas: string | null
  deuda: number
}

const args = process.argv.slice(2)
const ruta = args.find((a) => !a.startsWith('--'))
const aplicar = args.includes('--aplicar')
const fecha = args.find((a) => a.startsWith('--fecha='))?.slice('--fecha='.length) ?? '2026-10-01'
const ORIGEN_NOTA = 'Inventario de apertura octubre 2026 (INVENTARIO_OCTUBRE.xlsx)'

if (!ruta) {
  console.error('Uso: npx tsx --env-file=.env scripts/importar-inventario-octubre.ts <ruta.xlsx> [--aplicar] [--fecha=AAAA-MM-DD]')
  process.exit(1)
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
  console.error(`Fecha inválida: ${fecha}`)
  process.exit(1)
}

// ---------- Lectura del Excel ----------

/** Valor de una celda: resultado de fórmulas, texto de rich text, `null` si vacía o error. */
function valor(cell: ExcelJS.Cell): string | number | null {
  const v = cell.value
  if (v === null || v === undefined) return null
  if (typeof v === 'number' || typeof v === 'string') return v
  if (typeof v === 'object') {
    if ('result' in v) {
      const r = v.result
      return typeof r === 'number' || typeof r === 'string' ? r : null
    }
    if ('richText' in v) return v.richText.map((t) => t.text).join('')
  }
  return null
}

function texto(cell: ExcelJS.Cell): string | null {
  const v = valor(cell)
  if (v === null) return null
  const t = String(v).replace(/\s+/g, ' ').trim()
  return t === '' || t === '#N/A' ? null : t
}

function numero(cell: ExcelJS.Cell): number | null {
  const v = valor(cell)
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return null
}

const oracion = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
const titulo = (s: string) =>
  s
    .toLowerCase()
    .split(' ')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
/** Clave de comparación de nombres: sin mayúsculas, acentos ni espacios extra. */
const clave = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const CATEGORIA_POR_PREFIJO: Record<string, Categoria> = {
  CAM: 'marisco',
  LANG: 'marisco',
  CAL: 'marisco',
  MEJ: 'marisco',
  GUA: 'marisco',
  PULP: 'marisco',
  TENT: 'marisco',
  ANI: 'marisco',
  JAI: 'marisco',
  VIE: 'marisco',
  ALM: 'marisco',
  VER: 'marisco',
  FIL: 'pescado',
  ENT: 'pescado',
  RUE: 'pescado',
  LOM: 'pescado',
  ATUN: 'pescado',
  VEN: 'pescado',
  REC: 'pescado',
  PEZ: 'pescado',
}
const CATEGORIA_POR_CODIGO: Record<string, Categoria> = { 'ENT-PAE-001': 'marisco' }

function categoria(codigo: string): Categoria {
  return CATEGORIA_POR_CODIGO[codigo] ?? CATEGORIA_POR_PREFIJO[codigo.split('-')[0]] ?? 'otro'
}

function hoja(wb: ExcelJS.Workbook, nombre: string): ExcelJS.Worksheet {
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === nombre.toLowerCase())
  if (!ws) throw new Error(`El Excel no tiene la hoja "${nombre}"`)
  return ws
}

function leerProductos(wb: ExcelJS.Workbook): Map<string, ProductoExcel> {
  const productos = new Map<string, ProductoExcel>()
  const agregar = (ref: string | null, nombre: string | null) => {
    if (!ref || !nombre) return
    const codigo = ref.toUpperCase()
    if (!productos.has(codigo)) productos.set(codigo, { codigo, nombre: oracion(nombre), categoria: categoria(codigo) })
  }
  hoja(wb, 'PRODUCTOS').eachRow((row, n) => {
    if (n > 1) agregar(texto(row.getCell(1)), texto(row.getCell(2)))
  })
  hoja(wb, 'ENTRADAS').eachRow((row, n) => {
    if (n > 1) agregar(texto(row.getCell(1)), texto(row.getCell(2)))
  })
  return productos
}

function leerEntradas(wb: ExcelJS.Workbook, avisos: string[]): EntradaExcel[] {
  const entradas: EntradaExcel[] = []
  hoja(wb, 'ENTRADAS').eachRow((row, n) => {
    if (n === 1) return
    const ref = texto(row.getCell(1))
    const peso = numero(row.getCell(3))
    const costo = numero(row.getCell(7))
    const total = numero(row.getCell(8))
    if (!ref) return
    if (!peso || peso <= 0) return // producto listado sin entrada
    if (costo === null || costo < 0) {
      avisos.push(`ENTRADAS fila ${n} (${ref}): ${peso} kg sin costo unidad, se omite`)
      return
    }
    if (total !== null && Math.abs(total - peso * costo) > 0.01) {
      avisos.push(`ENTRADAS fila ${n} (${ref}): costo total ${total} ≠ ${peso} × ${costo}`)
    }
    entradas.push({ fila: n, codigo: ref.toUpperCase(), pesoKg: peso, costoUsdKg: costo })
  })
  return entradas
}

function leerContrapartes(wb: ExcelJS.Workbook, nombreHoja: string): ContraparteExcel[] {
  const vistos = new Set<string>()
  const lista: ContraparteExcel[] = []
  hoja(wb, nombreHoja).eachRow((row, n) => {
    if (n === 1) return
    const ref = texto(row.getCell(1))
    const desc = texto(row.getCell(2))
    if (!ref && !desc) return
    // El más descriptivo de los dos ("mookah la trinidad" > "mookah", "cuevas grill" > "aranjuez").
    const candidatos = [ref, desc].filter((s): s is string => !!s)
    const nombre = titulo(candidatos.reduce((a, b) => (b.length > a.length ? b : a)))
    const otro = candidatos.find((s) => clave(s) !== clave(nombre))
    if (vistos.has(clave(nombre))) return
    vistos.add(clave(nombre))
    lista.push({
      nombre,
      notas: otro ? `${ORIGEN_NOTA}. Referencia: ${otro}` : ORIGEN_NOTA,
      deuda: numero(row.getCell(3)) ?? 0,
    })
  })
  return lista
}

// ---------- Escritura ----------

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (usar --env-file=.env)')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(ruta!)

  const avisos: string[] = []
  const productos = leerProductos(wb)
  const entradas = leerEntradas(wb, avisos)
  const clientes = leerContrapartes(wb, 'clientes')
  const proveedores = leerContrapartes(wb, 'proveedores')
  for (const c of [...clientes, ...proveedores]) {
    if (c.deuda !== 0) avisos.push(`${c.nombre}: deuda ${c.deuda} en el Excel, no se carga (registrarla como factura/compra)`)
  }

  console.log(`${aplicar ? 'APLICANDO' : 'SIMULACIÓN (usar --aplicar para escribir)'} · fecha de ingreso ${fecha}\n`)

  // Tasa BCV USD de la fecha (o la más cercana): snapshot informativo del lote en USD.
  const { data: tasas, error: eTasa } = await db
    .from('tasas')
    .select('fecha, valor_bs')
    .eq('fuente', 'bcv')
    .eq('moneda', 'USD')
    .order('fecha', { ascending: true })
  if (eTasa) throw eTasa
  const listaTasas = (tasas ?? []) as { fecha: string; valor_bs: number }[]
  const tasa = [...listaTasas].reverse().find((t) => t.fecha <= fecha) ?? listaTasas[0]
  if (!tasa) throw new Error('No hay ninguna tasa BCV USD registrada')
  console.log(`Tasa snapshot: BCV USD ${tasa.valor_bs} (${tasa.fecha})\n`)

  // --- Productos ---
  const { data: existentesP, error: eP } = await db.from('productos').select('id, codigo')
  if (eP) throw eP
  const idPorCodigo = new Map<string, string>()
  for (const p of (existentesP ?? []) as { id: string; codigo: string | null }[]) {
    if (p.codigo) idPorCodigo.set(p.codigo.toUpperCase(), p.id)
  }
  const nuevosP = [...productos.values()].filter((p) => !idPorCodigo.has(p.codigo))
  console.log(`Productos: ${productos.size} en el Excel, ${nuevosP.length} nuevos`)
  for (const p of nuevosP) console.log(`  + ${p.codigo.padEnd(14)} ${p.nombre} (${p.categoria})`)
  if (aplicar && nuevosP.length > 0) {
    const { data, error } = await db
      .from('productos')
      .insert(nuevosP.map((p) => ({ ...p, tipo: 'crudo', controla_stock: true, activo: true })))
      .select('id, codigo')
    if (error) throw error
    for (const p of data as { id: string; codigo: string }[]) idPorCodigo.set(p.codigo, p.id)
  }

  // --- Clientes y proveedores ---
  for (const [tabla, lista] of [
    ['clientes', clientes],
    ['proveedores', proveedores],
  ] as const) {
    const { data, error } = await db.from(tabla).select('nombre')
    if (error) throw error
    const existentes = new Set((data as { nombre: string }[]).map((r) => clave(r.nombre)))
    const nuevos = lista.filter((c) => !existentes.has(clave(c.nombre)))
    const repetidos = lista.filter((c) => existentes.has(clave(c.nombre)))
    console.log(`\n${tabla}: ${lista.length} en el Excel, ${nuevos.length} nuevos`)
    for (const c of nuevos) console.log(`  + ${c.nombre}`)
    for (const c of repetidos) console.log(`  = ${c.nombre} (ya existe)`)
    if (aplicar && nuevos.length > 0) {
      const { error: eIns } = await db.from(tabla).insert(nuevos.map((c) => ({ nombre: c.nombre, notas: c.notas })))
      if (eIns) throw eIns
    }
  }

  // --- Lotes iniciales ---
  const { data: lotesExist, error: eL } = await db
    .from('lotes')
    .select('id, producto_id, codigo')
    .eq('origen', 'inicial')
    .eq('fecha_ingreso', fecha)
  if (eL) throw eL
  const lotePorProducto = new Map((lotesExist as { id: string; producto_id: string; codigo: string }[]).map((l) => [l.producto_id, l]))

  let totalKg = 0
  let totalUsd = 0
  console.log(`\nLotes iniciales: ${entradas.length} entradas`)
  for (const e of entradas) {
    totalKg += e.pesoKg
    totalUsd += e.pesoKg * e.costoUsdKg
    const productoId = idPorCodigo.get(e.codigo)
    const resumen = `${e.codigo.padEnd(14)} ${e.pesoKg.toFixed(3).padStart(9)} kg × ${e.costoUsdKg.toFixed(2).padStart(6)} USD/kg`
    if (!productoId) {
      console.log(`  + ${resumen} (producto nuevo)`)
      continue // solo en simulación: con --aplicar el producto ya se creó
    }

    let lote = lotePorProducto.get(productoId)
    if (lote) {
      const { count, error } = await db.from('movimientos').select('id', { count: 'exact', head: true }).eq('lote_id', lote.id)
      if (error) throw error
      if (count && count > 0) {
        console.log(`  = ${resumen} → ${lote.codigo} (ya cargado)`)
        continue
      }
    }
    console.log(`  + ${resumen}${lote ? ` → ${lote.codigo} (faltaba el movimiento)` : ''}`)
    if (!aplicar) continue

    if (!lote) {
      const { data: codigo, error: eCod } = await db.rpc('generar_codigo_lote', { p_producto_id: productoId, p_fecha: fecha })
      if (eCod) throw eCod
      const { data, error } = await db
        .from('lotes')
        .insert({
          codigo,
          producto_id: productoId,
          origen: 'inicial',
          fecha_ingreso: fecha,
          peso_inicial_kg: Math.round(e.pesoKg * 1000) / 1000,
          costo_usd_kg: Math.round(e.costoUsdKg * 1e6) / 1e6,
          moneda: 'usd',
          tasa_snapshot: tasa.valor_bs,
          notas: `${ORIGEN_NOTA}, fila ${e.fila}`,
        })
        .select('id, producto_id, codigo')
        .single()
      if (error) throw error
      lote = data as { id: string; producto_id: string; codigo: string }
      lotePorProducto.set(productoId, lote)
    }

    const { error: eMov } = await db.from('movimientos').insert({
      producto_id: productoId,
      lote_id: lote.id,
      tipo: 'ajuste',
      peso_kg: Math.round(e.pesoKg * 1000) / 1000,
      costo_usd_kg: Math.round(e.costoUsdKg * 1e6) / 1e6,
      ref_id: lote.id,
      fecha: `${fecha}T12:00:00-04:00`,
    })
    if (eMov) throw eMov
    console.log(`      lote ${lote.codigo}`)
  }
  console.log(`\nTotal: ${totalKg.toFixed(3)} kg · ${totalUsd.toFixed(2)} USD a costo`)

  if (avisos.length > 0) {
    console.log('\nAvisos:')
    for (const a of avisos) console.log(`  ! ${a}`)
  }
}

main().catch((e: unknown) => {
  console.error('\nERROR:', e instanceof Error ? e.message : JSON.stringify(e))
  process.exit(1)
})
