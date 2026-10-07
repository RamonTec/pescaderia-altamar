import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * "Operaciones con tasa manual" (08-tasas, admin): compras, facturas y
 * abonos con `tasa_origen = 'manual'`, con el usuario que la puso y la
 * desviación contra la referencial vigente en ese momento. Una consulta
 * simple por tabla (spec: "hazlo simple, una consulta por tabla"); el
 * listado combinado se ordena por desviación % descendente.
 */

export interface OperacionTasaManual {
  id: string
  fecha: string
  tipo: 'Compra' | 'Factura' | 'Cobro' | 'Pago a proveedor'
  /** "Compra a Pez & Cía." / "Factura 0123 · El Muelle". */
  documento: string
  /** Nombre del usuario que fijó la tasa manual; null si no se puede resolver. */
  usuario: string | null
  referencial: number | null
  manual: number
  /** `(manual/referencial − 1) × 100`; null si no había referencial. */
  diferencia_pct: number | null
}

interface FilaBase {
  id: string
  fecha: string
  tasa_referencial: string | number | null
  tasa_registrada_por: string | null
}

/**
 * Nota: supabase-js tipa los joins embebidos como arrays aunque el
 * `maybeSingle` implícito del left join devuelva un objeto (o null); se
 * declara el shape que llega de verdad por la red.
 */
interface FilaCompra extends FilaBase {
  tasa_snapshot: string | number
  proveedores: { nombre: string | null }[] | null
}

interface FilaFactura extends FilaBase {
  numero: number
  tasa_snapshot: string | number
  clientes: { nombre: string | null }[] | null
}

interface FilaPago extends FilaBase {
  tasa_pago: string | number
  facturas: { numero: number; clientes: { nombre: string | null }[] | null }[] | null
}

interface FilaPagoProveedor extends FilaBase {
  tasa_pago: string | number
  compras: { proveedores: { nombre: string | null }[] | null }[] | null
}

/** El join embebido llega como objeto único o null (aunque supabase tipa array). */
function uno<T>(embed: T[] | null | undefined): T | null {
  return embed && embed.length > 0 ? embed[0] : null
}

function num(v: string | number | null): number {
  return Number(v ?? 0)
}

function desviacion(manual: number, referencial: number | null): number | null {
  if (referencial == null || !(referencial > 0) || !(manual > 0)) return null
  return (manual / referencial - 1) * 100
}

export async function listOperacionesTasaManual(
  db: SupabaseClient,
  limit = 100
): Promise<OperacionTasaManual[]> {
  const { data: perfiles } = await db.from('perfiles').select('id, nombre')
  const nombrePorId = new Map(
    (perfiles ?? []).map((p: { id: string; nombre: string | null }) => [p.id, p.nombre])
  )

  const usuarioDe = (id: string | null) => (id ? nombrePorId.get(id) ?? null : null)
  const fila = (f: FilaBase, tipo: OperacionTasaManual['tipo'], documento: string, manual: number): OperacionTasaManual => ({
    id: f.id,
    fecha: f.fecha,
    tipo,
    documento,
    usuario: usuarioDe(f.tasa_registrada_por),
    referencial: f.tasa_referencial != null ? num(f.tasa_referencial) : null,
    manual,
    diferencia_pct: desviacion(manual, f.tasa_referencial != null ? num(f.tasa_referencial) : null),
  })

  const [compras, facturas, pagos, pagosProveedores] = await Promise.all([
    db
      .from('compras')
      .select('id, fecha, tasa_referencial, tasa_snapshot, tasa_registrada_por, proveedores(nombre)')
      .eq('tasa_origen', 'manual')
      .order('fecha', { ascending: false })
      .limit(limit),
    db
      .from('facturas')
      .select('id, fecha, tasa_referencial, tasa_snapshot, tasa_registrada_por, numero, clientes(nombre)')
      .eq('tasa_origen', 'manual')
      .order('fecha', { ascending: false })
      .limit(limit),
    db
      .from('pagos')
      .select('id, fecha, tasa_referencial, tasa_pago, tasa_registrada_por, facturas(numero, clientes(nombre))')
      .eq('tasa_origen', 'manual')
      .order('fecha', { ascending: false })
      .limit(limit),
    db
      .from('pagos_proveedores')
      .select('id, fecha, tasa_referencial, tasa_pago, tasa_registrada_por, compras(proveedores(nombre))')
      .eq('tasa_origen', 'manual')
      .order('fecha', { ascending: false })
      .limit(limit),
  ])

  const out: OperacionTasaManual[] = []

  for (const f of (compras.data ?? []) as FilaCompra[]) {
    const proveedor = uno(f.proveedores)
    out.push(
      fila(f, 'Compra', proveedor?.nombre ? `Compra a ${proveedor.nombre}` : 'Compra', num(f.tasa_snapshot))
    )
  }
  for (const f of (facturas.data ?? []) as FilaFactura[]) {
    const cliente = uno(f.clientes)
    out.push(
      fila(
        f,
        'Factura',
        `Factura ${String(f.numero).padStart(4, '0')}${cliente?.nombre ? ` · ${cliente.nombre}` : ''}`,
        num(f.tasa_snapshot)
      )
    )
  }
  for (const f of (pagos.data ?? []) as FilaPago[]) {
    const factura = uno(f.facturas)
    const cliente = uno(factura?.clientes)
    out.push(
      fila(
        f,
        'Cobro',
        factura
          ? `Cobro factura ${String(factura.numero).padStart(4, '0')}${cliente?.nombre ? ` · ${cliente.nombre}` : ''}`
          : 'Cobro',
        num(f.tasa_pago)
      )
    )
  }
  for (const f of (pagosProveedores.data ?? []) as FilaPagoProveedor[]) {
    const proveedor = uno(uno(f.compras)?.proveedores)
    out.push(
      fila(f, 'Pago a proveedor', proveedor?.nombre ? `Pago a ${proveedor.nombre}` : 'Pago a proveedor', num(f.tasa_pago))
    )
  }

  // Ordenado por desviación: el control que pidió el usuario.
  out.sort((a, b) => Math.abs(b.diferencia_pct ?? 0) - Math.abs(a.diferencia_pct ?? 0))
  return out
}