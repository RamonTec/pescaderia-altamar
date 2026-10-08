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
  /** Pérdida o cierre de un lote fuera del procesamiento (07-lotes). */
  | 'perdida'

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
  /** Días de crédito si el cliente no tiene los suyos (09-cuentas-por-cobrar). */
  dias_credito_default: number
  /** Una factura pasa a "por vencer" cuando le quedan ≤ estos días. */
  dias_aviso_por_vencer: number
  /** Datos de pago (Pago Móvil, cuentas, Zelle) que se incluyen en los recordatorios. */
  instrucciones_pago: string | null
  nombre_comercial: string | null
  /** `reply_to` de los correos de cobranza. */
  email_respuesta: string | null
  /** Días desde el ingreso a partir de los cuales un lote abierto es "antiguo" (07-lotes). */
  dias_alerta_lote: number | null
  /** Datos del negocio para el encabezado de los contratos (06-contratos). */
  razon_social: string | null
  rif: string | null
  direccion: string | null
  telefono: string | null
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
  /** Días de crédito habituales; `null` = `config_negocio.dias_credito_default`. */
  dias_credito: number | null
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
  /** Lote crudo del que salió (07-lotes). */
  lote_origen_id: string
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
  /** Días de crédito otorgados en esta factura (contado: 0). */
  dias_credito: number
  /** `fecha + dias_credito`; la deriva la base (09-cuentas-por-cobrar). */
  fecha_vencimiento: string
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
  /** Lote del movimiento; `null` solo en productos sin control de stock (07-lotes). */
  lote_id: string | null
}

/* ==================== Cuentas por cobrar (09) ==================== */

export type CanalRecordatorioId = 'whatsapp' | 'email'
/** WhatsApp: `generado` (el usuario envía desde wa.me); correo: `enviado` / `fallido`. */
export type EstadoEnvio = 'generado' | 'enviado' | 'fallido'

/** Fila de `recordatorios_cobro_view`: `mensaje`/`asunto` llegan `null` al operador. */
export interface RecordatorioCobro {
  id: string
  cliente_id: string
  canal: CanalRecordatorioId
  destinatario: string
  asunto: string | null
  mensaje: string | null
  estado: EstadoEnvio
  error: string | null
  proveedor_id_mensaje: string | null
  enviado_por: string | null
  enviado_por_nombre: string | null
  created_at: string
  factura_ids: string[]
}

/* ==================== Lotes y trazabilidad (07) ==================== */

export type EstadoLote = 'abierto' | 'agotado' | 'cerrado'
export type OrigenLote = 'compra' | 'proceso' | 'inicial'
/** `cierre` lo usa solo el cierre de lote (baja del remanente). */
export type MotivoPerdida = 'danado' | 'vencido' | 'faltante' | 'cierre' | 'otro'

/**
 * Fila de `lotes_view`: lote físico (una línea de compra o de procesamiento)
 * con su stock actual (Σ movimientos del lote). `costo_usd_kg` llega `null`
 * al operador.
 */
export interface Lote {
  id: string
  /** Código legible para rotular la cava: `SALM-261005-1`. */
  codigo: string
  producto_id: string
  producto_nombre: string
  producto_codigo: string | null
  producto_tipo: TipoProducto
  origen: OrigenLote
  compra_item_id: string | null
  compra_id: string | null
  proceso_item_id: string | null
  procesamiento_id: string | null
  /** Lote crudo del que salió un lote procesado. */
  lote_padre_id: string | null
  lote_padre_codigo: string | null
  proveedor_id: string | null
  proveedor_nombre: string | null
  /** Fecha de la compra o del procesamiento; ordena el PEPS. */
  fecha_ingreso: string
  peso_inicial_kg: number
  stock_kg: number
  costo_usd_kg: number | null
  moneda: Moneda
  /** Tasa de la compra (los procesados la heredan del padre). */
  tasa_snapshot: number
  estado: EstadoLote
  notas: string | null
  created_at: string
}

/** Fila de `factura_item_lotes_view`: de qué lote salió una línea vendida. */
export interface FacturaItemLote {
  id: string
  factura_item_id: string
  lote_id: string
  /** Orden de la asignación; la devolución lo recorre al revés. */
  orden: number
  peso_kg: number
  /** `null` para el operador. */
  costo_usd_kg: number | null
}

/** Fila de `perdidas_lote_view`. */
export interface PerdidaLote {
  id: string
  lote_id: string
  fecha: string
  peso_kg: number
  motivo: MotivoPerdida
  detalle: string | null
  usuario_id: string | null
  usuario_nombre: string | null
  created_at: string
}

/** Kg de una línea de venta asignados a un lote (PEPS o elegidos a mano). Sin costos. */
export interface AsignacionLote {
  lote_id: string
  codigo: string
  peso_kg: number
  disponible_kg: number
  fecha_ingreso: string
}

/** Resultado de la RPC `sugerir_lotes`. */
export interface SugerenciaLotes {
  /** `false`: el producto no usa lotes (sin asignación ni validación de stock). */
  controla_stock: boolean
  suficiente: boolean
  /** Stock total en lotes abiertos; `null` sin control de stock. */
  disponible_kg: number | null
  faltante_kg: number
  asignacion: AsignacionLote[]
}

/** Lote generado por una compra o un procesamiento (para rotular). */
export interface LoteCreado {
  lote_id: string
  codigo: string
  producto_id: string
  peso_kg: number
}

/** Procesamiento de un lote crudo del árbol. */
export interface ProcesoLote {
  proceso_item_id: string
  procesamiento_id: string
  fecha: string
  lote_origen_id: string
  peso_entrada_kg: number
  peso_salida_kg: number
  lote_destino_id: string | null
  lote_destino_codigo: string | null
}

/** Kg de un lote vendidos en una factura. Importes en USD; `costo_usd_kg` solo admin. */
export interface VentaLote {
  id: string
  lote_id: string
  factura_id: string
  factura_numero: number
  factura_estado: EstadoDoc
  cliente_id: string
  cliente_nombre: string
  fecha: string
  peso_kg: number
  precio_usd_kg: number
  costo_usd_kg: number | null
  /** Tasa congelada de la factura. */
  tasa_factura: number
}

/** Kg devueltos a un lote por una nota de crédito con `afecta_inventario`. */
export interface DevolucionLote {
  id: string
  lote_id: string
  nota_credito_id: string
  nota_numero: number
  nota_estado: EstadoNotaCredito
  fecha: string
  peso_kg: number
  precio_usd_kg: number
  factura_id: string
  factura_numero: number
  tasa_factura: number
}

/**
 * Árbol de un lote para su trazabilidad: el lote, sus lotes procesados
 * hijos (si es crudo) y todo lo que les pasó.
 */
export interface TrazabilidadLote {
  lote: Lote
  /** El lote y sus hijos (un lote crudo da lotes procesados; sin nietos). */
  arbol: Lote[]
  procesos: ProcesoLote[]
  ventas: VentaLote[]
  perdidas: PerdidaLote[]
  devoluciones: DevolucionLote[]
}

/** Resultado de un lote (o su árbol) para kg vendidos y perdidos. */
export interface ResultadoLote {
  kgVendidos: number
  kgPerdidos: number
  ingresoUsd: number
  costoVendidoUsd: number
  costoPerdidoUsd: number
  resultadoUsd: number
  /** Ventas a la tasa de cada factura − costos a la tasa de compra del lote. */
  resultadoBs: number
  /** `resultadoBs − resultadoUsd × tasa de compra`. */
  efectoCambiarioBs: number
  mermaKg: number
  /** `Σ salida / Σ entrada` de sus procesamientos; `null` si no se procesó. */
  rendimiento: number | null
}

/* ==================== Contratos (06) ==================== */

export type TipoContrato = 'venta_credito' | 'compra_credito'
export type EstadoContrato = 'generado' | 'enviado' | 'firmado' | 'anulado'

/** Fila de `contratos`. El PDF es inmutable; `url_storage` es la ruta en el bucket. */
export interface Contrato {
  id: string
  numero: number
  tipo: TipoContrato
  factura_id: string | null
  compra_id: string | null
  /** Fecha de emisión (Caracas). */
  fecha: string
  dias_credito: number
  /** Fecha del origen + `dias_credito`; la deriva el trigger y no se recalcula. */
  fecha_vencimiento: string
  estado: EstadoContrato
  url_storage: string
  notas: string | null
  generado_por: string
  estado_cambiado_por: string | null
  estado_cambiado_at: string | null
  created_at: string
}

/** Fila de `contratos_listado_view`. */
export interface ContratoListado extends Contrato {
  contraparte_id: string | null
  contraparte_nombre: string | null
  contraparte_rif_ci: string | null
  documento_fecha: string | null
  /** `facturas.numero`; `null` en compras. */
  documento_numero: number | null
  monto_usd: number | null
  /** El documento de origen se anuló después de generar el contrato. */
  origen_anulado: boolean
}

export interface ParteContrato {
  nombre: string
  tipo_persona: TipoPersona
  rif_ci: string
  direccion: string | null
  telefono: string | null
  representantes: Pick<RepresentanteLegal, 'nombre' | 'cedula' | 'cargo'>[]
}

export interface ItemContrato {
  codigo: string | null
  producto: string
  peso_kg: number
  /** Precio (venta) o costo (compra) USD/kg guardado en el origen. */
  precio_usd_kg: number
  subtotal_usd: number
}

/** Todo lo que necesita una plantilla de contrato; sin consultas ni recálculos de tasa. */
export interface DatosContratoPdf {
  tipo: TipoContrato
  numero: number
  fecha_emision: string
  dias_credito: number
  fecha_vencimiento: string
  notas: string | null
  negocio: {
    nombre_comercial: string | null
    razon_social: string
    rif: string
    direccion: string
    telefono: string
  }
  contraparte: ParteContrato
  documento: {
    /** "F-000123" en ventas; `null` en compras (no tienen número). */
    numero: string | null
    fecha: string
    /** Primeros 8 caracteres del id (referencia de la compra). */
    referencia: string
    /** Moneda pactada (solo compras). */
    moneda: Moneda | null
  }
  items: ItemContrato[]
  totales: {
    subtotal_usd: number
    /** Solo venta. */
    iva_pct: number | null
    iva_usd: number | null
    total_usd: number
    pagado_usd: number
    /** Σ notas de crédito emitidas (solo venta; 0 en compras). */
    creditos_usd: number
    saldo_usd: number
  }
  tasa: TasaOperacion
}

export interface ElegibilidadContrato {
  puedeGenerar: boolean
  /** Por qué no se puede generar (p. ej. "Documento anulado"). */
  motivo?: string
  contratoActivo?: { id: string; numero: number; estado: EstadoContrato }
}

/* ==================== Dashboard (15) ==================== */

/** Rango de fechas `YYYY-MM-DD`, inclusive en ambos extremos. */
export interface RangoFechas {
  desde: string
  hasta: string
}

export type PresetRango =
  | 'hoy'
  | 'ultimos_7'
  | 'mes_en_curso'
  | 'mes_anterior'
  | 'ultimos_90'
  | 'anio_en_curso'
  | 'personalizado'

/** Días del flujo de caja proyectado (C3). */
export type DiasFlujo = 7 | 30

/** Resultado de un bloque: el error de uno no tumba los demás. */
export type BloqueDashboard<T> = { ok: true; data: T } | { ok: false; error: string }

/** `dashboard_kpis_dia()` (admin) + conversión a Bs del servicio. */
export interface KpisDia {
  hoy: string
  ventas_usd: number
  ventas_kg: number
  facturas: number
  costo_usd: number
  margen_usd: number
  /** margen / ventas; `null` sin ventas. */
  margen_pct: number | null
  cxc_saldo_usd: number
  cxc_vencido_usd: number
  cxc_facturas: number
  cxc_clientes_vencidos: number
  cxp_saldo_usd: number
  cxp_vencido_usd: number
  cxp_compras: number
  inventario_usd: number
  inventario_kg: number
  /** Valor del inventario en Bs a la tasa vigente de `fuente_tasa_default`; `null` sin tasa. */
  inventario_bs: number | null
}

export type GrupoPedidoProximo = 'atrasado' | 'hoy' | 'manana'

/** Pedido `pendiente` con entrega hasta mañana (D3 del alcance). */
export interface PedidoProximo {
  pedido_id: string
  cliente_id: string
  cliente_nombre: string
  fecha_entrega: string
  grupo: GrupoPedidoProximo
  items: number
  kg_estimados: number
  /** Σ peso estimado × precio; `null` para el operador. */
  usd_estimado: number | null
}

export interface ProductoStockBajo {
  producto_id: string
  producto_nombre: string
  stock_kg: number
}

export interface LoteAntiguo {
  lote_id: string
  codigo: string
  producto_id: string
  producto_nombre: string
  fecha_ingreso: string
  dias: number
  stock_kg: number
}

/** `dashboard_operativo()` (cualquier autenticado): sin costos. */
export interface DashboardOperativo {
  hoy: string
  /** `null` = sin umbral configurado: la alerta de stock no aplica. */
  umbral_stock_bajo_kg: number | null
  /** `null` = sin `dias_alerta_lote`: la alerta de lotes antiguos no aplica. */
  dias_alerta_lote: number | null
  pedidos: PedidoProximo[]
  stock_bajo: ProductoStockBajo[]
  lotes_antiguos: LoteAntiguo[]
}

export type TramoAntiguedadId = '0-2' | '3-5' | '>5'

/** `dashboard_antiguedad_lotes()`: tramos fijos de días en cava (D3). */
export interface TramoAntiguedad {
  tramo: TramoAntiguedadId
  orden: number
  lotes: number
  kg: number
  /** `null` para el operador. */
  usd: number | null
}

/** `dashboard_ventas_mensuales()` (D6: 12 meses hasta el mes de `hasta`). */
export interface VentaMensual {
  /** Primer día del mes, `YYYY-MM-01`. */
  mes: string
  ventas_usd: number
  kg: number
  facturas: number
}

/** `dashboard_productos_salida()`: volumen (B2) y margen por producto (B3). */
export interface ProductoSalida {
  producto_id: string
  producto_nombre: string
  kg: number
  ventas_usd: number
  facturas: number
  precio_medio_usd_kg: number | null
  costo_usd: number
  margen_usd: number
  margen_pct: number | null
}

/** `dashboard_resultado_cambiario()` (B4, D5). En Bs; nunca se suma al margen USD. */
export interface ResultadoCambiario {
  cobros_bs: number
  cobros: number
  pagos_proveedores_bs: number
  pagos_proveedores: number
  /** cobros − pagos a proveedores. */
  neto_bs: number
}

export type GranularidadSpread = 'semana' | 'mes'

/** `dashboard_spread_precio_costo()` (B5). Valores `null` en períodos sin ventas. */
export interface PuntoSpread {
  /** Lunes de la semana ISO o primer día del mes. */
  periodo: string
  granularidad: GranularidadSpread
  kg: number
  precio_medio_usd_kg: number | null
  costo_medio_usd_kg: number | null
  spread_usd_kg: number | null
}

/** `dashboard_merma_procesos()` (B6), por producto de origen. */
export interface MermaProceso {
  producto_id: string
  producto_nombre: string
  procesos: number
  kg_entrada: number
  kg_salida: number
  merma_kg: number
  merma_pct: number | null
  rendimiento: number | null
  costo_merma_usd: number
}

/** `dashboard_rendimiento_proveedor()` (B7). */
export interface RendimientoProveedor {
  /** `null` = lotes sin proveedor (iniciales). */
  proveedor_id: string | null
  proveedor_nombre: string | null
  producto_id: string
  producto_nombre: string
  procesos: number
  kg_entrada: number
  kg_salida: number
  rendimiento: number | null
  merma_pct: number | null
  costo_kg_crudo_usd: number | null
  costo_kg_limpio_usd: number | null
}

/** `dashboard_perdidas_motivo()` (B8): los cinco motivos siempre presentes. */
export interface PerdidaPorMotivo {
  motivo: MotivoPerdida
  registros: number
  kg: number
  usd: number
}

/** Fila cruda de `dashboard_mezcla_ventas()`. */
export interface FilaMezclaVentas {
  grupo: 'total' | 'condicion' | 'metodo' | 'moneda'
  clave: string
  usd: number
  cantidad: number
  kg: number | null
}

export interface ParteMezcla<K extends string> {
  clave: K
  usd: number
  cantidad: number
  /** usd / total del grupo; `null` si el total es 0. */
  pct: number | null
}

/** B9 + B10 + B11 armados por el servicio. */
export interface MezclaVentas {
  ventas_usd: number
  facturas: number
  kg: number
  /** Ventas / n.º de facturas; `null` sin facturas. */
  ticket_promedio_usd: number | null
  kg_por_factura: number | null
  condicion: ParteMezcla<CondicionPago>[]
  metodos: ParteMezcla<MetodoPago>[]
  monedas: ParteMezcla<Moneda>[]
}

/** Fila cruda de `dashboard_top_clientes()`. */
export interface FilaTopCliente {
  cliente_id: string
  cliente_nombre: string
  ventas_usd: number
  facturas: number
  total_periodo_usd: number
  clientes_periodo: number
}

/** Cliente en el Pareto (B12). `cliente_id` `null` = "Resto". */
export interface ClienteRanking {
  cliente_id: string | null
  cliente_nombre: string
  ventas_usd: number
  facturas: number | null
  pct: number
  pct_acumulado: number
  /** Dentro del grupo que suma hasta el 80 % (incluye al que cruza el corte). */
  dentro_80: boolean
}

export interface TopClientesPareto {
  clientes: ClienteRanking[]
  total_usd: number
  clientes_periodo: number
  /** Índice del cliente que cruza el 80 %; `null` si no hay ventas. */
  indice_corte_80: number | null
}

export type TramoAgingId = 'por_vencer' | '1-15' | '16-30' | '>30'

/** `dashboard_aging_cartera()` (C1). */
export interface TramoAging {
  tramo: TramoAgingId
  orden: number
  saldo_usd: number
  facturas: number
}

/** `dashboard_top_deudores()` (C2). */
export interface Deudor {
  cliente_id: string
  cliente_nombre: string
  saldo_usd: number
  vencido_usd: number
  facturas: number
  vencida_mas_antigua_dias: number | null
}

/** Fila cruda de `dashboard_flujo_proyectado()`. */
export interface FilaFlujo {
  tipo: 'dia' | 'vencido'
  fecha: string | null
  cobros_usd: number
  pagos_usd: number
}

/** Día del flujo proyectado (C3) con el acumulado neto del servicio. */
export interface FlujoDia {
  fecha: string
  cobros_usd: number
  pagos_usd: number
  neto_usd: number
  acumulado_usd: number
}

export interface FlujoProyectado {
  dias: DiasFlujo
  serie: FlujoDia[]
  /** Ya vencido, no repartido en días. */
  vencido_cobros_usd: number
  vencido_pagos_usd: number
}

/** `dashboard_exposicion_cambiaria()` (C4, D7). Importes en Bs, informativos. */
export interface ExposicionCambiaria {
  saldo_usd: number
  fuente: 'bcv' | 'paralela'
  tasa_bcv: number | null
  tasa_bcv_fecha: string | null
  tasa_paralela: number | null
  tasa_paralela_fecha: string | null
  brecha_pct: number | null
  brecha_bs: number | null
  latente_bs: number | null
}

/** `dashboard_clientes_inactivos()` (C5). */
export interface ClienteInactivo {
  cliente_id: string
  cliente_nombre: string
  ultima_compra: string
  dias: number
  ventas_90d_usd: number
}

/** `dashboard_contratos_sin_firmar()` (agregado 14). */
export interface ContratoPendienteFirma {
  contrato_id: string
  numero: number
  tipo: TipoContrato
  estado: Extract<EstadoContrato, 'generado' | 'enviado'>
  contraparte_nombre: string | null
  fecha: string
  fecha_vencimiento: string
  dias_desde_generado: number
}

/** `dashboard_valor_inventario()`: valor por producto (D2 del alcance). */
export interface ValorInventarioProducto {
  /** `null` = "Resto" (agrupado por el servicio). */
  producto_id: string | null
  producto_nombre: string
  lotes: number
  stock_kg: number
  valor_usd: number
  valor_bs: number | null
}

/** Tasas de hoy para la tarjeta del día (A). */
export interface TasasDelDia {
  bcv: TasaVigente | null
  paralela: TasaVigente | null
  /** EUR BCV, solo referencia. */
  eur: TasaVigente | null
  /** Fuente con la que se convierte a Bs (`config_negocio.fuente_tasa_default`). */
  fuente_default: 'bcv' | 'paralela'
}

/** Bloque operativo (cualquier rol): pedidos, alertas y antigüedad de lotes. */
export interface DashboardOperativoBloques {
  operativo: BloqueDashboard<DashboardOperativo>
  antiguedad: BloqueDashboard<TramoAntiguedad[]>
}

/** Sección analítica por período (B, admin). */
export interface DashboardAnalitica {
  rango: RangoFechas
  granularidad_spread: GranularidadSpread
  producto_spread: string | null
  ventas_mensuales: BloqueDashboard<VentaMensual[]>
  productos: BloqueDashboard<ProductoSalida[]>
  resultado_cambiario: BloqueDashboard<ResultadoCambiario>
  spread: BloqueDashboard<PuntoSpread[]>
  merma: BloqueDashboard<MermaProceso[]>
  rendimiento: BloqueDashboard<RendimientoProveedor[]>
  perdidas: BloqueDashboard<PerdidaPorMotivo[]>
  mezcla: BloqueDashboard<MezclaVentas>
  top_clientes: BloqueDashboard<TopClientesPareto>
}

/** Cartera, flujo, riesgo, inventario valorizado y contratos (C + D, admin; foto a hoy). */
export interface DashboardCartera {
  aging: BloqueDashboard<TramoAging[]>
  deudores: BloqueDashboard<Deudor[]>
  flujo: BloqueDashboard<FlujoProyectado>
  exposicion: BloqueDashboard<ExposicionCambiaria>
  inactivos: BloqueDashboard<ClienteInactivo[]>
  contratos: BloqueDashboard<ContratoPendienteFirma[]>
  valor_inventario: BloqueDashboard<ValorInventarioProducto[]>
}

/** Resultado completo de `dashboardService.getDashboard`. Lo de admin es `undefined` para el operador. */
export interface Dashboard {
  rol: 'admin' | 'operador' | null
  tasas: BloqueDashboard<TasasDelDia>
  operativo: DashboardOperativoBloques
  kpisDia?: BloqueDashboard<KpisDia>
  analitica?: DashboardAnalitica
  cartera?: DashboardCartera
}
