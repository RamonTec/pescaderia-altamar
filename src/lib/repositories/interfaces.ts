import type {
  Cliente,
  ClienteInput,
  DocumentoCliente,
  Producto,
  Proveedor,
  RepresentanteLegal,
  TipoDocumentoCliente,
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

export interface IClienteRepository {
  list(): Promise<Cliente[]>
  getById(id: string): Promise<Cliente | null>
  create(data: ClienteInput): Promise<Cliente>
  update(id: string, data: Partial<Cliente>): Promise<Cliente>
  delete(id: string): Promise<void>
}

export interface IProveedorRepository {
  list(): Promise<Proveedor[]>
  getById(id: string): Promise<Proveedor | null>
  create(data: Omit<Proveedor, 'id'>): Promise<Proveedor>
  update(id: string, data: Partial<Proveedor>): Promise<Proveedor>
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
