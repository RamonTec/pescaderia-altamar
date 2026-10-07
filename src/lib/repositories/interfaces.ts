import type {
  Cliente,
  ClienteInput,
  ConfigNegocio,
  DocumentoCliente,
  DocumentoProveedor,
  MetodoPagoProveedor,
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
