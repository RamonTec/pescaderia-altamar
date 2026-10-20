import type {
  CompraOrigenLote,
  ContratoFactura,
  CorreccionFactura,
  EslabonLoteVendido,
  LineaTrazabilidad,
  LotePadreTrazabilidad,
  NotaCreditoTrazabilidad,
  PagoTrazabilidad,
  ProcesoOrigenLote,
  ResultadoCambioIva,
  ResultadoCorreccion,
  TrazabilidadFactura,
} from '@/types/domain'

/**
 * Mapeo del JSON de las RPC `trazabilidad_factura` / `corregir_linea_factura`
 * (17) / `cambiar_iva_factura` (18) a los tipos de dominio. Sin lógica de negocio: solo forma y números
 * (PostgREST devuelve `numeric` como número o como texto según el caso).
 * Sin imports de Supabase: lo usan el repositorio y los scripts de prueba.
 */

type Json = Record<string, unknown>

const num = (v: unknown): number => Number(v ?? 0)
const numONull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))
const str = (v: unknown): string => String(v ?? '')
const strONull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : [])
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

function compra(j: Json): CompraOrigenLote {
  return {
    compra_id: strONull(j.compra_id),
    fecha: strONull(j.compra_fecha),
    proveedor_id: strONull(j.proveedor_id),
    proveedor_nombre: strONull(j.proveedor_nombre),
  }
}

function lotePadre(j: Json | null): LotePadreTrazabilidad | null {
  if (!j || j.id == null) return null
  return {
    id: str(j.id),
    codigo: str(j.codigo),
    origen: str(j.origen) as LotePadreTrazabilidad['origen'],
    producto_nombre: str(j.producto_nombre),
    fecha_ingreso: str(j.fecha_ingreso),
    costo_usd_kg: num(j.costo_usd_kg),
    moneda: str(j.moneda) as LotePadreTrazabilidad['moneda'],
    tasa_snapshot: num(j.tasa_snapshot),
    peso_inicial_kg: num(j.peso_inicial_kg),
    compra: j.origen === 'compra' ? compra(j) : null,
  }
}

function proceso(j: Json | null): ProcesoOrigenLote | null {
  if (!j) return null
  return {
    procesamiento_id: str(j.procesamiento_id),
    proceso_item_id: str(j.proceso_item_id),
    fecha: str(j.fecha),
    reparto_costo: (strONull(j.reparto_costo) as ProcesoOrigenLote['reparto_costo']) ?? null,
    legado: Boolean(j.legado),
    peso_entrada_kg: num(j.peso_entrada_kg),
    peso_salida_total_kg: num(j.peso_salida_total_kg),
    salidas: num(j.salidas),
    peso_salida_kg: num(j.peso_salida_kg),
    costo_total_usd: num(j.costo_total_usd),
    precio_referencia_usd_kg: numONull(j.precio_referencia_usd_kg),
    lote_padre: lotePadre(obj(j.lote_padre)),
  }
}

function eslabon(j: Json): EslabonLoteVendido {
  const base = {
    fil_id: str(j.fil_id),
    lote_id: str(j.lote_id),
    codigo: str(j.codigo),
    orden: num(j.orden),
    peso_kg: num(j.peso_kg),
    costo_usd_kg: num(j.costo_usd_kg),
    kg_devueltos: num(j.kg_devueltos),
    fecha_ingreso: str(j.fecha_ingreso),
    estado: str(j.estado) as EslabonLoteVendido['estado'],
    stock_kg: num(j.stock_kg),
    moneda: str(j.moneda) as EslabonLoteVendido['moneda'],
    tasa_snapshot: num(j.tasa_snapshot),
    lote_costo_usd_kg: num(j.lote_costo_usd_kg),
  }
  if (j.origen === 'compra') return { ...base, origen: 'compra', compra: compra(j) }
  if (j.origen === 'proceso') return { ...base, origen: 'proceso', proceso: proceso(obj(j.proceso)) }
  return { ...base, origen: 'inicial' }
}

function linea(j: Json): LineaTrazabilidad {
  const p = obj(j.producto) ?? {}
  return {
    id: str(j.id),
    producto: {
      id: str(p.id),
      nombre: str(p.nombre),
      codigo: strONull(p.codigo),
      tipo: str(p.tipo) as LineaTrazabilidad['producto']['tipo'],
      controla_stock: Boolean(p.controla_stock),
      precio_referencia_usd_kg: numONull(p.precio_referencia_usd_kg),
    },
    peso_kg: num(j.peso_kg),
    precio_usd_kg: num(j.precio_usd_kg),
    costo_usd_kg: num(j.costo_usd_kg),
    kg_devueltos: num(j.kg_devueltos),
    lotes: arr(j.lotes).map(eslabon),
  }
}

function nota(j: Json, facturaId: string): NotaCreditoTrazabilidad {
  return {
    id: str(j.id),
    numero: num(j.numero),
    factura_id: facturaId,
    fecha: str(j.fecha),
    motivo: str(j.motivo),
    estado: str(j.estado) as NotaCreditoTrazabilidad['estado'],
    subtotal_usd: num(j.subtotal_usd),
    iva_usd: num(j.iva_usd),
    total_usd: num(j.total_usd),
    items: arr(j.items).map((i) => ({
      id: str(i.id),
      factura_item_id: str(i.factura_item_id),
      peso_kg: num(i.peso_kg),
      precio_usd_kg: num(i.precio_usd_kg),
      afecta_inventario: Boolean(i.afecta_inventario),
    })),
  }
}

function pago(j: Json): PagoTrazabilidad {
  return {
    id: str(j.id),
    fecha: str(j.fecha),
    monto_usd: num(j.monto_usd),
    moneda_pago: str(j.moneda_pago) as PagoTrazabilidad['moneda_pago'],
    tasa_pago: num(j.tasa_pago),
    metodo: str(j.metodo) as PagoTrazabilidad['metodo'],
    ganancia_cambiaria_bs: num(j.ganancia_cambiaria_bs),
  }
}

function movimientos(v: unknown) {
  return arr(v).map((m) => ({ lote_id: strONull(m.lote_id), codigo: strONull(m.codigo), peso_kg: num(m.peso_kg) }))
}

/** Correcciones por `tipo` (18): `linea` (17, el default de filas viejas) o `iva`. */
function correccion(j: Json): CorreccionFactura {
  const comun = {
    id: str(j.id),
    subtotal_anterior_usd: num(j.subtotal_anterior_usd),
    subtotal_nuevo_usd: num(j.subtotal_nuevo_usd),
    iva_anterior_usd: num(j.iva_anterior_usd),
    iva_nuevo_usd: num(j.iva_nuevo_usd),
    total_anterior_usd: num(j.total_anterior_usd),
    total_nuevo_usd: num(j.total_nuevo_usd),
    pagado_usd: num(j.pagado_usd),
    estado_anterior: str(j.estado_anterior) as CorreccionFactura['estado_anterior'],
    estado_nuevo: str(j.estado_nuevo) as CorreccionFactura['estado_nuevo'],
    contrato_id: strONull(j.contrato_id),
    contrato_numero: numONull(j.contrato_numero),
    motivo: str(j.motivo),
    usuario_id: str(j.usuario_id),
    usuario_nombre: strONull(j.usuario_nombre),
    created_at: str(j.created_at),
  }
  if (j.tipo === 'iva') {
    return {
      ...comun,
      tipo: 'iva',
      factura_item_id: null,
      iva_pct_anterior: num(j.iva_pct_anterior),
      iva_pct_nuevo: num(j.iva_pct_nuevo),
      creditos_anterior_usd: num(j.creditos_anterior_usd),
      creditos_nuevo_usd: num(j.creditos_nuevo_usd),
    }
  }
  return {
    ...comun,
    tipo: 'linea',
    factura_item_id: str(j.factura_item_id),
    producto_nombre: str(j.producto_nombre),
    peso_anterior_kg: num(j.peso_anterior_kg),
    peso_nuevo_kg: num(j.peso_nuevo_kg),
    precio_anterior_usd_kg: num(j.precio_anterior_usd_kg),
    precio_nuevo_usd_kg: num(j.precio_nuevo_usd_kg),
    costo_anterior_usd_kg: num(j.costo_anterior_usd_kg),
    costo_nuevo_usd_kg: num(j.costo_nuevo_usd_kg),
    movimientos: movimientos(j.movimientos),
  }
}

function contrato(j: Json | null): ContratoFactura | null {
  if (!j) return null
  return {
    id: str(j.id),
    numero: num(j.numero),
    estado: str(j.estado) as ContratoFactura['estado'],
    created_at: str(j.created_at),
    desactualizado: Boolean(j.desactualizado),
  }
}

/** JSON de `trazabilidad_factura` → `TrazabilidadFactura` (`null` si no existe). */
export function mapearTrazabilidad(data: unknown): TrazabilidadFactura | null {
  const raiz = obj(data)
  const f = raiz ? obj(raiz.factura) : null
  if (!raiz || !f) return null
  const c = obj(f.cliente) ?? {}
  const facturaId = str(f.id)
  return {
    factura: {
      id: facturaId,
      numero: num(f.numero),
      fecha: str(f.fecha),
      condicion: str(f.condicion) as TrazabilidadFactura['factura']['condicion'],
      dias_credito: num(f.dias_credito),
      fecha_vencimiento: str(f.fecha_vencimiento),
      estado: str(f.estado) as TrazabilidadFactura['factura']['estado'],
      tasa_snapshot: num(f.tasa_snapshot),
      tasa_origen: str(f.tasa_origen) as TrazabilidadFactura['factura']['tasa_origen'],
      tasa_fuente: strONull(f.tasa_fuente) as TrazabilidadFactura['factura']['tasa_fuente'],
      tasa_referencial: numONull(f.tasa_referencial),
      iva_pct: num(f.iva_pct),
      subtotal_usd: num(f.subtotal_usd),
      iva_usd: num(f.iva_usd),
      total_usd: num(f.total_usd),
      pagado_usd: num(f.pagado_usd),
      created_at: str(f.created_at),
      cliente: {
        id: str(c.id),
        nombre: str(c.nombre),
        rif_ci: strONull(c.rif_ci),
        limite_credito_usd: numONull(c.limite_credito_usd),
        bloqueado: Boolean(c.bloqueado),
      },
    },
    lineas: arr(raiz.lineas).map(linea),
    notas_credito: arr(raiz.notas_credito).map((n) => nota(n, facturaId)),
    pagos: arr(raiz.pagos).map(pago),
    correcciones: arr(raiz.correcciones).map(correccion),
    contrato: contrato(obj(raiz.contrato)),
  }
}

/** JSON de `corregir_linea_factura` → `ResultadoCorreccion`. */
export function mapearResultadoCorreccion(data: unknown): ResultadoCorreccion {
  const j = obj(data) ?? {}
  const ct = obj(j.contrato)
  return {
    correccion_id: str(j.correccion_id),
    subtotal_usd: num(j.subtotal_usd),
    iva_usd: num(j.iva_usd),
    total_usd: num(j.total_usd),
    pagado_usd: num(j.pagado_usd),
    saldo_usd: num(j.saldo_usd),
    saldo_a_favor_usd: num(j.saldo_a_favor_usd),
    estado: str(j.estado) as ResultadoCorreccion['estado'],
    contrato: ct ? { id: str(ct.id), numero: num(ct.numero), estado: str(ct.estado) as ContratoFactura['estado'] } : null,
    lotes: movimientos(j.lotes),
  }
}

/** JSON de `cambiar_iva_factura` (18) → `ResultadoCambioIva`. */
export function mapearResultadoCambioIva(data: unknown): ResultadoCambioIva {
  const j = obj(data) ?? {}
  const ct = obj(j.contrato)
  return {
    correccion_id: str(j.correccion_id),
    iva_pct: num(j.iva_pct),
    subtotal_usd: num(j.subtotal_usd),
    iva_usd: num(j.iva_usd),
    total_usd: num(j.total_usd),
    pagado_usd: num(j.pagado_usd),
    creditos_usd: num(j.creditos_usd),
    saldo_usd: num(j.saldo_usd),
    saldo_a_favor_usd: num(j.saldo_a_favor_usd),
    estado: str(j.estado) as ResultadoCambioIva['estado'],
    contrato: ct ? { id: str(ct.id), numero: num(ct.numero), estado: str(ct.estado) as ContratoFactura['estado'] } : null,
  }
}
