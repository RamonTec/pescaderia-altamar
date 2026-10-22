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
  /**
   * Kg movidos por la corrección del peso de una línea de factura (17):
   * `ref_id` = `factura_correcciones.id`. Positivo vuelve al lote, negativo sale.
   */
  | 'correccion_venta'
  /**
   * Kg ± de la edición de una línea de compra (19): `ref_id` =
   * `compra_correcciones.id`. Positivo suma al lote, negativo resta.
   */
  | 'correccion_compra'

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
  /**
   * Precio de venta de referencia USD/kg de un procesado (16): reparte el
   * costo cuando un lote da varias salidas. No es un costo: lo ven todos.
   * Siempre `null` en los crudos.
   */
  precio_referencia_usd_kg: number | null
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
  /**
   * Tolerancia % simétrica frente al precio de referencia para las señales
   * "Por debajo" y "Cobro mayor" de una factura (17). 0 = marca cualquier diferencia.
   */
  tolerancia_precio_ref_pct: number
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
  /** "Aplica IVA" (18): precarga el interruptor de IVA de cada venta. */
  aplica_iva: boolean
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
  /**
   * Costo/kg pactado en la moneda de la compra (19). `costo_usd_kg` =
   * `usd ? pactado : pactado / tasa_snapshot` (6 decimales). `null` para
   * operador (`compra_items_view`).
   */
  costo_kg_pactado: number | null
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

/**
 * Cómo se repartió el costo de un procesamiento entre sus salidas (16):
 * `valor` = kg × precio de referencia; `peso` = por kg (una sola salida o
 * todos los precios en 0).
 */
export type RepartoCosto = 'valor' | 'peso'

/**
 * Cabecera de un procesamiento (16): un lote crudo + un peso de entrada →
 * N salidas. Los campos de la cabecera son `null` solo en registros legados
 * que no se pudieron rellenar.
 */
export interface Procesamiento {
  id: string
  fecha: string
  notas: string | null
  lote_origen_id: string | null
  peso_entrada_kg: number | null
  /** `peso_entrada × costo del lote`. `null` para el operador (`procesamientos_view`). */
  costo_total_usd: number | null
  reparto_costo: RepartoCosto | null
}

/** Una salida de un procesamiento. */
export interface ProcesoItem {
  id: string
  procesamiento_id: string
  producto_origen_id: string
  /** Parte prorrateada (por kg) de la entrada de la cabecera: dato técnico, no se muestra. */
  peso_entrada_kg: number
  producto_destino_id: string
  peso_salida_kg: number
  /** Costo asignado a esta salida. `null` para el operador (`proceso_items_view`). */
  costo_total_usd: number | null
  /** Lote crudo del que salió (07-lotes). */
  lote_origen_id: string
  /** Snapshot del precio de referencia usado en el reparto (`null` en históricos). */
  precio_referencia_usd_kg: number | null
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

/** Salida de un procesamiento en la trazabilidad (16). */
export interface SalidaProcesoLote {
  proceso_item_id: string
  producto_nombre: string
  peso_salida_kg: number
  lote_destino_id: string | null
  lote_destino_codigo: string | null
}

/** Procesamiento de un lote crudo del árbol, agrupado con sus N salidas (16). */
export interface ProcesoLote {
  procesamiento_id: string
  fecha: string
  lote_origen_id: string
  /** Entrada de la cabecera (no la suma del prorrateo de las líneas). */
  peso_entrada_kg: number
  salidas: SalidaProcesoLote[]
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
 * Kg ± de un lote por la edición de su compra (19, movimiento
 * `correccion_compra`). `motivo` solo llega al admin (`null` al operador).
 */
export interface CorreccionCompraLote {
  id: string
  lote_id: string
  correccion_id: string
  /** Momento de la edición (`movimientos.fecha`). */
  fecha: string
  peso_kg: number
  motivo: string | null
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
  /** Ediciones de kg de la compra (19). Opcional: fixtures previos no lo traen. */
  correcciones_compra?: CorreccionCompraLote[]
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
  /**
   * Última corrección del origen: de la factura (17) o de la compra (19);
   * `null` sin correcciones.
   */
  ultima_correccion_at: string | null
  /**
   * Contrato no anulado cuya factura o compra se corrigió después de
   * generarlo (17 y 19): hay que anularlo y generar otro. Derivado.
   */
  desactualizado: boolean
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
  /** `desactualizado`: el origen se corrigió después de generarlo (17 y 19). */
  contratoActivo?: { id: string; numero: number; estado: EstadoContrato; desactualizado: boolean }
}

/* ============ Trazabilidad y corrección de facturas (17) ============ */

/** Señal de posible error en una línea: Pérdida, Por debajo o Cobro mayor. */
export type SenalFactura = 'perdida' | 'por_debajo' | 'cobro_mayor'
/** Indicadores neutros: la señal correspondiente no aplica a la línea. */
export type IndicadorLinea = 'sin_referencia' | 'sin_costo'
/** Nivel de una línea o de la factura (el peor de sus líneas). */
export type NivelSenal = 'ok' | 'aviso' | 'error'
/** De dónde sale el precio de referencia de una línea. */
export type FuenteReferencia = 'proceso' | 'catalogo'

/** Compra de la que salió un lote (`null`s en lotes sin compra). */
export interface CompraOrigenLote {
  compra_id: string | null
  fecha: string | null
  proveedor_id: string | null
  proveedor_nombre: string | null
}

/** Lote crudo (padre) de un lote procesado, con su compra. */
export interface LotePadreTrazabilidad {
  id: string
  codigo: string
  origen: OrigenLote
  producto_nombre: string
  fecha_ingreso: string
  costo_usd_kg: number
  moneda: Moneda
  tasa_snapshot: number
  peso_inicial_kg: number
  compra: CompraOrigenLote | null
}

/** Procesamiento del que salió un lote procesado (merma y rendimiento del proceso completo). */
export interface ProcesoOrigenLote {
  procesamiento_id: string
  proceso_item_id: string
  fecha: string
  reparto_costo: RepartoCosto | null
  /** Sin cabecera (16): entrada = Σ `proceso_items`. */
  legado: boolean
  peso_entrada_kg: number
  peso_salida_total_kg: number
  /** Cantidad de salidas del procesamiento. */
  salidas: number
  /** Kg de esta salida. */
  peso_salida_kg: number
  /** Costo asignado a esta salida. */
  costo_total_usd: number
  /** Snapshot del precio de referencia usado en el reparto (16). */
  precio_referencia_usd_kg: number | null
  lote_padre: LotePadreTrazabilidad | null
}

interface EslabonLoteBase {
  /** `factura_item_lotes.id`. */
  fil_id: string
  lote_id: string
  codigo: string
  orden: number
  /** Kg de la línea que salieron de este lote. */
  peso_kg: number
  /** Costo/kg con que se vendió (snapshot de la asignación). */
  costo_usd_kg: number
  /** Kg ya devueltos a este lote por notas emitidas (tope al bajar el peso). */
  kg_devueltos: number
  fecha_ingreso: string
  estado: EstadoLote
  /** Stock actual del lote. */
  stock_kg: number
  moneda: Moneda
  tasa_snapshot: number
  /** Costo/kg actual del lote. */
  lote_costo_usd_kg: number
}

/** Lote vendido en una línea, discriminado por su origen. */
export type EslabonLoteVendido =
  | (EslabonLoteBase & { origen: 'compra'; compra: CompraOrigenLote })
  | (EslabonLoteBase & { origen: 'inicial' })
  | (EslabonLoteBase & { origen: 'proceso'; proceso: ProcesoOrigenLote | null })

/** Línea de factura con su cadena por lote. `lotes: []` sin control de stock (o legado). */
export interface LineaTrazabilidad {
  id: string
  producto: Pick<Producto, 'id' | 'nombre' | 'codigo' | 'tipo' | 'controla_stock' | 'precio_referencia_usd_kg'>
  peso_kg: number
  precio_usd_kg: number
  costo_usd_kg: number
  /** Kg devueltos por notas de crédito emitidas (mínimo al corregir). */
  kg_devueltos: number
  lotes: EslabonLoteVendido[]
}

export interface NotaCreditoTrazabilidad extends NotaCredito {
  items: Pick<NotaCreditoItem, 'id' | 'factura_item_id' | 'peso_kg' | 'precio_usd_kg' | 'afecta_inventario'>[]
}

export type PagoTrazabilidad = Pick<
  Pago,
  'id' | 'fecha' | 'monto_usd' | 'moneda_pago' | 'tasa_pago' | 'metodo' | 'ganancia_cambiaria_bs'
>

/** Kg movidos por una corrección en un lote (+ vuelve, − sale); `lote_id` `null` sin control de stock. */
export interface MovimientoCorreccion {
  lote_id: string | null
  codigo: string | null
  peso_kg: number
}

/** Campos comunes de una fila del historial `factura_correcciones` (solo admin). */
interface CorreccionFacturaBase {
  id: string
  subtotal_anterior_usd: number
  subtotal_nuevo_usd: number
  iva_anterior_usd: number
  iva_nuevo_usd: number
  total_anterior_usd: number
  total_nuevo_usd: number
  pagado_usd: number
  estado_anterior: Exclude<EstadoDoc, 'anulada'>
  estado_nuevo: Exclude<EstadoDoc, 'anulada'>
  contrato_id: string | null
  contrato_numero: number | null
  motivo: string
  usuario_id: string
  usuario_nombre: string | null
  created_at: string
}

export type TipoCorreccionFactura = 'linea' | 'iva'

/** Corrección de peso y/o precio/kg de una línea (17). */
export interface CorreccionLinea extends CorreccionFacturaBase {
  tipo: 'linea'
  factura_item_id: string
  producto_nombre: string
  peso_anterior_kg: number
  peso_nuevo_kg: number
  precio_anterior_usd_kg: number
  precio_nuevo_usd_kg: number
  costo_anterior_usd_kg: number
  costo_nuevo_usd_kg: number
  movimientos: MovimientoCorreccion[]
}

/** Activación o retiro del IVA de la factura (18): a nivel factura, sin línea. */
export interface CorreccionIva extends CorreccionFacturaBase {
  tipo: 'iva'
  factura_item_id: null
  iva_pct_anterior: number
  iva_pct_nuevo: number
  /** Σ total de las notas de crédito emitidas antes y después del cambio. */
  creditos_anterior_usd: number
  creditos_nuevo_usd: number
}

/** Fila del historial `factura_correcciones` (solo admin), discriminada por `tipo`. */
export type CorreccionFactura = CorreccionLinea | CorreccionIva

/** Contrato activo de la factura (06) con la marca derivada de 17. */
export interface ContratoFactura {
  id: string
  numero: number
  estado: EstadoContrato
  created_at: string
  desactualizado: boolean
}

export interface FacturaTrazabilidad extends Omit<Factura, 'cliente_id' | 'pedido_id'> {
  created_at: string
  cliente: Pick<Cliente, 'id' | 'nombre' | 'rif_ci' | 'limite_credito_usd' | 'bloqueado'>
}

/** Resultado de la RPC `trazabilidad_factura` (solo admin), sin cálculos. */
export interface TrazabilidadFactura {
  factura: FacturaTrazabilidad
  lineas: LineaTrazabilidad[]
  notas_credito: NotaCreditoTrazabilidad[]
  pagos: PagoTrazabilidad[]
  /** De la más reciente a la más antigua. */
  correcciones: CorreccionFactura[]
  contrato: ContratoFactura | null
}

/** Margen USD sin IVA (regla de `dashboard_lineas_venta`). */
export interface MargenLinea {
  venta_usd: number
  costo_usd: number
  margen_usd: number
  /** `null` si la venta es 0. */
  margen_pct: number | null
}

export interface SenalesLinea {
  senales: SenalFactura[]
  indicadores: IndicadorLinea[]
  nivel: NivelSenal
  precio_referencia_usd_kg: number | null
  fuente_referencia: FuenteReferencia | null
}

export interface ResumenSenales {
  nivel: NivelSenal
  conteo: Record<SenalFactura, number>
}

export interface LineaDetalle extends LineaTrazabilidad {
  margen: MargenLinea
  senales: SenalesLinea
}

/** Ficha de una factura (`trazabilidadFacturaService`): trazabilidad + margen + señales. */
export interface DetalleFactura extends Omit<TrazabilidadFactura, 'lineas'> {
  lineas: LineaDetalle[]
  saldo: {
    /** Σ notas de crédito emitidas. */
    creditos_usd: number
    /** Pendiente de cobro (≥ 0). */
    saldo_usd: number
    /** A favor del cliente cuando lo pagado + créditos supera el total (≥ 0). */
    saldo_a_favor_usd: number
  }
  /** Neto de notas de crédito emitidas. */
  margen: MargenLinea
  senales: ResumenSenales
  tolerancia_precio_ref_pct: number
}

/** Respuesta de `corregir_linea_factura` (sin costos). */
export interface ResultadoCorreccion {
  correccion_id: string
  subtotal_usd: number
  iva_usd: number
  total_usd: number
  pagado_usd: number
  saldo_usd: number
  saldo_a_favor_usd: number
  estado: Exclude<EstadoDoc, 'anulada'>
  contrato: { id: string; numero: number; estado: EstadoContrato } | null
  lotes: MovimientoCorreccion[]
}

/** Respuesta de `cambiar_iva_factura` (18, sin costos). */
export interface ResultadoCambioIva {
  correccion_id: string
  iva_pct: number
  subtotal_usd: number
  iva_usd: number
  total_usd: number
  pagado_usd: number
  /** Σ notas de crédito emitidas, ya al % nuevo. */
  creditos_usd: number
  saldo_usd: number
  saldo_a_favor_usd: number
  estado: Exclude<EstadoDoc, 'anulada'>
  contrato: { id: string; numero: number; estado: EstadoContrato } | null
}

/* ==================== Edición de compras (19) ==================== */

/** Kg vendidos de un lote en facturas no anuladas, con sus líneas y facturas. */
export interface VentasLoteResumen {
  kg: number
  lineas: number
  facturas: number
}

/** Lote procesado (hijo) de una salida, con su costo vigente (solo admin). */
export interface LoteHijoCompra {
  id: string
  codigo: string
  estado: EstadoLote
  peso_inicial_kg: number
  stock_kg: number
  costo_usd_kg: number
  ventas: VentasLoteResumen
}

/** Salida de un procesamiento del lote de una compra (16), con su snapshot de precio. */
export interface SalidaProcesoCompra {
  proceso_item_id: string
  producto_id: string
  producto_nombre: string
  /** Parte prorrateada de la entrada (en legados, la entrada propia de la línea). */
  peso_entrada_kg: number
  peso_salida_kg: number
  precio_referencia_usd_kg: number | null
  costo_total_usd: number
  /** `null` si el procesado no controla stock. */
  lote: LoteHijoCompra | null
}

/** Procesamiento del lote de una compra. `legado`: sin cabecera (16); solo sus salidas de ese lote. */
export interface ProcesamientoCompra {
  id: string
  fecha: string
  legado: boolean
  peso_entrada_kg: number
  costo_total_usd: number | null
  reparto_costo: RepartoCosto | null
  /** En orden `proceso_items.id` (el del reparto). */
  salidas: SalidaProcesoCompra[]
}

/** Lote de una línea de compra con su consumo desglosado (Σ = peso_inicial − stock). */
export interface LoteLineaCompra {
  id: string
  codigo: string
  estado: EstadoLote
  fecha_ingreso: string
  peso_inicial_kg: number
  costo_usd_kg: number
  stock_kg: number
  kg_procesados: number
  /** Ventas netas de devoluciones y correcciones de factura. */
  kg_vendidos: number
  kg_perdidos: number
  /** Primera salida (proceso, venta o pérdida); `null` si no salió nada. */
  primera_salida: string | null
  ventas: VentasLoteResumen
  procesamientos: ProcesamientoCompra[]
}

/** Línea de la compra en la ficha (19, solo admin). */
export interface LineaCompraDetalle {
  id: string
  producto: Pick<Producto, 'id' | 'nombre' | 'codigo' | 'controla_stock'>
  peso_kg: number
  /** En la moneda de la compra. */
  costo_kg_pactado: number
  costo_usd_kg: number
  /** `null` si el producto no controla stock. */
  lote: LoteLineaCompra | null
}

/** Propagación del costo que dejó una edición (resumen informativo del historial). */
export interface PropagacionCosto {
  lotes: { lote_id: string; codigo: string; origen: OrigenLote; costo_anterior: number; costo_nuevo: number }[]
  procesamientos: number
  lineas_factura: number
  facturas: number
}

/** Línea que cambió en una edición de compra. */
export interface CorreccionCompraItem {
  compra_item_id: string
  producto_nombre: string
  lote_id: string | null
  lote_codigo: string | null
  peso_anterior_kg: number
  peso_nuevo_kg: number
  /** En la moneda anterior y en la nueva de la compra. */
  costo_pactado_anterior: number
  costo_pactado_nuevo: number
  costo_anterior_usd_kg: number
  costo_nuevo_usd_kg: number
}

type EstadoCompraVigente = Exclude<EstadoDoc, 'anulada'>
type OrigenTasaOperacion = TasaOperacion['tasa_origen']
type FuenteTasaOperacion = TasaOperacion['tasa_fuente']

/** Fila del historial `compra_correcciones` (solo admin), con sus líneas. */
export interface CorreccionCompra {
  id: string
  proveedor_anterior: Pick<Proveedor, 'id' | 'nombre'>
  proveedor_nuevo: Pick<Proveedor, 'id' | 'nombre'>
  fecha_anterior: string
  fecha_nueva: string
  condicion_anterior: CondicionPago
  condicion_nueva: CondicionPago
  moneda_anterior: Moneda
  moneda_nueva: Moneda
  tasa_anterior: number
  tasa_nueva: number
  tasa_origen_anterior: OrigenTasaOperacion
  tasa_origen_nueva: OrigenTasaOperacion
  tasa_fuente_anterior: FuenteTasaOperacion
  tasa_fuente_nueva: FuenteTasaOperacion
  tasa_referencial_anterior: number | null
  tasa_referencial_nueva: number | null
  notas_anterior: string | null
  notas_nueva: string | null
  subtotal_anterior_usd: number
  subtotal_nuevo_usd: number
  pagado_anterior_usd: number
  pagado_nuevo_usd: number
  /** Σ pagos registrados al editar (explica saldo a favor y D1–D3). */
  pagos_registrados_usd: number
  estado_anterior: EstadoCompraVigente
  estado_nuevo: EstadoCompraVigente
  contrato_id: string | null
  contrato_numero: number | null
  propagacion: PropagacionCosto
  motivo: string
  usuario_id: string
  usuario_nombre: string | null
  created_at: string
  items: CorreccionCompraItem[]
}

/** Cabecera de la compra en la ficha, con su proveedor. */
export interface CompraFichaDetalle extends Omit<Compra, 'proveedor_id'> {
  created_at: string
  proveedor: Pick<Proveedor, 'id' | 'nombre' | 'rif_ci' | 'activo' | 'bloqueado' | 'motivo_bloqueo'>
}

export type PagoProveedorDetalle = Pick<
  PagoProveedor,
  'id' | 'fecha' | 'monto_usd' | 'moneda_pago' | 'tasa_pago' | 'metodo' | 'ganancia_cambiaria_bs'
>

/** Resultado de la RPC `detalle_compra` (solo admin): ficha `/compras/[id]` y vista previa. */
export interface DetalleCompra {
  compra: CompraFichaDetalle
  /** Σ pagos a proveedores registrados (sin el pago implícito del contado). */
  pagos_registrados_usd: number
  /** Primera salida de los lotes de la compra: tope de la fecha (D5). */
  primera_salida: string | null
  /** Líneas y facturas (no anuladas) con kg del árbol de lotes, sin repetir. */
  ventas_arbol: { lineas: number; facturas: number }
  lineas: LineaCompraDetalle[]
  pagos: PagoProveedorDetalle[]
  /** Contrato activo con la marca derivada de 17/19. */
  contrato: ContratoFactura | null
  /** De la más reciente a la más antigua. */
  correcciones: CorreccionCompra[]
}

/** Respuesta de `editar_compra` (sin costos de lotes). */
export interface ResultadoEdicionCompra {
  correccion_id: string
  subtotal_usd: number
  pagado_usd: number
  saldo_usd: number
  saldo_a_favor_usd: number
  estado: EstadoCompraVigente
  contrato: { id: string; numero: number; estado: EstadoContrato } | null
  lotes: { lote_id: string; codigo: string; delta_kg: number }[]
  propagacion: { lotes_recalculados: number; procesamientos: number; lineas_factura: number; facturas: number }
}

/** Totales de la compra en la vista previa. */
export interface TotalesCompraPrevia {
  total_usd: number
  pagado_usd: number
  /** Pendiente (≥ 0). */
  saldo_usd: number
  /** A favor del negocio (≥ 0). */
  saldo_a_favor_usd: number
  estado: EstadoCompraVigente
}

/** Línea de la vista previa: costo USD/kg y kg antes → después. */
export interface LineaPreviaCompra {
  compra_item_id: string
  producto_nombre: string
  lote_codigo: string | null
  costo_antes_usd_kg: number
  costo_despues_usd_kg: number
  peso_antes_kg: number
  peso_despues_kg: number
  delta_kg: number
  /** Kg ya consumidos del lote: mínimo del peso nuevo (0 sin lote). */
  minimo_kg: number
  bajo_minimo: boolean
  /** Sube kg en un lote cerrado o agotado: se reabre (D7). */
  reabre: boolean
}

/** Lote hijo con su costo/kg antes → después. */
export interface HijoPrevioCompra {
  lote_id: string
  codigo: string
  producto_nombre: string
  costo_antes_usd_kg: number
  costo_despues_usd_kg: number
}

export type TipoAvisoEdicionCompra =
  | 'pagos'
  | 'saldo_a_favor'
  | 'contrato'
  | 'condicion_a_contado'
  | 'condicion_a_credito'
  | 'proveedor'
  | 'reabre_lote'
  | 'tasa_usd'
  | 'tasa_bs'
  | 'moneda'
  | 'ganancia_cambiaria'

export interface AvisoEdicionCompra {
  tipo: TipoAvisoEdicionCompra
  severidad: 'info' | 'warning'
  mensaje: string
}

/** Resultado de `previsualizarEdicionCompra` (función pura, misma cuenta que la RPC). */
export interface PrevisualizacionEdicionCompra {
  lineas: LineaPreviaCompra[]
  antes: TotalesCompraPrevia
  despues: TotalesCompraPrevia
  hijos: HijoPrevioCompra[]
  /** Costo de lo vendido (facturas no anuladas) del árbol de lotes. */
  costo_vendido: { antes_usd: number; despues_usd: number; lineas: number; facturas: number }
  sin_cambios: boolean
  bajo_minimo: boolean
  /** Algún costo USD de línea cambia (se propaga). */
  cambia_costo: boolean
  avisos: AvisoEdicionCompra[]
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
  gastos: BloqueDashboard<DashboardGastos>
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
  gastosPendientes?: BloqueDashboard<GastosPendientesResumen>
  analitica?: DashboardAnalitica
  cartera?: DashboardCartera
}

/* ==================== Gastos operativos (20) ==================== */

/**
 * Estado de un gasto (20-gastos): `pendiente` solo lo crea la generación de
 * recurrentes (Fase C); el alta manual nace `confirmado`. Terminales:
 * `descartado` (desde pendiente) y `anulado` (desde confirmado, con motivo).
 * Solo `confirmado` cuenta en reportes.
 */
export type EstadoGasto = 'pendiente' | 'confirmado' | 'descartado' | 'anulado'

/** Fila de `categorias_gasto`: categoría (`categoria_padre_id` nulo) o subcategoría (un nivel). */
export interface CategoriaGasto {
  id: string
  nombre: string
  categoria_padre_id: string | null
  /** Solo las de sistema: `'nomina'`. */
  clave: string | null
  es_sistema: boolean
  activo: boolean
  orden: number
  /** Subcategorías (solo en las de primer nivel, al agruparlas el servicio). */
  subcategorias?: CategoriaGasto[]
}

/** Fila de `gastos`. Montos en `moneda`; los totales se suman con `monto_usd`. */
export interface Gasto {
  id: string
  /** Fecha del gasto (imputación, P2). */
  fecha: string
  categoria_id: string
  descripcion: string
  beneficiario: string | null
  moneda: Moneda
  monto: number
  /** Obligatorias salvo en `pendiente` / `descartado`. */
  tasa_snapshot: number | null
  tasa_origen: 'referencial' | 'manual' | null
  tasa_fuente: 'bcv' | 'paralela' | null
  tasa_referencial: number | null
  monto_usd: number | null
  metodo_pago: MetodoPago | null
  referencia: string | null
  notas: string | null
  periodo_desde: string | null
  periodo_hasta: string | null
  /** Pago de nómina (Fase B): no nulo ⇔ categoría Nómina. */
  empleado_id: string | null
  /** Plantilla que generó este gasto (Fase C). */
  recurrente_id: string | null
  estado: EstadoGasto
  confirmado_por: string | null
  confirmado_at: string | null
  /** Quién anuló o descartó, y cuándo. */
  anulado_por: string | null
  anulado_at: string | null
  motivo_anulacion: string | null
  created_at: string
  created_by: string
  updated_at: string
  updated_by: string | null
}

/** Gasto con los nombres para la trazabilidad (`GastoDetalleDialog`). */
export interface GastoDetalle extends Gasto {
  categoria_nombre: string | null
  /** Nombre de la categoría padre si el gasto está en una subcategoría. */
  categoria_padre_nombre: string | null
  /** Empleado del pago de nómina. */
  empleado_nombre: string | null
  /** Nombre de la plantilla recurrente si fue generado por una. */
  recurrente_nombre: string | null
  creado_por_nombre: string | null
  confirmado_por_nombre: string | null
  anulado_por_nombre: string | null
  actualizado_por_nombre: string | null
}

/**
 * Total de gastos confirmados por categoría de primer nivel y subcategoría
 * (mismo shape que la RPC `dashboard_gastos` de la Fase D).
 */
export interface GastoPorCategoria {
  categoria_id: string
  categoria: string
  es_sistema: boolean
  subcategoria_id: string | null
  subcategoria: string | null
  total_usd: number
  n_gastos: number
}

/** Resumen de los gastos confirmados de un rango (`gastoService.resumenGastos`). */
export interface ResumenGastos {
  total_usd: number
  n_gastos: number
  por_categoria: GastoPorCategoria[]
}

/** `dashboard_gastos_pendientes()` (20-gastos, Fase D). */
export interface GastosPendientesResumen {
  n: number
  /** Suma de importes de los pendientes en USD; `null` si no hay pendientes en USD. */
  monto_usd_estimado: number | null
}

/**
 * Cálculo de utilidad neta para el dashboard (`lib/dashboard/utilidad.ts`).
 * Utilidad neta = margen bruto (B3) − gastos confirmados del período.
 * El resultado cambiario no se suma (regla de 15).
 */
export interface UtilidadNeta {
  ventas_usd: number
  margen_bruto_usd: number
  gastos_usd: number
  utilidad_neta_usd: number
  /** Fracción sobre ventas (para `formatPct`). `null` si ventas es 0 o negativo. */
  margen_neto_pct: number | null
}

/** Bloque de gastos y utilidad neta en la analítica del dashboard (15 + 20). */
export interface DashboardGastos {
  utilidad: UtilidadNeta
  por_categoria: GastoPorCategoria[]
  total_gastos_usd: number
}

/**
 * Fila de `empleados` (20-gastos, Fase B). Un pago de nómina es un gasto de
 * la categoría Nómina con `empleado_id`. Se desactiva, no se borra.
 */
export interface Empleado {
  id: string
  nombre: string
  /** `V-`/`E-` + dígitos (formato de `RifCiField`), única. */
  cedula: string
  cargo: string | null
  /** Salario MENSUAL (P3) en `moneda`; la quincena precarga la mitad. */
  salario_base: number
  moneda: Moneda
  activo: boolean
  notas: string | null
  created_at: string
  created_by: string
  updated_at: string
  updated_by: string | null
}

/**
 * Costo de un empleado en un rango (`empleadoService.getCostoEmpleado`):
 * solo pagos `confirmado` por `fecha` (P2); anulados fuera.
 */
export interface CostoEmpleado {
  empleado_id: string
  rango: RangoFechas
  /** Σ `monto_usd` de los pagos confirmados. */
  total_usd: number
  /** Equivalente en Bs a la tasa de cada pago: Σ `monto_usd × tasa_snapshot`. */
  total_bs: number
  n_pagos: number
  /** Meses calendario que toca el rango (mínimo 1). */
  meses: number
  /** `total_usd / meses`. */
  promedio_mensual_usd: number
}

/* ==================== Gastos recurrentes (20-gastos, Fase C) ==================== */

export type FrecuenciaGasto = 'mensual' | 'quincenal'

/**
 * Fila de `gastos_recurrentes` (20-gastos, Fase C): plantilla que genera
 * gastos periódicos en estado `pendiente` de confirmar.
 */
export interface GastoRecurrente {
  id: string
  nombre: string
  categoria_id: string
  empleado_id: string | null
  descripcion: string
  beneficiario: string | null
  moneda: Moneda
  /**
   * Monto fijo; `null` solo en nómina (`empleado_id` no nulo) para usar el
   * salario base vigente del empleado.
   */
  monto: number | null
  frecuencia: FrecuenciaGasto
  /** Día del mes (1 a 28, solo mensual); `null` = último día del mes. */
  dia_mes: number | null
  fecha_inicio: string
  fecha_fin: string | null
  metodo_pago: MetodoPago | null
  activo: boolean
  created_at: string
  created_by: string
  updated_at: string
  updated_by: string | null
  // Nombres poblados en listados/detalles
  categoria_nombre?: string | null
  empleado_nombre?: string | null
}

export interface PeriodoRecurrente {
  desde: string
  hasta: string
  fecha_programada: string
}
