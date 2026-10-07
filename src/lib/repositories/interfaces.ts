import type {
  Cliente,
  ClienteInput,
  Compra,
  CompraItem,
  ConfigNegocio,
  DocumentoCliente,
  DocumentoProveedor,
  MetodoPagoProveedor,
  Movimiento,
  PagoProveedor,
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
