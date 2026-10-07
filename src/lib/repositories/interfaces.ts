import type {
  Cliente,
  ClienteInput,
  Compra,
  CompraItem,
  ConfigNegocio,
  DocumentoCliente,
  DocumentoProveedor,
  Factura,
  FacturaItem,
  MetodoPagoProveedor,
  Movimiento,
  NotaCredito,
  NotaCreditoItem,
  Pago,
  PagoProveedor,
  Pedido,
  PedidoItem,
  Procesamiento,
  ProcesoItem,
  Producto,
  Proveedor,
  RepresentanteLegal,
  RepresentanteProveedor,
  TipoDocumentoCliente,
  TipoDocumentoProveedor,
} from '@/types/domain'

/**
 * Contratos de repositorio (DIP): los servicios dependen de estas
 * interfaces, no de Supabase. Permite mocks en tests.
 */

export interface IProductoRepository {
  list(): Promise<Producto[]>
  getById(id: string): Promise<Producto | null>
  create(data: Omit<Producto, 'id'>): Promise<Producto>
  update(id: string, data: Partial<Producto>): Promise<Producto>
  delete(id: string): Promise<void>
}

export interface IConfigNegocioRepository {
  get(): Promise<ConfigNegocio | null>
  update(data: Partial<Omit<ConfigNegocio, 'id'>>): Promise<ConfigNegocio>
}

export interface IClienteRepository {
  list(): Promise<Cliente[]>
  getById(id: string): Promise<Cliente | null>
  create(data: ClienteInput): Promise<Cliente>
  update(id: string, data: Partial<Cliente>): Promise<Cliente>
  delete(id: string): Promise<void>
}

export interface ProveedorResumen extends Proveedor {
  representantes_proveedor: RepresentanteProveedor[]
  documentos_proveedor: Pick<DocumentoProveedor, 'tipo' | 'representante_id'>[]
  metodos_pago_proveedor: MetodoPagoProveedor[]
}

export interface IProveedorRepository {
  list(options?: { incluirInactivos?: boolean }): Promise<Proveedor[]>
  listConResumen(): Promise<ProveedorResumen[]>
  getById(id: string): Promise<Proveedor | null>
  create(data: Omit<Proveedor, 'id' | 'bloqueado' | 'motivo_bloqueo' | 'activo'>): Promise<Proveedor>
  update(id: string, data: Partial<Proveedor>): Promise<Proveedor>
  countCompras(id: string): Promise<number>
  delete(id: string): Promise<void>
}

export interface IRepresentanteLegalRepository {
  listByCliente(clienteId: string): Promise<RepresentanteLegal[]>
  create(data: Omit<RepresentanteLegal, 'id'>): Promise<RepresentanteLegal>
  update(id: string, data: Partial<RepresentanteLegal>): Promise<RepresentanteLegal>
  delete(id: string): Promise<void>
}

export interface IDocumentoClienteRepository {
  listByCliente(clienteId: string): Promise<DocumentoCliente[]>
  create(clienteId: string, tipo: TipoDocumentoCliente, file: File): Promise<DocumentoCliente>
  getUrlDescarga(id: string): Promise<string | null>
  delete(id: string): Promise<void>
}

export interface IRepresentanteProveedorRepository {
  listByProveedor(proveedorId: string): Promise<RepresentanteProveedor[]>
  create(data: Omit<RepresentanteProveedor, 'id'>): Promise<RepresentanteProveedor>
  update(id: string, data: Partial<RepresentanteProveedor>): Promise<RepresentanteProveedor>
  delete(id: string): Promise<void>
}

export interface IMetodoPagoProveedorRepository {
  listByProveedor(proveedorId: string): Promise<MetodoPagoProveedor[]>
  create(data: Omit<MetodoPagoProveedor, 'id'>): Promise<MetodoPagoProveedor>
  update(id: string, data: Partial<MetodoPagoProveedor>): Promise<MetodoPagoProveedor>
  delete(id: string): Promise<void>
}

export interface IDocumentoProveedorRepository {
  listByProveedor(proveedorId: string): Promise<DocumentoProveedor[]>
  create(
    proveedorId: string,
    tipo: TipoDocumentoProveedor,
    file: File,
    options?: { representanteId?: string }
  ): Promise<DocumentoProveedor>
  getUrlDescarga(id: string): Promise<string | null>
  delete(id: string): Promise<void>
}

/** Movimiento listo para insertar; lo construye `crearMovimiento` (movimientoService). */
export type MovimientoNuevo = Omit<Movimiento, 'id' | 'fecha'>

export interface IMovimientoRepository {
  create(movimiento: MovimientoNuevo): Promise<void>
}

/** Compra con el nombre del proveedor, para listados. */
export interface CompraResumen extends Compra {
  proveedor: Pick<Proveedor, 'id' | 'nombre' | 'rif_ci' | 'bloqueado'>
}

export interface CompraDetalle extends CompraResumen {
  items: (CompraItem & { producto: Pick<Producto, 'id' | 'nombre' | 'codigo'> })[]
  pagos: PagoProveedor[]
}

export type CompraItemNuevo = Pick<CompraItem, 'producto_id' | 'peso_kg'> & { costo_usd_kg: number }
export type PagoProveedorNuevo = Omit<PagoProveedor, 'id'>

export interface ICompraRepository {
  /** Inserta compra + items + movimientos en una sola transacción (RPC `registrar_compra`). */
  create(compra: Compra, items: CompraItemNuevo[], movimientos: MovimientoNuevo[]): Promise<string>
  list(): Promise<CompraResumen[]>
  getById(id: string): Promise<CompraDetalle | null>
  /** Compras con saldo (`estado = 'abierta'`) de un proveedor. */
  listAbiertasByProveedor(
    proveedorId: string
  ): Promise<Pick<Compra, 'id' | 'subtotal_usd' | 'pagado_usd'>[]>
  /** Inserta el pago y actualiza `pagado_usd`/`estado` (RPC `registrar_pago_proveedor`). */
  registrarPago(pago: PagoProveedorNuevo): Promise<string>
}

/* ============================ VENTAS (05-ventas) ============================ */

export type PedidoItemNuevo = Pick<PedidoItem, 'producto_id' | 'peso_estimado_kg' | 'precio_usd_kg'>

export interface PedidoResumen extends Pedido {
  cliente: Pick<Cliente, 'id' | 'nombre' | 'rif_ci' | 'bloqueado'>
}

export interface PedidoDetalle extends PedidoResumen {
  items: (PedidoItem & { producto: Pick<Producto, 'id' | 'nombre' | 'codigo'> })[]
}

export interface IPedidoRepository {
  /** Inserta pedido + items en una transacción (RPC `registrar_pedido`). */
  create(pedido: Pedido, items: PedidoItemNuevo[]): Promise<string>
  list(filtroEstado?: Pedido['estado']): Promise<PedidoResumen[]>
  getById(id: string): Promise<PedidoDetalle | null>
}

export type FacturaItemNuevo = Pick<FacturaItem, 'producto_id' | 'peso_kg' | 'precio_usd_kg' | 'costo_usd_kg'>

export interface FacturaResumen extends Factura {
  cliente: Pick<Cliente, 'id' | 'nombre' | 'rif_ci'>
}

export interface FacturaDetalle extends FacturaResumen {
  items: (FacturaItem & { producto: Pick<Producto, 'id' | 'nombre' | 'codigo'> })[]
  pagos: Pago[]
  notas_credito: NotaCredito[]
}

export interface FacturaNueva {
  id: string
  cliente_id: string
  fecha: string
  condicion: Factura['condicion']
  tasa_snapshot: number
  iva_pct: number
  subtotal_usd: number
  iva_usd: number
  total_usd: number
  pagado_usd: number
  estado: Factura['estado']
  /** Procedencia de la tasa (08-tasas): origen, fuente y referencial vigente. */
  tasa_origen: Factura['tasa_origen']
  tasa_fuente: Factura['tasa_fuente']
  tasa_referencial: Factura['tasa_referencial']
}

export interface PesosRealesItem {
  pedido_item_id: string
  peso_kg: number
}

export interface IFacturaRepository {
  /** Inserta factura + items + movimientos (y cierra el pedido) en una transacción (RPC `registrar_factura`). */
  create(
    factura: FacturaNueva,
    items: FacturaItemNuevo[],
    movimientos: MovimientoNuevo[],
    pedidoId?: string,
    pesosReales?: PesosRealesItem[]
  ): Promise<string>
  list(filtroEstado?: Factura['estado']): Promise<FacturaResumen[]>
  getById(id: string): Promise<FacturaDetalle | null>
  getByCliente(clienteId: string): Promise<FacturaResumen[]>
  /** Facturas abiertas de un cliente (para saldo pendiente). */
  listAbiertasByCliente(
    clienteId: string
  ): Promise<Pick<Factura, 'id' | 'total_usd' | 'pagado_usd'>[]>
}

export type PagoNuevo = Omit<Pago, 'id'>

export interface IPagoRepository {
  /** Inserta el pago y actualiza `pagado_usd`/`estado` (RPC `registrar_pago`). */
  create(pago: PagoNuevo): Promise<string>
  listByFactura(facturaId: string): Promise<Pago[]>
}

export type NotaCreditoItemNuevo = Pick<
  NotaCreditoItem,
  'factura_item_id' | 'peso_kg' | 'precio_usd_kg' | 'afecta_inventario'
>

export interface NotaCreditoNueva {
  id: string
  factura_id: string
  fecha: string
  motivo: string
  subtotal_usd: number
  iva_usd: number
  total_usd: number
}

export interface NotaCreditoResumen extends NotaCredito {
  factura: { numero: number; cliente: Pick<Cliente, 'id' | 'nombre'> }
}

export interface NotaCreditoDetalle extends NotaCreditoResumen {
  items: (NotaCreditoItem & { producto: Pick<Producto, 'id' | 'nombre'> })[]
}

export interface INotaCreditoRepository {
  /** Inserta nota + items + movimientos de ajuste en una transacción (RPC `registrar_nota_credito`). */
  create(nota: NotaCreditoNueva, items: NotaCreditoItemNuevo[]): Promise<string>
  /** Pasa la nota a `anulada` y revierte su efecto en inventario (RPC `anular_nota_credito`). */
  anular(id: string): Promise<void>
  list(filtroEstado?: NotaCredito['estado']): Promise<NotaCreditoResumen[]>
  getById(id: string): Promise<NotaCreditoDetalle | null>
  listByFactura(facturaId: string): Promise<NotaCreditoResumen[]>
  /** Total de notas `emitida` asociadas a las facturas de un cliente. */
  totalEmitidoByCliente(clienteId: string): Promise<number>
}

type ProductoRef = Pick<Producto, 'id' | 'nombre' | 'codigo'>

export interface ProcesoItemDetalle extends ProcesoItem {
  origen: ProductoRef
  destino: ProductoRef
}

export interface ProcesamientoResumen extends Procesamiento {
  created_at: string
  proceso_items: ProcesoItemDetalle[]
}

/** Lote a procesar: el costo lo calcula la base (RPC `registrar_procesamiento`). */
export type ProcesoItemNuevo = Pick<
  ProcesoItem,
  'producto_origen_id' | 'peso_entrada_kg' | 'producto_destino_id' | 'peso_salida_kg'
>

export interface IProcesamientoRepository {
  /**
   * Inserta procesamiento + lotes + movimientos `proceso_out`/`proceso_in` en
   * una sola transacción, con el costo promedio vigente del origen.
   */
  create(procesamiento: Procesamiento, items: ProcesoItemNuevo[]): Promise<string>
  list(): Promise<ProcesamientoResumen[]>
}
