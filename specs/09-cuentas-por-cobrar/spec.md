# 09 — Cuentas por cobrar: estado de facturas por cliente y recordatorios

## Contexto

Pedido del cliente (2026-10-07):
- En el **listado de clientes**, ver de un vistazo cuántas facturas tiene **pagadas, pendientes por pagar y vencidas**: una columna "Facturas" con un ícono y un tooltip.
- En la **ficha del cliente**, una sección con sus facturas y la opción de **enviar un recordatorio** de las pendientes y vencidas, **por WhatsApp y por correo**.
- El usuario pide **componentizar y aplicar SOLID**, porque lo mismo se usará en el módulo de **Cobros y pagos** (hoy `/cobros` de `05-ventas`; más adelante también las cuentas por pagar a proveedores).

Puntos de partida en el código:
- **Las facturas no tienen fecha de vencimiento** (`facturas`, `0001`), así que el estado "vencida" no existe todavía. Este módulo lo crea.
- La ficha del cliente (`clientes/[id]/cliente-ficha.tsx`) consulta `facturas` y `pedidos` **directamente con supabase-js desde el navegador**, saltándose repositorios y servicios (rompe la Definition of Done). Se corrige aquí.
- `/cobros` tiene su propia tabla (`FacturasAbiertasTable`), que no se puede reutilizar desde la ficha. Se reemplaza por la tabla genérica de este módulo.

## Decisiones

| Tema | Decisión | Estado |
|---|---|---|
| Canal del recordatorio | **WhatsApp y correo**. WhatsApp: el sistema arma el mensaje y abre WhatsApp (enlace `wa.me`) con el texto listo; el usuario lo envía desde su teléfono o computadora. Correo: lo envía el sistema (Resend). | **Confirmada** por el usuario (2026-10-07) |
| Vencimiento | **Variable por cliente y por factura.** Cada cliente tiene sus días de crédito habituales (`clientes.dias_credito`; los clientes antiguos o que compran más pueden tener más días), con un valor por defecto en `config_negocio.dias_credito_default` (15). **Al emitir la venta se indican los días de crédito de esa factura**: precargados con los del cliente, editables. La factura guarda `dias_credito` y `fecha_vencimiento = fecha + días`. | **Confirmada** (2026-10-07) |
| Permisos | Hoy **no hay operadores** en el negocio. Por ahora: el operador ve cantidades por estado sin montos; **montos, saldos y envío de recordatorios, solo admin**. | **Confirmada** (2026-10-07). **Más adelante**: permitir que el operador envíe recordatorios (con mensaje sin montos o viendo montos en esta sección); ver "Fuera de alcance". |

## Dominio compartido (SOLID)

El núcleo no depende de "factura" ni de "cliente": trabaja sobre un **documento de cartera**. Así sirve igual para cuentas por cobrar (facturas) y, después, para cuentas por pagar (compras a proveedores), sin modificar el núcleo (abierto/cerrado).

```ts
// src/lib/cartera/types.ts
interface DocumentoCartera {
  id: string
  numero: string            // "F-000123" (factura) / "C-…" (compra, más adelante)
  fecha: string
  fecha_vencimiento: string
  total_usd: number
  pagado_usd: number
  creditos_usd: number      // notas de crédito emitidas sobre el documento
  anulado: boolean
}
type EstadoCartera = 'pagada' | 'pendiente' | 'por_vencer' | 'vencida' | 'anulada'
interface ResumenCartera {
  conteo: Record<EstadoCartera, number>
  saldo_usd: number | null          // null si el rol no ve montos
  saldo_vencido_usd: number | null
  vencida_mas_antigua_dias: number | null
  ultimo_recordatorio: { fecha: string; canal: CanalRecordatorioId } | null
}
```

| Pieza | Responsabilidad única | Ubicación |
|---|---|---|
| `estadoCartera(doc, hoy, diasAviso)` | Estado de un documento. Saldo = `total − pagado − créditos`. `anulada` si está anulado; `pagada` si saldo ≤ 0,005; `vencida` si `hoy > fecha_vencimiento`; `por_vencer` si vence en ≤ `diasAviso` días; si no, `pendiente`. | `lib/cartera/estado.ts` (pura) |
| `resumirCartera(docs, hoy, cfg)` | Conteos, saldos y antigüedad de la vencida más vieja. | `lib/cartera/resumen.ts` (pura) |
| `construirRecordatorio(datos, canal)` | Texto de WhatsApp o `{ asunto, html, texto }` del correo, a partir del cliente, sus documentos y los datos del negocio. | `lib/cartera/recordatorios/plantillas.ts` (pura) |
| `CanalRecordatorio` (Strategy) | `disponible(cliente) → { ok } \| { ok: false, motivo }` y `entregar(mensaje) → ResultadoEntrega`. Implementaciones `whatsappCanal` (devuelve la URL `wa.me`; no envía nada) y `emailCanal` (envía por la API REST de Resend con `fetch`, sin SDK). Agregar SMS después = otra implementación, sin tocar el servicio. | `lib/cartera/recordatorios/canales/*.ts` |
| `telefonoAWhatsApp(tel)` | `0412-1234567` → `584121234567`; `null` si no es un móvil venezolano válido (reusa `TELEFONO_VE_REGEX`). | `lib/cartera/recordatorios/telefono.ts` (pura) |
| `ICarteraRepository` | Lectura: `resumenPorCliente()` (una consulta a la vista, sin N+1) y `documentosPorCliente(id)`. | `lib/repositories/carteraRepository.ts` |
| `IRecordatorioRepository` | `registrar(...)`, `listByCliente(id)`, `ultimoPorCliente(id)`. | `lib/repositories/recordatorioRepository.ts` |
| `carteraService` | Orquesta repos + funciones puras y **aplica el rol** (anula montos para el operador). | `lib/services/carteraService.ts` |
| `recordatorioService` | Valida (admin, cliente activo, al menos una factura pendiente o vencida, canal disponible), arma el mensaje, entrega por el canal, registra el envío y avisa si ya hubo un recordatorio en las últimas 24 h. | `lib/services/recordatorioService.ts` |

## Modelo de datos

| Cambio | Detalle |
|---|---|
| `facturas.dias_credito` | `int not null default 0 check (dias_credito between 0 and 365)`: días otorgados **en esa factura** (snapshot; si después cambian los días del cliente, la factura no cambia). Contado: 0. |
| `facturas.fecha_vencimiento` | `date not null`, `check (fecha_vencimiento = fecha + dias_credito)`, así nunca se desincronizan. Contado: `= fecha`. Crédito: `fecha + dias_credito`. **Sin backfill**: `07-lotes` vacía las facturas de prueba. Si este módulo se ejecuta antes que `07`, se asigna `dias_credito = 0` / `fecha_vencimiento = fecha` a las de prueba existentes. Índice `(cliente_id, estado, fecha_vencimiento)`. |
| `clientes.dias_credito` | `int null check (dias_credito between 0 and 365)`; `null` = usa el valor por defecto. |
| `config_negocio` | `+ dias_credito_default int not null default 15`, `+ dias_aviso_por_vencer int not null default 3`, `+ instrucciones_pago text` (datos de pago del negocio que se incluyen en el recordatorio: Pago Móvil, cuentas, Zelle), `+ nombre_comercial text default 'Altamar Sea Food'`. |
| `recordatorios_cobro` (nueva) | `id, cliente_id FK, canal check (whatsapp, email), destinatario text, asunto text null, mensaje text, estado check (generado, enviado, fallido), error text null, proveedor_id_mensaje text null (id de Resend), enviado_por uuid default auth.uid(), created_at`. WhatsApp queda `generado` (el sistema no puede saber si el usuario apretó enviar); correo, `enviado` o `fallido`. |
| `recordatorio_facturas` (nueva) | `(recordatorio_id FK cascade, factura_id FK)`, pk compuesta: qué facturas incluyó cada recordatorio. |
| Vista `cartera_clientes_view` | Por cliente: conteos por estado (calculados en SQL con la misma regla que `estadoCartera`; la función TS es la referencia y la vista la replica, con comentario cruzado), saldo y saldo vencido (**`null` si `not es_admin()`**, patrón de `0003`), días de la vencida más antigua y último recordatorio. `security definer` como las vistas de `0003`. |

RLS: `recordatorios_cobro` y `recordatorio_facturas` → select para `authenticated` (el operador ve que se recordó, no el mensaje: la vista `recordatorios_cobro_view` anula `mensaje` si no es admin); insert solo vía `recordatorioService` con sesión de admin (`with check (es_admin())`).

## Correo (Resend)

- Envío desde el servidor (Server Action → `recordatorioService` → `emailCanal`) con `RESEND_API_KEY` y `RECORDATORIO_EMAIL_FROM` (ej. `cobranza@altamarseafood.com`). **Requiere verificar un dominio en Resend** (registros DNS): es un paso del usuario y queda como pendiente.
- **Sin las variables de entorno, el canal correo aparece deshabilitado** con el motivo "Correo no configurado" (no rompe nada). WhatsApp funciona sin configuración.
- Plantilla HTML simple, con estilos en línea y ancho máximo de 600 px: encabezado con el nombre comercial y una franja con los colores de marca (los correos no usan el tema MUI; aquí se permiten hex de `palette.brand`, documentado como excepción), saludo, tabla de facturas (número, fecha, vencimiento, saldo USD y equivalente en Bs a la tasa vigente, estado), total, instrucciones de pago y un pie con "responder a este correo". Versión de texto plano siempre incluida.
- `reply_to` = correo del negocio en `config_negocio` (si existe).

## WhatsApp

- `https://wa.me/<584XXXXXXXXX>?text=<mensaje codificado>`, abierto en una pestaña nueva **en el mismo gesto del clic** (si se abre después de un `await`, el navegador lo bloquea como popup). Por eso el registro del recordatorio se hace en paralelo o después de abrir la pestaña.
- Mensaje corto, en texto plano y con el formato de WhatsApp (`*negrita*`): saludo, lista de facturas (número, vencimiento, saldo) con las vencidas primero y marcadas, total adeudado, instrucciones de pago y cierre. Montos con `formatUsd` / `formatBs`.
- El texto es **editable** en el diálogo antes de abrir WhatsApp. Lo que se registra es el texto final.

## Pantallas

### Listado `/clientes`: columna "Facturas"

- `molecules/CarteraIndicador`: ícono `ReceiptLong` con `Badge`.
  - Color por el peor estado: **rojo** si hay vencidas (badge = cantidad de vencidas), **ámbar** si hay por vencer o pendientes (badge = pendientes + por vencer), **neutro** sin deuda (sin badge), atenuado si el cliente no tiene facturas.
  - Tooltip: "Pagadas 12 · Pendientes 2 · Por vencer 1 · **Vencidas 1** (hace 9 días)". Admin además ve "Saldo $ 340,00 · Vencido $ 120,00". Al final, "Último recordatorio: WhatsApp, hace 2 días".
  - Accesible: `aria-label` con el mismo resumen y tooltip también al foco del teclado. En táctil, `enterTouchDelay={0}`: tocar muestra el tooltip sin abrir la ficha (`stopPropagation`).
- La columna es **esencial** (visible en `xs`, solo el ícono, unos 64 px). Se ordena por gravedad (vencidas, luego pendientes).
- Filtro rápido "Con facturas vencidas" en la barra de la tabla.
- Los datos llegan del servidor en la misma carga del listado (`carteraService.resumenPorCliente()`, una consulta).

### Ficha `/clientes/[id]`: sección "Facturas y cobranza"

- **Resumen** (`molecules/CarteraResumenCards`): cuatro tarjetas (Vencidas, Por vencer, Pendientes, Pagadas), cada una con su cantidad y, para el admin, su monto. La tarjeta de vencidas con acento de error si es > 0. Tocar una tarjeta filtra la tabla por ese estado.
- **Tabla** (`organisms/DocumentosCarteraTable`): número, fecha, vencimiento ("vence en 3 días" / "vencida hace 9 días"), total, abonado, saldo (montos solo admin), `EstadoCarteraChip`. Orden por defecto: vencidas por antigüedad, luego por vencer, pendientes y pagadas. Chips de filtro por estado y "Ver anuladas" apagado por defecto.
- Botón **"Enviar recordatorio"** (admin), deshabilitado con tooltip si no hay nada pendiente.
- **Historial de recordatorios** (`organisms/HistorialRecordatorios`): fecha, canal, destinatario, quién y estado. Si el correo falló, se muestra el error y "Reintentar".
- Los datos llegan del **servidor** (`page.tsx` → `carteraService` / `recordatorioService`), no desde el navegador; también los pedidos pasan a cargarse por servicio.

### `organisms/RecordatorioDialog`

1. **Facturas a incluir**: lista con casillas, preseleccionadas las vencidas y por vencer (las pendientes también, desmarcables), con el total que se va a recordar actualizándose en vivo.
2. **Canal**: `ToggleButtonGroup` WhatsApp / Correo. Un canal no disponible queda deshabilitado con su motivo ("El cliente no tiene teléfono móvil válido", "El cliente no tiene correo", "Correo no configurado") y un enlace "Editar cliente".
3. **Vista previa editable**: WhatsApp en un `TextField` multilínea; correo con asunto editable y vista previa HTML (en un `iframe` `sandbox`, sin scripts) más el texto plano editable.
4. **Aviso** si ya se envió un recordatorio en las últimas 24 h ("Ya se le recordó hoy por WhatsApp a las 10:15").
5. **Acción**: "Abrir WhatsApp" (abre la pestaña y luego registra; toast "Recordatorio registrado") o "Enviar correo" (loader interno, toast con el resultado y el error legible si falla).
- `fullScreen` en `xs`, pasos con `Collapse` y `Fade` (tokens del theme).

### `/cobros` (refactor, `05-ventas`)

- Reemplazar `FacturasAbiertasTable` por `DocumentosCarteraTable` con la columna de cliente y la acción "Registrar abono" (render prop o slot de acciones: la tabla no sabe qué es un abono).
- Agregar la columna de estado y vencimiento, el filtro "Vencidas" y el orden por antigüedad. Atajo "Recordar" por fila (admin) que abre el mismo `RecordatorioDialog`.

### Emisión de factura (`05-ventas`, cambio)

- POS y entrega de pedido a **crédito**: campo **"Días de crédito"** (`NumberField` entero, 0–365) precargado con los días del cliente (o el default), con atajos 7 / 15 / 30 y debajo "Vence el lun 20/10/2026" calculado en vivo. Si se cambian los días respecto del cliente, aparece el texto "Distinto a lo habitual del cliente (15 días)". En contado el campo se oculta (0 días).

### Formulario de cliente y configuración

- `ClienteForm`: campo "Días de crédito" (opcional; placeholder "Por defecto: 15").
- `ConfigNegocioForm`: días de crédito por defecto, días de aviso "por vencer", nombre comercial, correo de respuesta e instrucciones de pago (texto multilínea con vista previa de cómo sale en el mensaje).

## Componentes compartidos nuevos (registrar en `00-estandares-ui`)

| Componente | Capa | Reutilizado en |
|---|---|---|
| `EstadoCarteraChip` | atom | ficha cliente, `/cobros`, futuro CxP |
| `CarteraIndicador` | molecule | listado clientes, futuro listado proveedores |
| `CarteraResumenCards` | molecule | ficha cliente, encabezado de `/cobros` (totales globales) |
| `DocumentosCarteraTable` | organism | ficha cliente, `/cobros`, futuro CxP |
| `RecordatorioDialog`, `HistorialRecordatorios` | organism | ficha cliente, `/cobros` |

Las props de estos componentes usan `DocumentoCartera` / `ResumenCartera`, nunca `Factura`. Los adaptadores `facturaADocumentoCartera()` (ahora) y `compraADocumentoCartera()` (después) viven junto a sus repositorios.

## Preparado para cuentas por pagar (fuera de alcance aquí)

Para la columna "Compras por pagar" en proveedores y la vista de vencidas en pagos a proveedores, más adelante bastará con:
1. `compras.fecha_vencimiento` + `proveedores.dias_credito`;
2. el adaptador `compraADocumentoCartera`;
3. reutilizar `CarteraIndicador`, `CarteraResumenCards` y `DocumentosCarteraTable` sin modificarlos.

Sin recordatorios: a un proveedor no se le cobra. Queda anotado en `specs/README.md` como siguiente paso del módulo de "Cobros y pagos".

## Fuera de alcance (MVP)

- **Envío de recordatorios por el operador** (decidido el 2026-10-07: hoy no hay operadores; se evalúa cuando los haya).
- Recordatorios **automáticos** programados (ej. al día siguiente de vencer). La arquitectura lo permite (cron + `recordatorioService`), pero el envío queda manual.
- API oficial de WhatsApp Business (envío desde el servidor, confirmación de entrega). Hoy se usa `wa.me` (el usuario envía).
- Estado de cuenta en PDF adjunto al correo.
- Intereses o recargos por mora.
- Seguimiento de apertura o lectura del correo.
