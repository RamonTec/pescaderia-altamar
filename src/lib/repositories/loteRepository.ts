import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ILoteRepository,
  LoteDeOrigen,
  MovimientosArbolLote,
} from './interfaces'
import type {
  DevolucionLote,
  EstadoDoc,
  EstadoNotaCredito,
  FacturaItemLote,
  Lote,
  PerdidaLote,
  ProcesoLote,
  SugerenciaLotes,
  VentaLote,
} from '@/types/domain'
import { createClient } from '@/lib/supabase/client'

/**
 * Implementación Supabase del repositorio de lotes (07-lotes).
 *
 * Lecturas siempre desde vistas: `lotes_view` (stock calculado del ledger y
 * costo `null` para el operador), `factura_item_lotes_view` y
 * `perdidas_lote_view`. Las escrituras van por RPC `security definer`
 * (`registrar_perdida`, `cerrar_lote`): ninguna tabla de lotes tiene
 * política de insert/update.
 */

/** Quita los comodines de `ilike` y los separadores de filtros de PostgREST. */
function limpiarBusqueda(texto: string): string {
  return texto.replace(/[%_,()*\\]/g, '').trim()
}

const num = (v: unknown): number => Number(v ?? 0)

type FilaProceso = {
  id: string
  procesamiento_id: string
  lote_origen_id: string
  peso_entrada_kg: number
  peso_salida_kg: number
  procesamiento: { fecha: string } | null
}

type FilaItemFactura = { id: string; factura_id: string; precio_usd_kg: number }

type FilaFactura = {
  id: string
  numero: number
  fecha: string
  estado: EstadoDoc
  tasa_snapshot: number
  cliente_id: string
  cliente: { id: string; nombre: string } | null
}

type FilaDevolucion = {
  id: string
  lote_id: string
  peso_kg: number
  item: {
    id: string
    precio_usd_kg: number
    factura_item_id: string
    nota: {
      id: string
      numero: number
      fecha: string
      estado: EstadoNotaCredito
      factura_id: string
    } | null
  } | null
}

function normalizaLote(l: Lote): Lote {
  return {
    ...l,
    peso_inicial_kg: num(l.peso_inicial_kg),
    stock_kg: num(l.stock_kg),
    costo_usd_kg: l.costo_usd_kg == null ? null : num(l.costo_usd_kg),
    tasa_snapshot: num(l.tasa_snapshot),
  }
}

export function makeLoteRepository(db: SupabaseClient = createClient()): ILoteRepository {
  return {
    async listAbiertos(productoId) {
      const { data, error } = await db
        .from('lotes_view')
        .select('*')
        .eq('producto_id', productoId)
        .eq('estado', 'abierto')
        .gt('stock_kg', 0)
        .order('fecha_ingreso', { ascending: true })
        .order('codigo', { ascending: true })
      if (error) throw error
      return ((data ?? []) as Lote[]).map(normalizaLote)
    },

    async listAbiertosTodos() {
      const { data, error } = await db
        .from('lotes_view')
        .select('*')
        .eq('estado', 'abierto')
        .order('fecha_ingreso', { ascending: true })
        .order('codigo', { ascending: true })
      if (error) throw error
      return ((data ?? []) as Lote[]).map(normalizaLote)
    },

    async list(filtros) {
      let q = db.from('lotes_view').select('*', { count: 'exact' })
      if (filtros.estado) q = q.eq('estado', filtros.estado)
      if (filtros.productoId) q = q.eq('producto_id', filtros.productoId)
      if (filtros.proveedorId) q = q.eq('proveedor_id', filtros.proveedorId)
      const codigo = limpiarBusqueda(filtros.codigo ?? '')
      if (codigo) q = q.ilike('codigo', `%${codigo}%`)

      const desde = filtros.page * filtros.pageSize
      const { data, error, count } = await q
        .order('fecha_ingreso', { ascending: false })
        .order('codigo', { ascending: false })
        .range(desde, desde + filtros.pageSize - 1)
      if (error) throw error
      return { rows: ((data ?? []) as Lote[]).map(normalizaLote), total: count ?? 0 }
    },

    async getById(id) {
      const { data, error } = await db.from('lotes_view').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data ? normalizaLote(data as Lote) : null
    },

    async getArbol(loteId) {
      const { data, error } = await db
        .from('lotes_view')
        .select('*')
        .or(`id.eq.${loteId},lote_padre_id.eq.${loteId}`)
        .order('fecha_ingreso', { ascending: true })
        .order('codigo', { ascending: true })
      if (error) throw error
      return ((data ?? []) as Lote[]).map(normalizaLote)
    },

    async getMovimientosArbol(lotes) {
      const ids = lotes.map((l) => l.id)
      const vacio: MovimientosArbolLote = { procesos: [], ventas: [], perdidas: [], devoluciones: [] }
      if (ids.length === 0) return vacio

      const [procesosRes, filRes, perdidasRes, devolucionesRes] = await Promise.all([
        db
          .from('proceso_items')
          .select(
            'id, procesamiento_id, lote_origen_id, peso_entrada_kg, peso_salida_kg, procesamiento:procesamientos(fecha)'
          )
          .in('lote_origen_id', ids),
        db.from('factura_item_lotes_view').select('*').in('lote_id', ids),
        db
          .from('perdidas_lote_view')
          .select('*')
          .in('lote_id', ids)
          .order('fecha', { ascending: true })
          .order('created_at', { ascending: true }),
        db
          .from('nota_credito_item_lotes')
          .select(
            'id, lote_id, peso_kg, item:nota_credito_items(id, precio_usd_kg, factura_item_id, nota:notas_credito(id, numero, fecha, estado, factura_id))'
          )
          .in('lote_id', ids),
      ])
      if (procesosRes.error) throw procesosRes.error
      if (filRes.error) throw filRes.error
      if (perdidasRes.error) throw perdidasRes.error
      if (devolucionesRes.error) throw devolucionesRes.error

      const fil = (filRes.data ?? []) as FacturaItemLote[]
      const devolucionesFilas = (devolucionesRes.data ?? []) as unknown as FilaDevolucion[]

      // Items vendidos (precio y factura) y facturas (número, cliente, tasa).
      const itemIds = [...new Set(fil.map((f) => f.factura_item_id))]
      const { data: itemsData, error: itemsError } = itemIds.length
        ? await db.from('factura_items_view').select('id, factura_id, precio_usd_kg').in('id', itemIds)
        : { data: [], error: null }
      if (itemsError) throw itemsError
      const items = new Map(
        ((itemsData ?? []) as FilaItemFactura[]).map((i): [string, FilaItemFactura] => [i.id, i])
      )

      const facturaIds = [
        ...new Set([
          ...[...items.values()].map((i) => i.factura_id),
          ...devolucionesFilas.map((d) => d.item?.nota?.factura_id).filter((x): x is string => !!x),
        ]),
      ]
      const { data: facturasData, error: facturasError } = facturaIds.length
        ? await db
            .from('facturas')
            .select('id, numero, fecha, estado, tasa_snapshot, cliente_id, cliente:clientes(id, nombre)')
            .in('id', facturaIds)
        : { data: [], error: null }
      if (facturasError) throw facturasError
      const facturas = new Map(
        ((facturasData ?? []) as unknown as FilaFactura[]).map((f): [string, FilaFactura] => [f.id, f])
      )

      const codigos = new Map(lotes.map((l): [string, Lote] => [l.id, l]))
      const destinoPorProceso = new Map(
        lotes
          .filter((l) => l.proceso_item_id)
          .map((l): [string, Lote] => [l.proceso_item_id as string, l])
      )

      const procesos: ProcesoLote[] = ((procesosRes.data ?? []) as unknown as FilaProceso[]).map((p) => {
        const destino = destinoPorProceso.get(p.id) ?? null
        return {
          proceso_item_id: p.id,
          procesamiento_id: p.procesamiento_id,
          fecha: p.procesamiento?.fecha ?? '',
          lote_origen_id: p.lote_origen_id,
          peso_entrada_kg: num(p.peso_entrada_kg),
          peso_salida_kg: num(p.peso_salida_kg),
          lote_destino_id: destino?.id ?? null,
          lote_destino_codigo: destino?.codigo ?? null,
        }
      })

      const ventas: VentaLote[] = []
      for (const f of fil) {
        const item = items.get(f.factura_item_id)
        const factura = item ? facturas.get(item.factura_id) : undefined
        if (!item || !factura) continue
        ventas.push({
          id: f.id,
          lote_id: f.lote_id,
          factura_id: factura.id,
          factura_numero: factura.numero,
          factura_estado: factura.estado,
          cliente_id: factura.cliente_id,
          cliente_nombre: factura.cliente?.nombre ?? '—',
          fecha: factura.fecha,
          peso_kg: num(f.peso_kg),
          precio_usd_kg: num(item.precio_usd_kg),
          costo_usd_kg: f.costo_usd_kg == null ? null : num(f.costo_usd_kg),
          tasa_factura: num(factura.tasa_snapshot),
        })
      }

      const devoluciones: DevolucionLote[] = []
      for (const d of devolucionesFilas) {
        const nota = d.item?.nota
        const factura = nota ? facturas.get(nota.factura_id) : undefined
        if (!d.item || !nota || !factura || !codigos.has(d.lote_id)) continue
        devoluciones.push({
          id: d.id,
          lote_id: d.lote_id,
          nota_credito_id: nota.id,
          nota_numero: nota.numero,
          nota_estado: nota.estado,
          fecha: nota.fecha,
          peso_kg: num(d.peso_kg),
          precio_usd_kg: num(d.item.precio_usd_kg),
          factura_id: factura.id,
          factura_numero: factura.numero,
          tasa_factura: num(factura.tasa_snapshot),
        })
      }

      const perdidas = ((perdidasRes.data ?? []) as PerdidaLote[]).map((p) => ({
        ...p,
        peso_kg: num(p.peso_kg),
      }))

      const porFecha = <T extends { fecha: string }>(a: T, b: T) => a.fecha.localeCompare(b.fecha)
      return {
        procesos: procesos.sort(porFecha),
        ventas: ventas.sort(porFecha),
        perdidas,
        devoluciones: devoluciones.sort(porFecha),
      }
    },

    async listByOrigen({ compraIds = [], procesamientoIds = [] }) {
      // En tramos: una lista larga de uuids no cabe en la URL de PostgREST.
      const TRAMO = 100
      const consultas: { columna: 'compra_id' | 'procesamiento_id'; ids: string[] }[] = []
      for (let i = 0; i < compraIds.length; i += TRAMO) {
        consultas.push({ columna: 'compra_id', ids: compraIds.slice(i, i + TRAMO) })
      }
      for (let i = 0; i < procesamientoIds.length; i += TRAMO) {
        consultas.push({ columna: 'procesamiento_id', ids: procesamientoIds.slice(i, i + TRAMO) })
      }
      const resultados = await Promise.all(
        consultas.map(({ columna, ids }) =>
          db
            .from('lotes_view')
            .select('id, codigo, compra_id, procesamiento_id, proceso_item_id, lote_padre_id, lote_padre_codigo, producto_nombre, peso_inicial_kg, estado')
            .in(columna, ids)
            .order('codigo', { ascending: true })
        )
      )
      const lotes: LoteDeOrigen[] = []
      for (const { data, error } of resultados) {
        if (error) throw error
        for (const l of (data ?? []) as LoteDeOrigen[]) {
          lotes.push({ ...l, peso_inicial_kg: num(l.peso_inicial_kg) })
        }
      }
      return lotes
    },

    async sugerir(productoId, pesoKg) {
      const { data, error } = await db.rpc('sugerir_lotes', {
        p_producto_id: productoId,
        p_peso_kg: pesoKg,
      })
      if (error) throw error
      const s = data as SugerenciaLotes
      return {
        controla_stock: s.controla_stock,
        suficiente: s.suficiente,
        disponible_kg: s.disponible_kg == null ? null : num(s.disponible_kg),
        faltante_kg: num(s.faltante_kg),
        asignacion: (s.asignacion ?? []).map((a) => ({
          ...a,
          peso_kg: num(a.peso_kg),
          disponible_kg: num(a.disponible_kg),
        })),
      }
    },

    async registrarPerdida(perdida) {
      const { data, error } = await db.rpc('registrar_perdida', {
        p_lote_id: perdida.lote_id,
        p_peso_kg: perdida.peso_kg,
        p_motivo: perdida.motivo,
        p_detalle: perdida.detalle,
        p_fecha: perdida.fecha ?? null,
      })
      if (error) throw error
      return data as string
    },

    async cerrar(loteId, detalle, pesoEsperadoKg) {
      const { data, error } = await db.rpc('cerrar_lote', {
        p_lote_id: loteId,
        p_detalle: detalle,
        p_peso_esperado_kg: pesoEsperadoKg,
      })
      if (error) throw error
      return { peso_baja_kg: num((data as { peso_baja_kg: number }).peso_baja_kg) }
    },
  }
}
