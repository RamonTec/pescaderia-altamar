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
  rif_ci: string | null
  telefono: string | null
  notas: string | null
  activo: boolean
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
  costo_usd_kg: number
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
