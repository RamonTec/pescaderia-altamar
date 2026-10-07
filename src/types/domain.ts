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
export type TipoMovimiento =
  | 'compra'
  | 'proceso_in'
  | 'proceso_out'
  | 'venta'
  | 'ajuste'

export interface Tasa {
  id: string
  fecha: string
  fuente: FuenteTasa
  bs_por_usd: number
}

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

export interface Compra {
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

export interface PagoProveedor {
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

export interface Factura {
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

export interface FacturaItem {
  id: string
  factura_id: string
  producto_id: string
  peso_kg: number
  precio_usd_kg: number
  costo_usd_kg: number
}

export interface Pago {
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
