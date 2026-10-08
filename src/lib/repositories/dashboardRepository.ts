import type { SupabaseClient } from '@supabase/supabase-js'
import type { FilaValorInventario, IDashboardRepository } from './interfaces'
import type {
  ClienteInactivo,
  ContratoPendienteFirma,
  DashboardOperativo,
  Deudor,
  ExposicionCambiaria,
  FilaFlujo,
  FilaMezclaVentas,
  FilaTopCliente,
  KpisDia,
  LoteAntiguo,
  MermaProceso,
  PedidoProximo,
  PerdidaPorMotivo,
  ProductoSalida,
  ProductoStockBajo,
  PuntoSpread,
  RangoFechas,
  RendimientoProveedor,
  ResultadoCambiario,
  TramoAging,
  TramoAntiguedad,
  VentaMensual,
} from '@/types/domain'

/**
 * Implementación Supabase del repositorio del dashboard (15). Solo hace
 * `db.rpc('dashboard_*')` y convierte `numeric` (que PostgREST puede devolver
 * como string) a `number`. Sin lógica: los cálculos viven en las RPC y la
 * composición en `dashboardService`.
 */

/** Fila cruda de una RPC: columnas `numeric` como `number | string`. */
type Cruda = Record<string, unknown>

const n = (v: unknown): number => Number(v ?? 0)
const nn = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))
const s = (v: unknown): string => String(v ?? '')
const sn = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))
const fecha = (v: unknown): string => s(v).slice(0, 10)

function rango(r: RangoFechas) {
  return { p_desde: r.desde, p_hasta: r.hasta }
}

async function filas(db: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<Cruda[]> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw error
  return (data ?? []) as Cruda[]
}

async function fila(db: SupabaseClient, fn: string, args?: Record<string, unknown>): Promise<Cruda> {
  const datos = await filas(db, fn, args)
  return datos[0] ?? {}
}

export function makeDashboardRepository(db: SupabaseClient): IDashboardRepository {
  return {
    async operativo(): Promise<DashboardOperativo> {
      const f = await fila(db, 'dashboard_operativo')
      return {
        hoy: fecha(f.hoy),
        umbral_stock_bajo_kg: nn(f.umbral_stock_bajo_kg),
        dias_alerta_lote: nn(f.dias_alerta_lote),
        pedidos: ((f.pedidos ?? []) as Cruda[]).map(
          (p): PedidoProximo => ({
            pedido_id: s(p.pedido_id),
            cliente_id: s(p.cliente_id),
            cliente_nombre: s(p.cliente_nombre),
            fecha_entrega: fecha(p.fecha_entrega),
            grupo: s(p.grupo) as PedidoProximo['grupo'],
            items: n(p.items),
            kg_estimados: n(p.kg_estimados),
            usd_estimado: nn(p.usd_estimado),
          })
        ),
        stock_bajo: ((f.stock_bajo ?? []) as Cruda[]).map(
          (p): ProductoStockBajo => ({
            producto_id: s(p.producto_id),
            producto_nombre: s(p.producto_nombre),
            stock_kg: n(p.stock_kg),
          })
        ),
        lotes_antiguos: ((f.lotes_antiguos ?? []) as Cruda[]).map(
          (l): LoteAntiguo => ({
            lote_id: s(l.lote_id),
            codigo: s(l.codigo),
            producto_id: s(l.producto_id),
            producto_nombre: s(l.producto_nombre),
            fecha_ingreso: fecha(l.fecha_ingreso),
            dias: n(l.dias),
            stock_kg: n(l.stock_kg),
          })
        ),
      }
    },

    async antiguedadLotes() {
      return (await filas(db, 'dashboard_antiguedad_lotes')).map(
        (f): TramoAntiguedad => ({
          tramo: s(f.tramo) as TramoAntiguedad['tramo'],
          orden: n(f.orden),
          lotes: n(f.lotes),
          kg: n(f.kg),
          usd: nn(f.usd),
        })
      )
    },

    async kpisDia(): Promise<Omit<KpisDia, 'margen_pct' | 'inventario_bs'>> {
      const f = await fila(db, 'dashboard_kpis_dia')
      return {
        hoy: fecha(f.hoy),
        ventas_usd: n(f.ventas_usd),
        ventas_kg: n(f.ventas_kg),
        facturas: n(f.facturas),
        costo_usd: n(f.costo_usd),
        margen_usd: n(f.margen_usd),
        cxc_saldo_usd: n(f.cxc_saldo_usd),
        cxc_vencido_usd: n(f.cxc_vencido_usd),
        cxc_facturas: n(f.cxc_facturas),
        cxc_clientes_vencidos: n(f.cxc_clientes_vencidos),
        cxp_saldo_usd: n(f.cxp_saldo_usd),
        cxp_vencido_usd: n(f.cxp_vencido_usd),
        cxp_compras: n(f.cxp_compras),
        inventario_usd: n(f.inventario_usd),
        inventario_kg: n(f.inventario_kg),
      }
    },

    async ventasMensuales(r) {
      return (await filas(db, 'dashboard_ventas_mensuales', rango(r))).map(
        (f): VentaMensual => ({
          mes: fecha(f.mes),
          ventas_usd: n(f.ventas_usd),
          kg: n(f.kg),
          facturas: n(f.facturas),
        })
      )
    },

    async productosSalida(r) {
      return (await filas(db, 'dashboard_productos_salida', rango(r))).map(
        (f): ProductoSalida => ({
          producto_id: s(f.producto_id),
          producto_nombre: s(f.producto_nombre),
          kg: n(f.kg),
          ventas_usd: n(f.ventas_usd),
          facturas: n(f.facturas),
          precio_medio_usd_kg: nn(f.precio_medio_usd_kg),
          costo_usd: n(f.costo_usd),
          margen_usd: n(f.margen_usd),
          margen_pct: nn(f.margen_pct),
        })
      )
    },

    async spreadPrecioCosto(r, productoId) {
      return (
        await filas(db, 'dashboard_spread_precio_costo', { ...rango(r), p_producto_id: productoId })
      ).map(
        (f): PuntoSpread => ({
          periodo: fecha(f.periodo),
          granularidad: s(f.granularidad) as PuntoSpread['granularidad'],
          kg: n(f.kg),
          precio_medio_usd_kg: nn(f.precio_medio_usd_kg),
          costo_medio_usd_kg: nn(f.costo_medio_usd_kg),
          spread_usd_kg: nn(f.spread_usd_kg),
        })
      )
    },

    async mezclaVentas(r) {
      return (await filas(db, 'dashboard_mezcla_ventas', rango(r))).map(
        (f): FilaMezclaVentas => ({
          grupo: s(f.grupo) as FilaMezclaVentas['grupo'],
          clave: s(f.clave),
          usd: n(f.usd),
          cantidad: n(f.cantidad),
          kg: nn(f.kg),
        })
      )
    },

    async topClientes(r, limite) {
      return (await filas(db, 'dashboard_top_clientes', { ...rango(r), p_limite: limite })).map(
        (f): FilaTopCliente => ({
          cliente_id: s(f.cliente_id),
          cliente_nombre: s(f.cliente_nombre),
          ventas_usd: n(f.ventas_usd),
          facturas: n(f.facturas),
          total_periodo_usd: n(f.total_periodo_usd),
          clientes_periodo: n(f.clientes_periodo),
        })
      )
    },

    async clientesInactivos(dias) {
      return (await filas(db, 'dashboard_clientes_inactivos', { p_dias: dias })).map(
        (f): ClienteInactivo => ({
          cliente_id: s(f.cliente_id),
          cliente_nombre: s(f.cliente_nombre),
          ultima_compra: fecha(f.ultima_compra),
          dias: n(f.dias),
          ventas_90d_usd: n(f.ventas_90d_usd),
        })
      )
    },

    async resultadoCambiario(r): Promise<ResultadoCambiario> {
      const f = await fila(db, 'dashboard_resultado_cambiario', rango(r))
      return {
        cobros_bs: n(f.cobros_bs),
        cobros: n(f.cobros),
        pagos_proveedores_bs: n(f.pagos_proveedores_bs),
        pagos_proveedores: n(f.pagos_proveedores),
        neto_bs: n(f.neto_bs),
      }
    },

    async mermaProcesos(r) {
      return (await filas(db, 'dashboard_merma_procesos', rango(r))).map(
        (f): MermaProceso => ({
          producto_id: s(f.producto_id),
          producto_nombre: s(f.producto_nombre),
          procesos: n(f.procesos),
          kg_entrada: n(f.kg_entrada),
          kg_salida: n(f.kg_salida),
          merma_kg: n(f.merma_kg),
          merma_pct: nn(f.merma_pct),
          rendimiento: nn(f.rendimiento),
          costo_merma_usd: n(f.costo_merma_usd),
        })
      )
    },

    async rendimientoProveedor(r) {
      return (await filas(db, 'dashboard_rendimiento_proveedor', rango(r))).map(
        (f): RendimientoProveedor => ({
          proveedor_id: sn(f.proveedor_id),
          proveedor_nombre: sn(f.proveedor_nombre),
          producto_id: s(f.producto_id),
          producto_nombre: s(f.producto_nombre),
          procesos: n(f.procesos),
          kg_entrada: n(f.kg_entrada),
          kg_salida: n(f.kg_salida),
          rendimiento: nn(f.rendimiento),
          merma_pct: nn(f.merma_pct),
          costo_kg_crudo_usd: nn(f.costo_kg_crudo_usd),
          costo_kg_limpio_usd: nn(f.costo_kg_limpio_usd),
        })
      )
    },

    async perdidasMotivo(r) {
      return (await filas(db, 'dashboard_perdidas_motivo', rango(r))).map(
        (f): PerdidaPorMotivo => ({
          motivo: s(f.motivo) as PerdidaPorMotivo['motivo'],
          registros: n(f.registros),
          kg: n(f.kg),
          usd: n(f.usd),
        })
      )
    },

    async valorInventario() {
      return (await filas(db, 'dashboard_valor_inventario')).map(
        (f): FilaValorInventario => ({
          producto_id: s(f.producto_id),
          producto_nombre: s(f.producto_nombre),
          lotes: n(f.lotes),
          stock_kg: n(f.stock_kg),
          valor_usd: n(f.valor_usd),
        })
      )
    },

    async agingCartera() {
      return (await filas(db, 'dashboard_aging_cartera')).map(
        (f): TramoAging => ({
          tramo: s(f.tramo) as TramoAging['tramo'],
          orden: n(f.orden),
          saldo_usd: n(f.saldo_usd),
          facturas: n(f.facturas),
        })
      )
    },

    async topDeudores(limite) {
      return (await filas(db, 'dashboard_top_deudores', { p_limite: limite })).map(
        (f): Deudor => ({
          cliente_id: s(f.cliente_id),
          cliente_nombre: s(f.cliente_nombre),
          saldo_usd: n(f.saldo_usd),
          vencido_usd: n(f.vencido_usd),
          facturas: n(f.facturas),
          vencida_mas_antigua_dias: nn(f.vencida_mas_antigua_dias),
        })
      )
    },

    async flujoProyectado(dias) {
      return (await filas(db, 'dashboard_flujo_proyectado', { p_dias: dias })).map(
        (f): FilaFlujo => ({
          tipo: s(f.tipo) as FilaFlujo['tipo'],
          fecha: f.fecha === null || f.fecha === undefined ? null : fecha(f.fecha),
          cobros_usd: n(f.cobros_usd),
          pagos_usd: n(f.pagos_usd),
        })
      )
    },

    async exposicionCambiaria(): Promise<ExposicionCambiaria> {
      const f = await fila(db, 'dashboard_exposicion_cambiaria')
      return {
        saldo_usd: n(f.saldo_usd),
        fuente: f.fuente === 'paralela' ? 'paralela' : 'bcv',
        tasa_bcv: nn(f.tasa_bcv),
        tasa_bcv_fecha: f.tasa_bcv_fecha ? fecha(f.tasa_bcv_fecha) : null,
        tasa_paralela: nn(f.tasa_paralela),
        tasa_paralela_fecha: f.tasa_paralela_fecha ? fecha(f.tasa_paralela_fecha) : null,
        brecha_pct: nn(f.brecha_pct),
        brecha_bs: nn(f.brecha_bs),
        latente_bs: nn(f.latente_bs),
      }
    },

    async contratosSinFirmar() {
      return (await filas(db, 'dashboard_contratos_sin_firmar')).map(
        (f): ContratoPendienteFirma => ({
          contrato_id: s(f.contrato_id),
          numero: n(f.numero),
          tipo: s(f.tipo) as ContratoPendienteFirma['tipo'],
          estado: s(f.estado) as ContratoPendienteFirma['estado'],
          contraparte_nombre: sn(f.contraparte_nombre),
          fecha: fecha(f.fecha),
          fecha_vencimiento: fecha(f.fecha_vencimiento),
          dias_desde_generado: n(f.dias_desde_generado),
        })
      )
    },
  }
}
