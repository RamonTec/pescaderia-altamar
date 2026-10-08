import type {
  CanalRecordatorioId,
  Cliente,
  ClienteInput,
  CondicionPago,
  ClienteInactivo,
  Compra,
  CompraItem,
  ConfigNegocio,
  Contrato,
  ContratoListado,
  ContratoPendienteFirma,
  DashboardOperativo,
  Deudor,
  DocumentoCliente,
  DocumentoProveedor,
  DevolucionLote,
  EstadoContrato,
  EstadoDoc,
  EstadoLote,
  ExposicionCambiaria,
  Factura,
  FacturaItem,
  FilaFlujo,
  FilaMezclaVentas,
  FilaTopCliente,
  KpisDia,
  Lote,
  LoteCreado,
  MermaProceso,
  MetodoPagoProveedor,
  MotivoPerdida,
  NotaCredito,
  NotaCreditoItem,
  Pago,
  PagoProveedor,
  Pedido,
  PedidoItem,
  PerdidaLote,
  PerdidaPorMotivo,
  Procesamiento,
  ProcesoItem,
  ProcesoLote,
  Producto,
  ProductoSalida,
  Proveedor,
  PuntoSpread,
  RangoFechas,
  RecordatorioCobro,
  RepresentanteLegal,
  RendimientoProveedor,
  RepresentanteProveedor,
  ResultadoCambiario,
  SugerenciaLotes,
  TipoContrato,
  TipoDocumentoCliente,
  TipoDocumentoProveedor,
  TramoAging,
  TramoAntiguedad,
  VentaLote,
  VentaMensual,
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

/** Resultado de `registrar_compra`: la compra y los lotes creados (sin costos). */
export interface CompraRegistrada {
  compra_id: string
  lotes: LoteCreado[]
}

export interface FiltrosCompras {
  estado?: Compra['estado'] | 'todas' | null
  /** Búsqueda genérica (por ej. nombre de proveedor). */
  q?: string
  /** Página 0-based. */
  page: number
  pageSize: number
}

export interface PaginaCompras {
  rows: CompraResumen[]
  total: number
}

export interface ICompraRepository {
  /**
   * Inserta compra + items + un lote y un movimiento `compra` por item en una
   * sola transacción (RPC `registrar_compra`, 07-lotes).
   */
  create(compra: Compra, items: CompraItemNuevo[]): Promise<CompraRegistrada>
  list(filtros: FiltrosCompras): Promise<PaginaCompras>
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
  cliente: Pick<Cliente, 'id' | 'nombre' | 'rif_ci' | 'bloqueado' | 'dias_credito'>
}

export interface PedidoDetalle extends PedidoResumen {
  items: (PedidoItem & { producto: Pick<Producto, 'id' | 'nombre' | 'codigo'> })[]
}

export interface IPedidoRepository {
  /** Inserta pedido + items en una transacción (RPC `registrar_pedido`). */
  create(pedido: Pedido, items: PedidoItemNuevo[]): Promise<string>
  list(filtros: {
    page: number
    pageSize: number
    q?: string
    estado?: Pedido['estado'] | 'todos'
  }): Promise<{ rows: PedidoResumen[]; total: number }>
  getById(id: string): Promise<PedidoDetalle | null>
  /** Pedidos de un cliente, del más reciente al más antiguo (ficha del cliente). */
  listByCliente(clienteId: string): Promise<Pedido[]>
}

/**
 * Línea a facturar. Sin costo: lo calcula la RPC desde los lotes (07-lotes,
 * hallazgo 1). `asignaciones` es la elección del vendedor; sin ella, la RPC
 * asigna PEPS.
 */
export type FacturaItemNuevo = Pick<FacturaItem, 'producto_id' | 'peso_kg' | 'precio_usd_kg'> & {
  asignaciones?: Pick<AsignacionLoteNueva, 'lote_id' | 'peso_kg'>[]
}

export interface AsignacionLoteNueva {
  lote_id: string
  peso_kg: number
}

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
  /**
   * Días de crédito otorgados (contado: 0). `fecha_vencimiento` la deriva la
   * base (`fecha + dias_credito`, 09-cuentas-por-cobrar).
   */
  dias_credito: number
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
  /**
   * Inserta factura + items + asignación por lote + movimientos `venta` (y
   * cierra el pedido) en una transacción (RPC `registrar_factura`, 07-lotes).
   */
  create(
    factura: FacturaNueva,
    items: FacturaItemNuevo[],
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
  list(params?: {
    page?: number
    pageSize?: number
    q?: string
    estado?: NotaCredito['estado'] | 'todos'
  }): Promise<{ rows: NotaCreditoResumen[]; total: number }>
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

/** Línea a procesar: el costo lo calcula la base desde el lote (RPC `registrar_procesamiento`). */
export type ProcesoItemNuevo = Pick<
  ProcesoItem,
  'lote_origen_id' | 'producto_origen_id' | 'peso_entrada_kg' | 'producto_destino_id' | 'peso_salida_kg'
>

/** Resultado de `registrar_procesamiento`: los lotes procesados creados (sin costos). */
export interface ProcesamientoRegistrado {
  procesamiento_id: string
  lotes: LoteCreado[]
}

export interface IProcesamientoRepository {
  /**
   * Inserta procesamiento + líneas + lote procesado + movimientos
   * `proceso_out`/`proceso_in` en una sola transacción, con el costo del lote
   * de origen (07-lotes).
   */
  create(procesamiento: Procesamiento, items: ProcesoItemNuevo[]): Promise<ProcesamientoRegistrado>
  list(): Promise<ProcesamientoResumen[]>
}

/* ===================== CUENTAS POR COBRAR (09) ===================== */

/** Fila de `cartera_clientes_view`: saldos `null` para el operador. */
export interface FilaCarteraCliente {
  cliente_id: string
  pagadas: number
  pendientes: number
  por_vencer: number
  vencidas: number
  anuladas: number
  saldo_usd: number | null
  saldo_vencido_usd: number | null
  vencida_mas_antigua_dias: number | null
  ultimo_recordatorio_fecha: string | null
  ultimo_recordatorio_canal: CanalRecordatorioId | null
}

/** Factura con la suma de sus notas de crédito emitidas (para cartera). */
export interface FacturaCartera extends FacturaResumen {
  creditos_usd: number
}

export interface ICarteraRepository {
  /** Resumen de todos los clientes en una consulta a la vista (sin N+1). */
  resumenPorCliente(): Promise<FilaCarteraCliente[]>
  /** Facturas de un cliente + créditos emitidos, en una consulta con embedding. */
  documentosPorCliente(clienteId: string): Promise<FacturaCartera[]>
  /** Facturas `abierta` de todos los clientes (`/cobros`). */
  documentosAbiertos(): Promise<FacturaCartera[]>
}

export type RecordatorioNuevo = Pick<
  RecordatorioCobro,
  | 'id'
  | 'cliente_id'
  | 'canal'
  | 'destinatario'
  | 'asunto'
  | 'estado'
  | 'error'
  | 'proveedor_id_mensaje'
> & { mensaje: string }

export interface IRecordatorioRepository {
  /** Recordatorio + facturas incluidas en una transacción (RPC `registrar_recordatorio_cobro`). */
  registrar(recordatorio: RecordatorioNuevo, facturaIds: string[]): Promise<string>
  /** Historial del cliente, del más reciente al más antiguo. */
  listByCliente(clienteId: string): Promise<RecordatorioCobro[]>
  /** Último recordatorio no fallido del cliente. */
  ultimoPorCliente(clienteId: string): Promise<RecordatorioCobro | null>
  getById(id: string): Promise<RecordatorioCobro | null>
}

/* ========================= LOTES (07) ========================= */

export interface FiltrosLotes {
  estado?: EstadoLote | null
  productoId?: string | null
  proveedorId?: string | null
  /** Búsqueda por código (contiene, sin distinguir mayúsculas). */
  codigo?: string
  /** Página 0-based. */
  page: number
  pageSize: number
}

export interface PaginaLotes {
  rows: Lote[]
  total: number
}

export interface PerdidaNueva {
  lote_id: string
  peso_kg: number
  motivo: Exclude<MotivoPerdida, 'cierre'>
  detalle: string | null
  fecha?: string
}

/** Lo que le pasó a los lotes de un árbol (sin el árbol). */
export interface MovimientosArbolLote {
  procesos: ProcesoLote[]
  ventas: VentaLote[]
  perdidas: PerdidaLote[]
  devoluciones: DevolucionLote[]
}

/** Lotes generados por una compra o un procesamiento, para listados. */
export type LoteDeOrigen = Pick<
  Lote,
  | 'id'
  | 'codigo'
  | 'compra_id'
  | 'procesamiento_id'
  | 'proceso_item_id'
  | 'lote_padre_id'
  | 'lote_padre_codigo'
  | 'producto_nombre'
  | 'peso_inicial_kg'
  | 'estado'
>

export interface ILoteRepository {
  /** Lotes `abierto` con stock de un producto, en orden PEPS (fecha de ingreso, código). */
  listAbiertos(productoId: string): Promise<Lote[]>
  /** Todos los lotes `abierto` (valorización y pestaña Productos). */
  listAbiertosTodos(): Promise<Lote[]>
  /** Página de lotes con filtros (paginación en servidor). */
  list(filtros: FiltrosLotes): Promise<PaginaLotes>
  getById(id: string): Promise<Lote | null>
  /** El lote y sus lotes procesados hijos. */
  getArbol(loteId: string): Promise<Lote[]>
  /** Procesamientos, ventas, pérdidas y devoluciones de los lotes dados. */
  getMovimientosArbol(lotes: Lote[]): Promise<MovimientosArbolLote>
  /** Lotes creados por unas compras o unos procesamientos (chips de los listados). */
  listByOrigen(origen: { compraIds?: string[]; procesamientoIds?: string[] }): Promise<LoteDeOrigen[]>
  /** Asignación PEPS propuesta (RPC `sugerir_lotes`, sin costos). */
  sugerir(productoId: string, pesoKg: number): Promise<SugerenciaLotes>
  /** Pérdida + movimiento `perdida` (RPC `registrar_perdida`). */
  registrarPerdida(perdida: PerdidaNueva): Promise<string>
  /** Baja del remanente (motivo `cierre`) y estado `cerrado` (RPC `cerrar_lote`). */
  cerrar(loteId: string, detalle: string | null, pesoEsperadoKg: number | null): Promise<{ peso_baja_kg: number }>
}

/* ========================= CONTRATOS (06) ========================= */

/** Fila nueva de `contratos` (`numero` reservado con `siguienteNumero`); `estado`, `fecha_vencimiento` y auditoría los pone la base. */
export type ContratoNuevo = Pick<
  Contrato,
  'id' | 'numero' | 'tipo' | 'factura_id' | 'compra_id' | 'fecha' | 'dias_credito' | 'url_storage' | 'notas'
>

export interface FiltrosContratosRepo {
  tipo?: TipoContrato
  /** `activos` = generado, enviado o firmado. */
  estado: EstadoContrato | 'activos' | 'todos'
  /** Texto libre sobre `contratos_listado_view.busqueda` (minúsculas). */
  q?: string
  /** Página 0-based. */
  page: number
  pageSize: number
}

export interface PaginaContratos {
  rows: ContratoListado[]
  total: number
}

/** Datos mínimos de un documento de origen para decidir si admite contrato. */
export interface OrigenContrato {
  id: string
  condicion: CondicionPago
  estado: EstadoDoc
}

/** Contrato activo de un origen (para la elegibilidad). */
export type ContratoActivoOrigen = Pick<Contrato, 'id' | 'numero' | 'estado' | 'factura_id' | 'compra_id'>

/** Error `23505` del índice de contrato activo, tipado para que el servicio lo reconozca. */
export class ContratoActivoDuplicadoError extends Error {
  readonly code = '23505'
  constructor(message = 'Ya existe un contrato activo para este documento') {
    super(message)
    this.name = 'ContratoActivoDuplicadoError'
  }
}

export interface IContratoRepository {
  /** Reserva el siguiente `numero` (RPC `siguiente_numero_contrato`, solo admin). */
  siguienteNumero(): Promise<number>
  /** Inserta la fila. Lanza `ContratoActivoDuplicadoError` ante `23505`. */
  create(contrato: ContratoNuevo): Promise<Contrato>
  getById(id: string): Promise<Contrato | null>
  /** Página de `contratos_listado_view`, orden `fecha desc, numero desc`. */
  list(filtros: FiltrosContratosRepo): Promise<PaginaContratos>
  /** Contratos no anulados de esas facturas (una consulta). */
  activosPorFacturas(ids: string[]): Promise<ContratoActivoOrigen[]>
  /** Contratos no anulados de esas compras (una consulta). */
  activosPorCompras(ids: string[]): Promise<ContratoActivoOrigen[]>
  updateEstado(id: string, estado: EstadoContrato): Promise<Contrato>
  /** Condición y estado de esas facturas (una consulta). */
  origenesFacturas(ids: string[]): Promise<OrigenContrato[]>
  /** Condición y estado de esas compras (una consulta). */
  origenesCompras(ids: string[]): Promise<OrigenContrato[]>
}

/** PDFs en el bucket privado `contratos`. Solo rutas; la URL firmada nunca se guarda. */
export interface IContratoArchivoRepository {
  /** Sube con `upsert: false` (el PDF es inmutable). */
  subir(ruta: string, bytes: Uint8Array): Promise<void>
  eliminar(ruta: string): Promise<void>
  urlFirmada(ruta: string, ttlSegundos: number, nombreDescarga?: string): Promise<string>
}

/* ==================== Dashboard (15) ==================== */

/** Fila de `dashboard_valor_inventario()` (sin Bs: la conversión es del servicio). */
export interface FilaValorInventario {
  producto_id: string
  producto_nombre: string
  lotes: number
  stock_kg: number
  valor_usd: number
}

/**
 * Solo llamadas a las RPC `dashboard_*` y conversión `numeric` → `number`.
 * Las de importes fallan con `42501` si el usuario no es admin; el servicio
 * no las invoca para el operador.
 */
export interface IDashboardRepository {
  operativo(): Promise<DashboardOperativo>
  antiguedadLotes(): Promise<TramoAntiguedad[]>
  /** Sin `margen_pct` ni `inventario_bs`: los completa el servicio. */
  kpisDia(): Promise<Omit<KpisDia, 'margen_pct' | 'inventario_bs'>>
  ventasMensuales(rango: RangoFechas): Promise<VentaMensual[]>
  productosSalida(rango: RangoFechas): Promise<ProductoSalida[]>
  spreadPrecioCosto(rango: RangoFechas, productoId: string | null): Promise<PuntoSpread[]>
  mezclaVentas(rango: RangoFechas): Promise<FilaMezclaVentas[]>
  topClientes(rango: RangoFechas, limite: number): Promise<FilaTopCliente[]>
  clientesInactivos(dias: number): Promise<ClienteInactivo[]>
  resultadoCambiario(rango: RangoFechas): Promise<ResultadoCambiario>
  mermaProcesos(rango: RangoFechas): Promise<MermaProceso[]>
  rendimientoProveedor(rango: RangoFechas): Promise<RendimientoProveedor[]>
  perdidasMotivo(rango: RangoFechas): Promise<PerdidaPorMotivo[]>
  valorInventario(): Promise<FilaValorInventario[]>
  agingCartera(): Promise<TramoAging[]>
  topDeudores(limite: number): Promise<Deudor[]>
  flujoProyectado(dias: number): Promise<FilaFlujo[]>
  exposicionCambiaria(): Promise<ExposicionCambiaria>
  contratosSinFirmar(): Promise<ContratoPendienteFirma[]>
}
