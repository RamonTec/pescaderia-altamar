export type Moneda = 'usd' | 'bs'
export type CondicionPago = 'contado' | 'credito'
export type FuenteTasa = 'bcv' | 'paralela' | 'manual'
export type MetodoPago =
  | 'efectivo_usd'
  | 'efectivo_bs'
  | 'pago_movil'
  | 'zelle'
  | 'transferencia'
  | 'punto'
export type TipoProducto = 'crudo' | 'procesado'
export type EstadoPedido = 'pendiente' | 'entregado' | 'facturado' | 'anulado'
export type EstadoDoc = 'abierta' | 'pagada' | 'anulada'
export type EstadoNotaCredito = 'emitida' | 'anulada'
export type TipoMovimiento =
  | 'compra'
  | 'proceso_in'
  | 'proceso_out'
  | 'venta'
  | 'ajuste'

export type MonedaTasa = 'USD' | 'EUR'
export type OrigenTasa = 'bcv_scraping' | 'dolarapi' | 'manual'

export interface Tasa {
  id: string
  /** Fecha valor: la fecha que rige la tasa, no la de consulta (08-tasas). */
  fecha: string
  fuente: FuenteTasa
  moneda: MonedaTasa
  /** Bs por 1 unidad de `moneda` (antes `bs_por_usd`). */
  valor_bs: number
  origen: OrigenTasa
  /** Usuario si es manual; null si es automática. */
  registrada_por: string | null
  /** Hora reportada por la fuente. */
  publicada_en: string | null
  created_at: string
}

/** Procedencia de la tasa congelada en una operación (08-tasas). */
export interface TasaOperacion {
  tasa_origen: 'referencial' | 'manual'
  /** Fuente de la referencial elegida (o de la que se reemplazó). */
  tasa_fuente: 'bcv' | 'paralela' | null
  /** Valor referencial vigente en ese momento; null si no había. */
  tasa_referencial: number | null
  /** Valor final usado por la operación. */
  tasa_snapshot: number
}

/** Resultado de `getTasaVigente`: la tasa y si arrastra una fecha anterior. */
export interface TasaVigente {
  tasa: Tasa
  arrastrada: boolean
  fecha_valor: string
}

/**
 * Procedencia de la tasa congelada que comparten compras, facturas y abonos
 * (08-tasas, migración 0019). El valor final sigue en `tasa_snapshot` /
 * `tasa_pago` de cada entidad; la historia nunca se recalcula (/SPEC.md §2).
 */
export type TasaProcedencia = Pick<TasaOperacion, 'tasa_origen' | 'tasa_fuente' | 'tasa_referencial'>

export interface Producto {
  id: string
  codigo: string | null
  nombre: string
  tipo: TipoProducto
  categoria: string | null
  controla_stock: boolean
  activo: boolean
  /** Crudo del que se obtiene un procesado (0014); `null` en los crudos. */
  producto_origen_id: string | null
}

export interface ConfigNegocio {
  id: number
  iva_pct: number
  fuente_tasa_default: 'bcv' | 'paralela'
  umbral_stock_bajo_kg: number | null
  /** Umbral % de desviación de una tasa manual que pide confirmación (08-tasas). */
  umbral_desviacion_tasa_pct: number
}

export type TipoPersona = 'natural' | 'juridica'
export type TipoDocumentoCliente = 'cedula' | 'rif' | 'otro'

export interface Cliente {
  id: string
  nombre: string
  tipo_persona: TipoPersona
  rif_ci: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  notas: string | null
  limite_credito_usd: number | null
  bloqueado: boolean
  motivo_bloqueo: string | null
  activo: boolean
}

/** Campos que la UI/envío provee al crear; bloqueado/motivo/activo tienen default en BD. */
export type ClienteInput = Omit<Cliente, 'id' | 'bloqueado' | 'motivo_bloqueo' | 'activo'>

export interface RepresentanteLegal {
  id: string
  cliente_id: string
  nombre: string
  cedula: string
  cargo: string | null
  telefono: string | null
}

export interface DocumentoCliente {
  id: string
  cliente_id: string
  tipo: TipoDocumentoCliente
  url_storage: string
}

export interface Proveedor {
  id: string
  nombre: string
  tipo_persona: TipoPersona
  rif_ci: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  contacto_nombre: string | null
  contacto_telefono: string | null
  notas: string | null
  bloqueado: boolean
  motivo_bloqueo: string | null
  activo: boolean
}

export type TipoMetodoPago = 'transferencia' | 'pago_movil' | 'zelle'

export interface MetodoPagoProveedor {
  id: string
  proveedor_id: string
  tipo: TipoMetodoPago
  banco_codigo: string | null
  numero_cuenta: string | null
  tipo_cuenta: 'corriente' | 'ahorro' | null
  telefono: string | null
  email: string | null
  titular: string | null
  titular_rif_ci: string | null
  preferido: boolean
}

export interface RepresentanteProveedor {
  id: string
  proveedor_id: string
  nombre: string
  cedula: string
  cargo: string | null
  telefono: string | null
}

export type TipoDocumentoProveedor = 'cedula' | 'rif' | 'acta_constitutiva' | 'otro'

export interface DocumentoProveedor {
  id: string
  proveedor_id: string
  tipo: TipoDocumentoProveedor
  representante_id: string | null
  url_storage: string
  nombre_original: string | null
  mime_type: string | null
  tamano_bytes: number | null
}

export interface EstadoDocumental {
  completa: boolean
  faltantes: string[]
}

export interface Compra extends TasaProcedencia {
  id: string
  proveedor_id: string
  fecha: string
  condicion: CondicionPago
  moneda: Moneda
  tasa_snapshot: number
  subtotal_usd: number
  pagado_usd: number
  estado: EstadoDoc
  notas: string | null
}

export interface CompraItem {
  id: string
  compra_id: string
  producto_id: string
  peso_kg: number
  /** `null` para operador: se lee de `compra_items_view` (0003). */
  costo_usd_kg: number | null
}

export interface PagoProveedor extends TasaProcedencia {
  id: string
  compra_id: string
  fecha: string
  monto_usd: number
  moneda_pago: Moneda
  tasa_pago: number
  metodo: MetodoPago
  ganancia_cambiaria_bs: number
}

export interface Procesamiento {
  id: string
  fecha: string
  notas: string | null
}

export interface ProcesoItem {
  id: string
  procesamiento_id: string
  producto_origen_id: string
  peso_entrada_kg: number
  producto_destino_id: string
  peso_salida_kg: number
  /** Costo del origen transferido completo al destino (/SPEC.md §4.3). */
  costo_total_usd: number
}

export interface Pedido {
  id: string
  cliente_id: string
  fecha: string
  fecha_entrega: string | null
  estado: EstadoPedido
  notas: string | null
}

export interface PedidoItem {
  id: string
  pedido_id: string
  producto_id: string
  peso_estimado_kg: number
  peso_entregado_kg: number | null
  precio_usd_kg: number
}

export interface Factura extends TasaProcedencia {
  id: string
  numero: number
  cliente_id: string
  pedido_id: string | null
  fecha: string
  condicion: CondicionPago
  tasa_snapshot: number
  iva_pct: number
  subtotal_usd: number
  iva_usd: number
  total_usd: number
  pagado_usd: number
  estado: EstadoDoc
}

export interface NotaCredito {
  id: string
  numero: number
  factura_id: string
  fecha: string
  motivo: string
  subtotal_usd: number
  iva_usd: number
  total_usd: number
  estado: EstadoNotaCredito
}

export interface NotaCreditoItem {
  id: string
  nota_credito_id: string
  factura_item_id: string
  peso_kg: number
  precio_usd_kg: number
  afecta_inventario: boolean
}

export interface FacturaItem {
  id: string
  factura_id: string
  producto_id: string
  peso_kg: number
  precio_usd_kg: number
  costo_usd_kg: number
}

export interface Pago extends TasaProcedencia {
  id: string
  factura_id: string
  fecha: string
  monto_usd: number
  moneda_pago: Moneda
  tasa_pago: number
  metodo: MetodoPago
  ganancia_cambiaria_bs: number
}

export interface Movimiento {
  id: string
  producto_id: string
  fecha: string
  tipo: TipoMovimiento
  peso_kg: number
  costo_usd_kg: number
  ref_id: string | null
}
