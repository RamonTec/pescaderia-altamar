import type {
  CompraFichaDetalle,
  ContratoFactura,
  CorreccionCompra,
  CorreccionCompraItem,
  DetalleCompra,
  LineaCompraDetalle,
  LoteHijoCompra,
  LoteLineaCompra,
  PagoProveedorDetalle,
  ProcesamientoCompra,
  PropagacionCosto,
  ResultadoEdicionCompra,
  SalidaProcesoCompra,
  VentasLoteResumen,
} from '@/types/domain'

/**
 * Mapeo del JSON de las RPC `detalle_compra` / `editar_compra` (19) a los
 * tipos de dominio. Sin lógica de negocio: solo forma y números (PostgREST
 * devuelve `numeric` como número o como texto según el caso). Sin imports de
 * Supabase: lo usan el repositorio y los scripts de prueba.
 */

type Json = Record<string, unknown>

const num = (v: unknown): number => Number(v ?? 0)
const numONull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))
const str = (v: unknown): string => String(v ?? '')
const strONull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : [])
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

function ventas(v: unknown): VentasLoteResumen {
  const j = obj(v) ?? {}
  return { kg: num(j.kg), lineas: num(j.lineas), facturas: num(j.facturas) }
}

function loteHijo(v: unknown): LoteHijoCompra | null {
  const j = obj(v)
  if (!j || j.id == null) return null
  return {
    id: str(j.id),
    codigo: str(j.codigo),
    estado: str(j.estado) as LoteHijoCompra['estado'],
    peso_inicial_kg: num(j.peso_inicial_kg),
    stock_kg: num(j.stock_kg),
    costo_usd_kg: num(j.costo_usd_kg),
    ventas: ventas(j.ventas),
  }
}

function salida(j: Json): SalidaProcesoCompra {
  return {
    proceso_item_id: str(j.proceso_item_id),
    producto_id: str(j.producto_id),
    producto_nombre: str(j.producto_nombre),
    peso_entrada_kg: num(j.peso_entrada_kg),
    peso_salida_kg: num(j.peso_salida_kg),
    precio_referencia_usd_kg: numONull(j.precio_referencia_usd_kg),
    costo_total_usd: num(j.costo_total_usd),
    lote: loteHijo(j.lote),
  }
}

function procesamiento(j: Json): ProcesamientoCompra {
  return {
    id: str(j.id),
    fecha: str(j.fecha),
    legado: j.legado === true,
    peso_entrada_kg: num(j.peso_entrada_kg),
    costo_total_usd: numONull(j.costo_total_usd),
    reparto_costo: (strONull(j.reparto_costo) as ProcesamientoCompra['reparto_costo']) ?? null,
    salidas: arr(j.salidas).map(salida),
  }
}

function loteLinea(v: unknown): LoteLineaCompra | null {
  const j = obj(v)
  if (!j || j.id == null) return null
  return {
    id: str(j.id),
    codigo: str(j.codigo),
    estado: str(j.estado) as LoteLineaCompra['estado'],
    fecha_ingreso: str(j.fecha_ingreso),
    peso_inicial_kg: num(j.peso_inicial_kg),
    costo_usd_kg: num(j.costo_usd_kg),
    stock_kg: num(j.stock_kg),
    kg_procesados: num(j.kg_procesados),
    kg_vendidos: num(j.kg_vendidos),
    kg_perdidos: num(j.kg_perdidos),
    primera_salida: strONull(j.primera_salida),
    ventas: ventas(j.ventas),
    procesamientos: arr(j.procesamientos).map(procesamiento),
  }
}

function linea(j: Json): LineaCompraDetalle {
  const p = obj(j.producto) ?? {}
  return {
    id: str(j.id),
    producto: {
      id: str(p.id),
      nombre: str(p.nombre),
      codigo: strONull(p.codigo),
      controla_stock: p.controla_stock === true,
    },
    peso_kg: num(j.peso_kg),
    costo_kg_pactado: num(j.costo_kg_pactado),
    costo_usd_kg: num(j.costo_usd_kg),
    lote: loteLinea(j.lote),
  }
}

function pago(j: Json): PagoProveedorDetalle {
  return {
    id: str(j.id),
    fecha: str(j.fecha),
    monto_usd: num(j.monto_usd),
    moneda_pago: str(j.moneda_pago) as PagoProveedorDetalle['moneda_pago'],
    tasa_pago: num(j.tasa_pago),
    metodo: str(j.metodo) as PagoProveedorDetalle['metodo'],
    ganancia_cambiaria_bs: num(j.ganancia_cambiaria_bs),
  }
}

function contrato(v: unknown): ContratoFactura | null {
  const j = obj(v)
  if (!j || j.id == null) return null
  return {
    id: str(j.id),
    numero: num(j.numero),
    estado: str(j.estado) as ContratoFactura['estado'],
    created_at: str(j.created_at),
    desactualizado: j.desactualizado === true,
  }
}

function propagacion(v: unknown): PropagacionCosto {
  const j = obj(v) ?? {}
  return {
    lotes: arr(j.lotes).map((l) => ({
      lote_id: str(l.lote_id),
      codigo: str(l.codigo),
      origen: str(l.origen) as PropagacionCosto['lotes'][number]['origen'],
      costo_anterior: num(l.costo_anterior),
      costo_nuevo: num(l.costo_nuevo),
    })),
    procesamientos: num(j.procesamientos),
    lineas_factura: num(j.lineas_factura),
    facturas: num(j.facturas),
  }
}

function correccionItem(j: Json): CorreccionCompraItem {
  return {
    compra_item_id: str(j.compra_item_id),
    producto_nombre: str(j.producto_nombre),
    lote_id: strONull(j.lote_id),
    lote_codigo: strONull(j.lote_codigo),
    peso_anterior_kg: num(j.peso_anterior_kg),
    peso_nuevo_kg: num(j.peso_nuevo_kg),
    costo_pactado_anterior: num(j.costo_pactado_anterior),
    costo_pactado_nuevo: num(j.costo_pactado_nuevo),
    costo_anterior_usd_kg: num(j.costo_anterior_usd_kg),
    costo_nuevo_usd_kg: num(j.costo_nuevo_usd_kg),
  }
}

type C = CorreccionCompra

function correccion(j: Json): CorreccionCompra {
  const pa = obj(j.proveedor_anterior) ?? {}
  const pn = obj(j.proveedor_nuevo) ?? {}
  return {
    id: str(j.id),
    proveedor_anterior: { id: str(pa.id), nombre: str(pa.nombre) },
    proveedor_nuevo: { id: str(pn.id), nombre: str(pn.nombre) },
    fecha_anterior: str(j.fecha_anterior),
    fecha_nueva: str(j.fecha_nueva),
    condicion_anterior: str(j.condicion_anterior) as C['condicion_anterior'],
    condicion_nueva: str(j.condicion_nueva) as C['condicion_nueva'],
    moneda_anterior: str(j.moneda_anterior) as C['moneda_anterior'],
    moneda_nueva: str(j.moneda_nueva) as C['moneda_nueva'],
    tasa_anterior: num(j.tasa_anterior),
    tasa_nueva: num(j.tasa_nueva),
    tasa_origen_anterior: str(j.tasa_origen_anterior) as C['tasa_origen_anterior'],
    tasa_origen_nueva: str(j.tasa_origen_nueva) as C['tasa_origen_nueva'],
    tasa_fuente_anterior: strONull(j.tasa_fuente_anterior) as C['tasa_fuente_anterior'],
    tasa_fuente_nueva: strONull(j.tasa_fuente_nueva) as C['tasa_fuente_nueva'],
    tasa_referencial_anterior: numONull(j.tasa_referencial_anterior),
    tasa_referencial_nueva: numONull(j.tasa_referencial_nueva),
    notas_anterior: strONull(j.notas_anterior),
    notas_nueva: strONull(j.notas_nueva),
    subtotal_anterior_usd: num(j.subtotal_anterior_usd),
    subtotal_nuevo_usd: num(j.subtotal_nuevo_usd),
    pagado_anterior_usd: num(j.pagado_anterior_usd),
    pagado_nuevo_usd: num(j.pagado_nuevo_usd),
    pagos_registrados_usd: num(j.pagos_registrados_usd),
    estado_anterior: str(j.estado_anterior) as C['estado_anterior'],
    estado_nuevo: str(j.estado_nuevo) as C['estado_nuevo'],
    contrato_id: strONull(j.contrato_id),
    contrato_numero: numONull(j.contrato_numero),
    propagacion: propagacion(j.propagacion),
    motivo: str(j.motivo),
    usuario_id: str(j.usuario_id),
    usuario_nombre: strONull(j.usuario_nombre),
    created_at: str(j.created_at),
    items: arr(j.items).map(correccionItem),
  }
}

function compraFicha(j: Json): CompraFichaDetalle {
  const p = obj(j.proveedor) ?? {}
  return {
    id: str(j.id),
    fecha: str(j.fecha),
    condicion: str(j.condicion) as CompraFichaDetalle['condicion'],
    moneda: str(j.moneda) as CompraFichaDetalle['moneda'],
    tasa_snapshot: num(j.tasa_snapshot),
    tasa_origen: str(j.tasa_origen) as CompraFichaDetalle['tasa_origen'],
    tasa_fuente: strONull(j.tasa_fuente) as CompraFichaDetalle['tasa_fuente'],
    tasa_referencial: numONull(j.tasa_referencial),
    subtotal_usd: num(j.subtotal_usd),
    pagado_usd: num(j.pagado_usd),
    estado: str(j.estado) as CompraFichaDetalle['estado'],
    notas: strONull(j.notas),
    created_at: str(j.created_at),
    proveedor: {
      id: str(p.id),
      nombre: str(p.nombre),
      rif_ci: strONull(p.rif_ci),
      activo: p.activo !== false,
      bloqueado: p.bloqueado === true,
      motivo_bloqueo: strONull(p.motivo_bloqueo),
    },
  }
}

/** JSON de `detalle_compra` → `DetalleCompra`; `null` si la compra no existe. */
export function mapearDetalleCompra(data: unknown): DetalleCompra | null {
  const j = obj(data)
  const c = obj(j?.compra)
  if (!j || !c) return null
  const va = obj(j.ventas_arbol) ?? {}
  return {
    compra: compraFicha(c),
    pagos_registrados_usd: num(j.pagos_registrados_usd),
    primera_salida: strONull(j.primera_salida),
    ventas_arbol: { lineas: num(va.lineas), facturas: num(va.facturas) },
    lineas: arr(j.lineas).map(linea),
    pagos: arr(j.pagos).map(pago),
    contrato: contrato(j.contrato),
    correcciones: arr(j.correcciones).map(correccion),
  }
}

/** JSON de `editar_compra` → `ResultadoEdicionCompra`. */
export function mapearResultadoEdicionCompra(data: unknown): ResultadoEdicionCompra {
  const j = obj(data) ?? {}
  const ct = obj(j.contrato)
  const pr = obj(j.propagacion) ?? {}
  return {
    correccion_id: str(j.correccion_id),
    subtotal_usd: num(j.subtotal_usd),
    pagado_usd: num(j.pagado_usd),
    saldo_usd: num(j.saldo_usd),
    saldo_a_favor_usd: num(j.saldo_a_favor_usd),
    estado: str(j.estado) as ResultadoEdicionCompra['estado'],
    contrato: ct
      ? { id: str(ct.id), numero: num(ct.numero), estado: str(ct.estado) as NonNullable<ResultadoEdicionCompra['contrato']>['estado'] }
      : null,
    lotes: arr(j.lotes).map((l) => ({ lote_id: str(l.lote_id), codigo: str(l.codigo), delta_kg: num(l.delta_kg) })),
    propagacion: {
      lotes_recalculados: num(pr.lotes_recalculados),
      procesamientos: num(pr.procesamientos),
      lineas_factura: num(pr.lineas_factura),
      facturas: num(pr.facturas),
    },
  }
}
