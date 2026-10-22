# 21 — Cotizaciones (PDF, WhatsApp y enlace público)

## Contexto

Pedido del usuario (2026-10-22), texto literal: «Necesito hacer la planificacion de un modulo de cotizaciones, donde podamos generar un PDF y que este pueda ser enviado al cliente, donde selecciones los productos, precio, se muestre el total y que se genere un documento pdf si lo queremos compartir por wsp al cliente, tambien tener la opcion de un link publico para que el cliente entre y vea el link en linea».

Una cotización es un **documento comercial previo a la venta**: no mueve stock, no reserva lotes, no genera deuda ni factura y no guarda costos. Por eso no toca ninguna decisión cerrada de `/SPEC.md` §2 (tasa snapshot, costeo por lote, crédito, facturación): solo **lee** clientes, productos y configuración. Es solo en USD: no usa tasas de cambio ni muestra Bs (P1). La conversión en pedido (Fase D, P8) usa el flujo de pedidos de `05-ventas` tal como está.

Lo que existe hoy y se reutiliza (sin reimplementarlo):

| Pieza existente | Dónde | Uso en este módulo |
|---|---|---|
| Clientes (nombre, `rif_ci`, `telefono`, `aplica_iva`, `bloqueado`) | `02-clientes`, `clienteService`, `Cliente` en `src/types/domain.ts` | Cliente registrado de la cotización; precarga del IVA (18) |
| Productos y precio de referencia USD/kg | `04-inventario`, `16` (`productos.precio_referencia_usd_kg`, solo procesados) | Líneas: producto del catálogo y precio precargado |
| Totales e IVA de factura | `src/lib/facturas/totales.ts` (`subtotalItems`, `ivaSobre`, `redondea6`), `src/lib/facturas/iva.ts` (`ivaPctVenta`, `etiquetaIva`) | Misma aritmética y redondeo; IVA sí/no al % de `config_negocio` (`/SPEC.md` §2, `specs/18-iva-opcional`) |
| Datos del negocio para encabezado | `config_negocio` (`nombre_comercial`, `razon_social`, `rif`, `direccion`, `telefono`, `instrucciones_pago`; 06/09) | Encabezado y pie del PDF y de la página pública |
| PDF en servidor | `@react-pdf/renderer` (ya en `package.json`), `contratoPdfService.ts` (`renderToBuffer`), `src/lib/contratos/plantillas/*` | Mismo motor y patrón de plantillas puras |
| WhatsApp | `telefonoAWhatsApp` (`src/lib/cartera/recordatorios/telefono.ts`), `urlWhatsApp` (`.../canales/whatsapp.ts`), regla de 09 «abrir `wa.me` en el mismo gesto del clic» | Botón «Enviar por WhatsApp» y contacto al negocio desde la página pública de respaldo |
| Marca | `atoms/BrandMark` (isotipo provisional), tokens `palette.brand.*` en `src/theme/theme.ts`, identidad «Peñero» (`specs/00-estandares-ui/spec.md`) | PDF y página pública con la identidad de Altamar Sea Food |
| Protección de rutas | `proxy.ts` (matcher que excluye `login`, `recuperar`, …) | Excluir la ruta pública `/c/` |
| URL base absoluta | `process.env.SITE_URL` (ya usada en `src/app/(auth)/recuperar/actions.ts`) | Armar el enlace público que se comparte |
| Componentes de 00 Fase 2 | `AppDataGrid`, `AppDialog`, `FichaHeader`, `FormSection`, `NumberField`, `StatusChips`, `RowActionsMenu`, `CopyableText`, `EmptyState`, `RangoFechasSelector`, `PageHeader` | Toda la UI interna |

Depende de `02-clientes`, `04-inventario`, `18-iva-opcional` y `00-estandares-ui` Fase 2 (hechos); reutiliza piezas de `06-contratos` y `09-cuentas-por-cobrar` (hechos). La Fase D (opcional) usa `05-ventas`. **No depende de `20-gastos`** y puede ir en paralelo con sus fases B–E.

## Decisiones cerradas (2026-10-22, con el usuario)

P1–P10 las respondió el usuario el 2026-10-22 (detalle y opciones descartadas en «Decisiones de diseño P1–P10» al final). Se aprobó la recomendación de todas, salvo dos cambios: en **P1** se elimina el equivalente en Bs y en **P7** el enlace deja de mostrar la cotización en cuanto vence, sin gracia.

| Tema | Decisión |
|---|---|
| Moneda **(P1)** | Precios en **USD/kg** (moneda base de `/SPEC.md` §2) y total en USD. **Sin equivalente en Bs** en pantalla, PDF ni enlace público, y sin tasa de cambio: el módulo no usa `08-tasas`. |
| Unidad | Siempre **kg** (`numeric(12,3)`), como toda venta (`/SPEC.md` §2 "Inventario por peso"). |
| IVA **(P1)** | Opcional en cada cotización: el interruptor sí/no se precarga con `clientes.aplica_iva` (cliente libre: sí) y se activa o desactiva en esa cotización; sí = `config_negocio.iva_pct` vigente al guardar, no = 0 % (regla de `specs/18-iva-opcional`). |
| Descuento **(P2)** | Un descuento **global en USD** (≥ 0, ≤ subtotal); el IVA se calcula sobre `subtotal − descuento`. Sin descuento por línea. |
| Validez | `validez_dias` (1–90) con default nuevo `config_negocio.cotizacion_validez_dias` (7); `fecha_vencimiento = fecha + validez_dias`. |
| Numeración **(P3)** | Correlativo por secuencia Postgres (patrón `0015_facturas_secuencia.sql`), asignado al crear el borrador, mostrado como `COT-000123`. Los anulados conservan su número (puede haber saltos). |
| Roles **(P4)** | **Admin y operador** crean, editan, comparten, cambian estado y anulan (igual que `pedidos`, RLS `authenticated`). La cotización no tiene costos ni márgenes, así que no hay columnas sensibles (`/SPEC.md` §5 Notas). |
| Estados **(P5)** | Guardados: `borrador`, `enviada`, `aceptada`, `rechazada`, `anulada`. **`vencida` es derivada** (como el estado de cobro de 09): `estado in ('borrador','enviada') and fecha_vencimiento < hoy (Caracas)`. Sin cron. |
| Edición **(P5)** | Se edita en `borrador` y `enviada` (el enlace público siempre muestra la versión vigente; un PDF ya enviado por WhatsApp queda desactualizado y se avisa con «Actualizada el …»). `aceptada`, `rechazada` y `anulada` son inmutables; para cambiar algo se usa **Duplicar**. |
| Cliente | Registrado (`cliente_id`) **o** libre (`cliente_nombre` + `cliente_telefono` opcional). Un cliente bloqueado se puede cotizar (el bloqueo de `02-clientes` solo impide crédito), con aviso visible. |
| PDF **(P6)** | `@react-pdf/renderer` renderizado **al vuelo en route handlers** (Node), no se guarda en storage (a diferencia de `06-contratos`, la cotización es editable y el enlace debe reflejar la versión vigente). Ver "PDF". |
| Enlace público **(P7)** | Token aleatorio (192 bits, `base64url`) en `cotizaciones.token_publico`; la tabla **nunca** se expone a `anon`: la lectura anónima pasa solo por la RPC `cotizacion_publica(token)` `security definer`. Se puede **revocar** y **regenerar**. Ruta corta `/c/[token]`. **Solo muestra la cotización y su PDF mientras está vigente** (`hoy ≤ fecha_vencimiento`). Vencida: página de respaldo con la marca («Esta cotización venció. Escríbenos por WhatsApp para una nueva»), **sin datos de la cotización ni PDF**. Revocada, anulada, en borrador o token inexistente: página de respaldo genérica que no revela nada. Sin gracia tras el vencimiento. |
| Compartir | Diálogo «Compartir»: **Web Share API con el archivo PDF** cuando `navigator.canShare({ files })` lo permite (móvil), y siempre **WhatsApp por `wa.me`** con mensaje prellenado y el enlace público, **Copiar enlace** y **Descargar PDF**. Compartir pasa un borrador a `enviada`. |
| Conversión en pedido **(P8)** | Fase D (aprobada): «Convertir en pedido» desde una cotización aceptada con cliente registrado crea un pedido de `05-ventas` con sus líneas (peso estimado y precio pactado); la cotización guarda `pedido_id`. |

## Modelo de datos

Dinero `numeric(14,6)`, kg `numeric(12,3)` (`/SPEC.md` §5). Sin columnas de tasa (P1). Auditoría con el trigger genérico `fija_auditoria()` que crea `20-gastos` (Fase A, migración `20261022000000_gastos_esquema.sql`, ya aplicada): `created_at`, `created_by default auth.uid()`, `updated_at`, `updated_by`.

### `cotizaciones` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `numero` | bigint not null unique default `nextval('cotizaciones_numero_seq')` | Formato `COT-` + 6 dígitos en la UI/PDF (P3) |
| `fecha` | date not null default hoy (Caracas) | No futura |
| `validez_dias` | smallint not null check `between 1 and 90` | Default desde `config_negocio.cotizacion_validez_dias` (lo pone el servicio) |
| `fecha_vencimiento` | date not null | `= fecha + validez_dias` (check) |
| `cliente_id` | uuid null FK `clientes` | |
| `cliente_nombre` | text null | Solo cliente libre, 2–120 |
| `cliente_telefono` | text null | Solo cliente libre; formato de `PhoneField` |
| `estado` | text not null default `'borrador'` check `in ('borrador','enviada','aceptada','rechazada','anulada')` | `vencida` derivada (P5) |
| `iva_pct` | numeric(5,2) not null check `between 0 and 100` | 0 = sin IVA |
| `subtotal_usd` | numeric(14,6) not null | `Σ subtotal_usd` de las líneas |
| `descuento_usd` | numeric(14,6) not null default 0, check `>= 0 and <= subtotal_usd` | P2 |
| `iva_usd` | numeric(14,6) not null | `ivaSobre(subtotal − descuento, iva_pct)` |
| `total_usd` | numeric(14,6) not null | `subtotal − descuento + iva` |
| `notas_cliente` | text null | ≤ 1000. Se imprime en el PDF y en la página pública |
| `notas_internas` | text null | ≤ 500. **Nunca** sale en el PDF ni en la RPC pública |
| `terminos` | text null | ≤ 2000. Condiciones; precargadas con `config_negocio.cotizacion_terminos` |
| `token_publico` | text null unique, check `char_length = 32` | P7. `null` = sin enlace o revocado |
| `token_generado_at`, `token_generado_por` | timestamptz null, uuid null FK `perfiles` | Último enlace generado |
| `enviada_at`, `enviada_por` | timestamptz null, uuid null FK `perfiles` | Primera vez que pasó a `enviada` |
| `respondida_at`, `respondida_por` | timestamptz null, uuid null FK `perfiles` | Paso a `aceptada`/`rechazada` |
| `motivo_rechazo` | text null | ≤ 500, opcional |
| `anulada_at`, `anulada_por`, `motivo_anulacion` | timestamptz null, uuid null, text null | Motivo opcional ≤ 500 |
| `pedido_id` | uuid null unique FK `pedidos` | **Fase D** (P8) |
| auditoría | | `fija_auditoria()` |

Checks: `cotizaciones_cliente` = `(cliente_id is not null and cliente_nombre is null and cliente_telefono is null) or (cliente_id is null and cliente_nombre is not null)`; `cotizaciones_vencimiento` = `fecha_vencimiento = fecha + validez_dias`; `cotizaciones_total` = `total_usd = round(subtotal_usd - descuento_usd + iva_usd, 6)`; `cotizaciones_token_estado` = `token_publico is null or estado <> 'anulada'`.

Índices: `(fecha desc)`, `(estado, fecha_vencimiento)`, `(cliente_id) where cliente_id is not null`, único de `token_publico` (ya por `unique`).

### `cotizacion_items` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `cotizacion_id` | uuid not null FK `cotizaciones` on delete cascade | Solo se borran al reemplazar las líneas dentro de `guardar_cotizacion` |
| `orden` | smallint not null | Orden de presentación |
| `producto_id` | uuid not null FK `productos` | Activo al guardar |
| `producto_nombre` | text not null | **Snapshot** del nombre (el documento no cambia si se renombra el producto) |
| `peso_kg` | numeric(12,3) not null check > 0 | |
| `precio_usd_kg` | numeric(14,6) not null check >= 0 | Precargado con `precio_referencia_usd_kg`, editable (P9) |
| `subtotal_usd` | numeric(14,6) not null | `= round(peso_kg × precio_usd_kg, 6)` (check) |
| `nota` | text null | ≤ 200 (p. ej. «limpio, en filetes de 200 g») |

Índice único `(cotizacion_id, orden)`. Máximo 50 líneas por cotización (lo valida la RPC). Un producto puede repetirse en varias líneas (presentaciones distintas).

### `config_negocio` (cambio — tarea agregada en `04-inventario`)

| Columna | Tipo | Nota |
|---|---|---|
| `cotizacion_validez_dias` | smallint not null default 7, check `between 1 and 90` | Default de validez |
| `cotizacion_terminos` | text null | ≤ 2000. Condiciones por defecto (forma de pago, despacho, «precios sujetos a disponibilidad»…) |

Editables en `ConfigNegocioForm` (nueva `FormSection` «Cotizaciones») y validadas en `configFormSchema`. RLS de `config_negocio` sin cambios.

### RLS

- `cotizaciones`: `enable row level security`; `select` y `update` para `authenticated` (P4: admin y operador, como `pedidos`); **sin** `insert` ni `delete` directos (el alta va por la RPC). `revoke all … from anon`; `revoke delete, truncate … from authenticated`.
- `cotizacion_items`: `select` para `authenticated`; **sin** `insert`/`update`/`delete` directos. `revoke all … from anon`.
- La escritura de cabecera + líneas va **solo** por la RPC `guardar_cotizacion` (`security definer`, atómica, reemplaza las líneas); los cambios de estado y de token son `update` de una fila de `cotizaciones`, controlados por el trigger `cotizaciones_guard`, que además impide cambiar por `update` directo las columnas que solo fija la RPC (importes, `iva_pct`, cliente, fechas, notas y términos; hint `usar_guardar_cotizacion`).

### Trigger `cotizaciones_guard` (`before update`)

- Transiciones permitidas: `borrador → enviada | aceptada | rechazada | anulada`, `enviada → aceptada | rechazada | anulada`, `aceptada → anulada` (solo si `pedido_id` es nulo), `rechazada → anulada`. Nada vuelve atrás. Hint `transicion_invalida`.
- En `aceptada`, `rechazada` y `anulada` no cambia ningún dato comercial (cliente, fechas, importes, notas, términos). Hint `cotizacion_inmutable`. El token sí puede revocarse o regenerarse en `aceptada`/`rechazada`.
- Fija `enviada_*` (primera vez), `respondida_*`, `anulada_*`; al anular pone `token_publico = null`.
- Una `vencida` (derivada) no puede pasar a `aceptada` sin antes **renovarse** (nueva `fecha`/`validez_dias` por la RPC). Hint `cotizacion_vencida`.
- `numero`, `created_*` no cambian nunca.

### RPC

| Función | Tipo | Nota |
|---|---|---|
| `guardar_cotizacion(p_id uuid, p_cabecera jsonb, p_items jsonb) → uuid` | `security definer`, `set search_path = public`; `42501` si `auth.uid()` es nulo o no tiene fila en `perfiles`. `cotizaciones_guard` deja pasar sus columnas porque dentro de la RPC `current_user` no es `authenticated` (mismo criterio que `categorias_gasto_guard` de 20) | Crea (`p_id` nulo) o edita (`borrador`/`enviada`, con `select … for update`). Valida cliente y productos activos, 1–50 líneas, fecha no futura; copia `producto_nombre`; **calcula en SQL** subtotales, descuento, IVA y total (fuente de verdad, misma regla que `lib/cotizaciones/totales.ts`); reemplaza las líneas. El `iva_pct` lo resuelve el servicio y llega en `p_cabecera`. Hints `cliente_requerido`, `producto_inactivo`, `sin_lineas`, `demasiadas_lineas`, `descuento_mayor_subtotal`, `fecha_futura`, `cotizacion_inmutable`. `grant execute … to authenticated` |
| `cotizacion_publica(p_token text) → jsonb` | `stable`, `security definer`, `set search_path = public` | **Única** puerta anónima (P7). Siempre devuelve `negocio` (`nombre_comercial`, `telefono`: datos públicos para el contacto de las páginas de respaldo) y un `resultado`: **`no_disponible`** si el token no tiene 32 caracteres, no existe (incluye revocado o regenerado) o la cotización es `borrador` o `anulada`, sin ningún otro dato y sin distinguir el motivo; **`vencida`** si existe, no es borrador ni anulada y `fecha_vencimiento < hoy (Caracas)`, en cualquier estado, solo con `numero` (para que el cliente la cite al pedir una nueva) y sin fechas, cliente, líneas ni importes; **`disponible`** en el resto, con `cotizacion`: número, fecha, vencimiento, `estado_publico` (`vigente`/`aceptada`/`rechazada`), cliente (nombre y `rif_ci` si es registrado), líneas (`producto_nombre`, `peso_kg`, `precio_usd_kg`, `subtotal_usd`, `nota`), totales, `iva_pct`, `notas_cliente`, `terminos`, `updated_at`, y del negocio además `razon_social`, `rif`, `direccion`. **Nunca** `notas_internas`, ids internos, usuarios ni `cliente_telefono`. `revoke … from public`; `grant execute … to anon, authenticated` |

### Vista `cotizaciones_listado_view`

`security_invoker = true`. Columnas: `id`, `numero`, `fecha`, `fecha_vencimiento`, `estado`, `estado_efectivo` (con `vencida` derivada), `cliente_id`, `cliente` (`coalesce(clientes.nombre, cliente_nombre)`), `telefono` (del cliente o libre), `total_usd`, `n_lineas`, `tiene_enlace` (`token_publico is not null`), `pedido_id`, `updated_at`. La usa el listado con paginación y filtros en servidor.

## Reglas de negocio

- **Totales** (puros en `src/lib/cotizaciones/totales.ts`, espejo de la RPC): `subtotal_linea = redondea6(peso × precio)`; `subtotal = Σ`; `base = subtotal − descuento`; `iva = ivaSobre(base, iva_pct)`; `total = redondea6(base + iva)`. Paridad TS ↔ SQL probada en el script.
- **Precio precargado (P9)**: al elegir el producto, `precio_referencia_usd_kg` si existe; si no (crudos), vacío y obligatorio. Siempre editable. Precio 0 permitido (muestra/obsequio) con aviso.
- **Solo USD (P1)**: ningún cálculo ni pantalla usa tasas de cambio; no se muestra equivalente en Bs.
- **IVA (P1)**: al crear, el interruptor se precarga con `ivaPctVenta(cliente.aplica_iva ?? true, config.iva_pct)`; activarlo o desactivarlo cambia solo esa cotización. Editar recalcula con el `iva_pct` vigente de config si el interruptor está en sí.
- **Renovar** una vencida (o cualquier `borrador`/`enviada`): fecha = hoy y validez nueva; recalcula IVA; conserva el token, así que el mismo enlace vuelve a mostrar la cotización (ya vigente).
- **Duplicar**: crea un `borrador` nuevo con cliente, líneas (precios tal cual), descuento, notas y términos; fecha hoy; sin token.
- **Aceptar / rechazar**: manual, por el personal (el cliente no responde desde el enlace en el MVP). Rechazar admite motivo opcional.
- **Anular**: motivo opcional; revoca el enlace. Una aceptada convertida en pedido no se anula (se anula el pedido en 05).
- **Enlace**: «Crear enlace» genera el token en el servidor (`crypto.randomBytes(24).toString('base64url')`) si no hay uno; «Regenerar» lo reemplaza (el anterior deja de funcionar al instante); «Revocar» lo pone en `null`. URL: `${SITE_URL}/c/${token}`.
- **Compartir** marca `enviada` si estaba en `borrador` (la marca se dispara en paralelo al abrir WhatsApp o la hoja de compartir, sin `await` previo, regla de 09).
- **Mensaje de WhatsApp** (`src/lib/cotizaciones/mensaje.ts`, puro): «Hola {cliente}, le enviamos la cotización {COT-000123} de {nombre_comercial} por {total USD} (válida hasta {fecha}). Puede verla y descargarla aquí: {url}». Número con `telefonoAWhatsApp` (cliente registrado o libre); si no hay móvil válido, `https://wa.me/?text=…` (el usuario elige el contacto).
- **Acceso público (P7)**: el enlace muestra la cotización y permite descargar el PDF **solo** con `resultado = disponible`. Vencida → página de respaldo «vencida»; cualquier otro caso → página de respaldo genérica. El PDF público nunca se genera fuera de `disponible`. Compartir una cotización vencida desde la ficha pide renovarla antes (el enlace no la mostraría).
- **Contacto desde el respaldo**: «Escribir por WhatsApp» al teléfono del negocio (`config_negocio.telefono` con `telefonoAWhatsApp`; si no es móvil, se muestra el número como texto). Mensaje: vencida → «Hola, la cotización {COT-000123} venció. Quisiera una nueva.»; genérica → «Hola, quisiera una cotización.» (puro, en `src/lib/cotizaciones/mensaje.ts`).

## PDF

- **Librería (P6)**: `@react-pdf/renderer` (ya instalada y probada en producción por `06-contratos` con `renderToBuffer` en Node; Next 16 la incluye en `serverExternalPackages` por defecto). Justificación: plantillas como componentes React puros y testeables, sin navegador headless (Puppeteer/Chromium no cabe cómodo en Vercel y es lento en frío), sin dependencia nueva, y el mismo patrón que el equipo ya mantiene. `pdf-lib` queda como alternativa documentada en 06; el render va detrás de `ICotizacionPdfRenderer` (Strategy), así que cambiar de motor no toca servicios ni UI.
- **Identidad visual**: encabezado con el isotipo de `BrandMark` dibujado con primitivas `Svg`/`Path`/`Polygon` de react-pdf (mismas coordenadas), «Altamar Sea Food» (o `nombre_comercial`), y las **franjas de la borda** (ocre, blanca, roja) como filete bajo el encabezado: es el único gesto decorativo, igual que en la app. Color de títulos y bordes de tabla: `brand.hull` (#0E4A5C) del modo claro. Tipografía **Barlow / Barlow Condensed** registrada con `Font.register` desde archivos TTF (licencia OFL) en `src/lib/pdf/fuentes/` (P6); si el registro falla, Helvetica. Los hex se toman de un módulo de constantes de marca compartido (`src/theme/marca.ts`, ver tarea agregada en 00), nunca sueltos en la plantilla.
- **Contenido** (carta, una o más páginas): encabezado (marca + datos del negocio de `config_negocio`); bloque «Cotización N.º COT-000123», fecha, «Válida hasta», estado si no es vigente (VENCIDA / ANULADA no se imprime: una anulada no tiene PDF); cliente (nombre, RIF/CI o teléfono si es libre); tabla de líneas (Producto + nota, Kg, Precio USD/kg, Subtotal USD) con cifras tabulares; totales (Subtotal, Descuento si > 0, IVA x % o «Sin IVA», **Total USD**; sin Bs, P1); notas para el cliente; términos; instrucciones de pago (`config_negocio.instrucciones_pago`) si existen; pie con número de página y «Documento no fiscal. Precios sujetos a disponibilidad de producto».
- **Entrega**: route handlers que responden `application/pdf` con `Cache-Control: no-store`, `Content-Disposition: inline` (o `attachment` con `?descargar=1`) y nombre `cotizacion-COT-000123.pdf`:
  - Interno: `GET /cotizaciones/[id]/pdf` (sesión requerida; 404 si no existe o está anulada).
  - Público: `GET /c/[token]/pdf` (vía `cotizacion_publica`): solo con `resultado = disponible`; en cualquier otro caso (vencida, revocada, anulada, inexistente) **no genera el PDF** y redirige (302, `no-store`) a `/c/[token]`, que muestra la página de respaldo. Encabezados `X-Robots-Tag: noindex` y `Referrer-Policy: no-referrer`.
- Formato de números y fechas con `lib/format.ts` (`formatUsd`, `formatKg`, `formatFecha`), como los contratos.

## Pantallas

`params`/`searchParams` son `Promise` en Next 16 y la página pública debe ser dinámica: revisar `node_modules/next/dist/docs/` (route handlers, `generateMetadata`, rendering dinámico) antes de escribirlas.

### `/cotizaciones` (admin y operador)

- `PageHeader` «Cotizaciones» con primario «Nueva cotización». Ítem de menú `{ href: '/cotizaciones', label: 'Cotizaciones', icon: <RequestQuoteOutlined /> }` en `NAV_ITEMS` (sin `adminOnly`, P4), junto a Pedidos.
- Filtros en URL: chips de estado `?estado=` (Todas · Borradores · Enviadas · Vencidas · Aceptadas · Rechazadas · Anuladas; por defecto «Abiertas» = borrador + enviada no vencidas), búsqueda `?q=` (número `cot123`/`COT-000123`/`123`, nombre o teléfono del cliente, normalizada como `AppDataGrid`), rango `?desde`/`?hasta` opcional (`RangoFechasSelector`).
- `organisms/CotizacionesTable` en `AppDataGrid` con **paginación en servidor** (tabla que crece, regla de 00) sobre `cotizaciones_listado_view`: Número, Fecha, Cliente (+ teléfono en `caption`), Total USD (derecha, tabular), Vence (fecha; en tono `warning` si faltan ≤ 2 días), Estado (chip; `vencida` derivada), ícono de enlace activo. Fila abre la ficha. `⋮`: Compartir, Descargar PDF, Editar, Duplicar, Anular. `mobileCard` en `xs`. `EmptyState` con «Nueva cotización».

### `/cotizaciones/[id]`

- `FichaHeader`: «COT-000123», cliente, chips de estado (y «Vencida», «Actualizada después de enviar»), primario **«Compartir»**; `⋮` Editar, Descargar PDF, Ver como el cliente (abre `/c/[token]` en pestaña nueva si hay enlace), Marcar aceptada, Marcar rechazada, Renovar, Duplicar, Convertir en pedido (Fase D), Anular.
- Secciones: «Detalle» (tabla de líneas y totales con el mismo layout que el PDF), «Cliente», «Notas y términos» (incluye notas internas, rotuladas «Solo interno»), «Enlace público» (`CopyableText` con la URL, generado por/cuándo, botones Regenerar y Revocar con `useConfirm`, o «Crear enlace»), «Historial» (creada, enviada, respondida, anulada: quién y cuándo).
- `loading.tsx` (`PageLoader ficha`), `error.tsx`, `not-found.tsx`.

### Diálogos

| Organism | Tamaño | Contenido |
|---|---|---|
| `CotizacionForm` | `AppDialog md` (`fullScreen` en `xs`) | Modos `crear` / `editar` / `duplicar` / `renovar`. `FormSection` «Cliente»: conmutador Registrado/Libre; Autocomplete de clientes activos (aviso si bloqueado) o nombre + `PhoneField`. `FormSection` «Productos»: `CotizacionItemsFieldArray` (Autocomplete de productos activos, kg `NumberField` 3 dec., precio USD/kg 2–6 dec. precargado, nota, subtotal en vivo, quitar/reordenar; tarjetas en `xs`). `FormSection` «Totales»: interruptor IVA (precargado), descuento USD, resumen en vivo (subtotal, descuento, IVA, total USD). `FormSection` «Condiciones»: fecha (máx. hoy), validez en días (muestra la fecha de vencimiento), notas para el cliente, términos (precargados), notas internas. `useForm({ disabled })`, `Button loading`, cierre protegido con `dirty`, errores de `hint` en su campo |
| `CompartirCotizacionDialog` | `AppDialog sm` | Si la cotización está vencida, no comparte: muestra «Renueva la cotización antes de compartirla» con el botón Renovar (P7). Al abrir: Server Action `prepararEnvio(id)` (crea el enlace si falta; devuelve URL, mensaje, número `wa.me`) y precarga el PDF como `File` (`fetch` de `/cotizaciones/[id]/pdf`). Botones: «Compartir PDF» (solo si `navigator.canShare({ files })`; llama a `navigator.share({ files, text })` **en el mismo clic**, sin `await` previo), «Enviar por WhatsApp» (`window.open(urlWhatsApp…)` en el mismo clic), «Copiar enlace», «Descargar PDF». Vista previa del mensaje editable antes de enviar. Tras cualquier envío: `marcarEnviada(id)` en segundo plano y toast. `AbortError` de `share` (el usuario canceló) no es error |
| `ResponderCotizacionDialog` | `AppDialog xs` | Aceptar (confirmación) o Rechazar (motivo opcional) |
| `AnularCotizacionDialog` | `AppDialog xs` | Motivo opcional; aviso «El enlace público dejará de funcionar»; primario `color="error"` |

### Página pública `/c/[token]` (sin sesión)

- Fuera de `(protected)`: `src/app/c/[token]/page.tsx` + `layout.tsx` propio con `templates/DocumentoPublicoLayout` (sin `AppShell`, sin menú ni datos de usuario): `BrandMark` + franjas de la borda en el encabezado, datos del negocio, contenido centrado (máx. 880 px), responsive a 375 px, claro/oscuro según el sistema.
- Server Component que llama a `cotizacion_publica` con un cliente Supabase **anónimo sin cookies** (`src/lib/supabase/anon.ts`, nuevo) y decide por `resultado` (P7):
  - **`disponible`**: muestra el documento con `organisms/CotizacionDocumento` (mismo orden que el PDF), banner `Alert` si `estado_publico` es «Aceptada» o «No vigente» (rechazada), botón primario **«Descargar PDF»** (`/c/[token]/pdf?descargar=1`), «Escribir por WhatsApp» al negocio y «Actualizada el …».
  - **`vencida`**: `organisms/CotizacionNoDisponible` variante `vencida`: marca, «La cotización COT-000123 venció», «Escríbenos por WhatsApp y te enviamos una nueva» con el botón al negocio (mensaje de «Reglas de negocio»). **Sin** fechas, cliente, líneas, importes ni botón de PDF.
  - **`no_disponible`**: `CotizacionNoDisponible` variante `generica`: marca, «Este enlace no está disponible», botón de WhatsApp al negocio con el mensaje genérico. No revela si el enlace existió, si fue revocado o anulado.
  - Las páginas de respaldo responden con estado HTTP 200 (renderizadas en `page.tsx`, no con `notFound()`, porque necesitan los datos de contacto del negocio que da la RPC) y `noindex`. El `not-found.tsx` de la ruta queda solo para tokens con formato inválido y usa el mismo componente genérico.
- `generateMetadata`: `robots: { index: false, follow: false }`; título «Cotización COT-000123 · Altamar Sea Food» solo si `disponible`, y «Altamar Sea Food» en los respaldos; nunca montos en la descripción (la vista previa de WhatsApp no debe mostrar importes). `Referrer-Policy: no-referrer` para no filtrar el token a terceros.
- `proxy.ts`: el matcher excluye `c/` (además de `login|recuperar|actualizar-password`). Verificar que no colisione con `/catalogos`, `/clientes`, `/cobros`, `/compras`, `/contratos`, `/cotizaciones` (la exclusión exige la barra: `c/`).

## Arquitectura por capas (archivos)

| Capa | Archivo | Contenido |
|---|---|---|
| Migraciones | `supabase/migrations/20261022100000_cotizaciones_esquema.sql` (A), `…100100_cotizaciones_enlace_publico.sql` (C), `…100200_cotizaciones_pedido.sql` (D) | Ver `tasks.md` |
| Tipos | `src/types/domain.ts` | `EstadoCotizacion`, `EstadoEfectivoCotizacion`, `Cotizacion`, `CotizacionItem`, `CotizacionListado`, `CotizacionDetalle`, `CotizacionInput`, `TotalesCotizacion`, `CotizacionPublica`, `DatosCotizacionPdf`; `ConfigNegocio` + 2 campos |
| Dominio puro | `src/lib/cotizaciones/totales.ts`, `estado.ts` (`estadoEfectivo`, transiciones permitidas), `numero.ts` (`formatNumeroCotizacion`, `parseBusquedaNumero`), `mensaje.ts`, `enlace.ts` (`urlPublica`) | Sin Supabase ni React |
| PDF | `src/lib/cotizaciones/pdf/CotizacionPdf.tsx`, `src/lib/pdf/marca.tsx` (encabezado con isotipo y franjas, reutilizable), `src/lib/pdf/fuentes.ts` + `src/lib/pdf/fuentes/*.ttf` | Plantilla pura (datos → `<Document>`) |
| Validación | `src/lib/cotizacionValidation.ts` (`cotizacionFormSchema`, `responderCotizacionSchema`, `anularCotizacionSchema`), `configValidation.ts` (+2 campos) | Mensajes en `lib/validationMessages.ts` |
| Repositorios | `interfaces.ts` (`ICotizacionRepository`, `ICotizacionPublicaRepository`), `cotizacionRepository.ts`, `cotizacionPublicaRepository.ts` | Solo acceso y mapeo `numeric → number`; `hint` tal cual |
| Servicios | `cotizacionService.ts` (guardar, listar, detalle, estados, renovar, duplicar, anular, enlace), `cotizacionPdfService.ts` (`ICotizacionPdfRenderer` + impl react-pdf), `cotizacionPublicaService.ts` (lectura por token: `disponible` / `vencida` / `no_disponible`), `cotizacionPedidoService.ts` (Fase D) | Lógica de negocio; resuelven IVA |
| UI interna | `src/app/(protected)/cotizaciones/` (`page.tsx`, `cotizaciones-screen.tsx`, `actions.ts`, `loading.tsx`, `error.tsx`), `[id]/` (`page.tsx`, `cotizacion-ficha.tsx`, `actions.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`), `[id]/pdf/route.ts`; organisms de «Pantallas»; `AppShell.tsx` | |
| UI pública | `src/app/c/[token]/` (`layout.tsx`, `page.tsx`, `not-found.tsx`, `pdf/route.ts`), `templates/DocumentoPublicoLayout`, `organisms/CotizacionDocumento` (vista de solo lectura compartida por ficha y página pública), `organisms/CotizacionNoDisponible` (respaldo `vencida` / `generica`) | |

## Fases

| Fase | Entrega | Rama sugerida |
|---|---|---|
| A | Esquema, RPC de guardado, listado, ficha, crear/editar/duplicar/renovar, estados (sin PDF ni enlace) | `feat/cotizaciones-base` |
| B | PDF con la identidad de la marca, descarga desde listado y ficha | `feat/cotizaciones-pdf` |
| C | Enlace público (token, RPC anónima, `/c/[token]`, PDF público) y diálogo Compartir (Web Share + WhatsApp) | `feat/cotizaciones-compartir` |
| D | Convertir cotización aceptada en pedido (P8 aprobada) | `feat/cotizaciones-pedido` |
| E | Documentación global y verificación | con la última fase |

## Fuera de alcance (MVP)

- Aceptar, rechazar o firmar desde el enlace público (el cliente solo ve y descarga).
- Seguimiento de aperturas del enlace o del PDF (la vista previa de WhatsApp lo dispararía y daría datos falsos).
- Envío automático por la API de WhatsApp Business o por correo (se usa `wa.me` y Web Share; correo con Resend podría sumarse después con el canal de 09).
- Reserva de stock o lotes al cotizar; aviso de stock insuficiente.
- Bs en cualquier forma (P1): precios en Bs, equivalente referencial en Bs y tasas de cambio. También listas de precios por cliente.
- Productos fuera del catálogo (líneas de texto libre) y unidades distintas de kg.
- Descuento por línea.
- Versionado de la cotización (historial de cambios con valores anteriores); solo `updated_at`/`updated_by` y el aviso «Actualizada después de enviar».
- PDF archivado en storage (se genera al vuelo).
- Conversión directa a factura/POS (P8: solo a pedido).
- Gracia del enlace tras el vencimiento y expiración configurable (P7: deja de mostrar la cotización al día siguiente de `fecha_vencimiento`).
- Logo definitivo: se usa el isotipo provisional de `BrandMark` hasta que exista el archivo real (00).

## Variables de entorno nuevas

Ninguna. Se reutiliza `SITE_URL` (ya usada por la recuperación de contraseña) para la URL absoluta del enlace público; **debe estar configurada en Vercel** con el dominio de producción. Si falta, el servicio usa el `origin` de la petición (cabeceras `x-forwarded-host`/`x-forwarded-proto`) y lo registra en consola.

## Decisiones de diseño P1–P10 (cerradas el 2026-10-22)

El usuario respondió las diez el 2026-10-22. Ocho aprobadas con la recomendación; **P1** y **P7** con cambios (ver «Aprobada»). La spec y las tareas ya están escritas con lo aprobado; las demás opciones quedan como registro de lo descartado.

| # | Tema | Opciones | Aprobada | Afecta |
|---|---|---|---|---|
| P1 | **Moneda e impuestos** | a) USD/kg con total USD y equivalente Bs referencial (tasa vigente de la fecha) + IVA sí/no como en 18. b) Elegir USD o Bs por cotización. c) Solo USD, sin Bs. | **c con IVA opcional** (cambio del usuario sobre la recomendación a): precio por kg y total en USD; **sin equivalente en Bs** en pantalla, PDF ni enlace público, y sin tasa de cambio (el módulo no depende de 08). El IVA se activa o desactiva en cada cotización, con la regla del cliente (`aplica_iva`) como valor inicial | Sin columnas `tasa_*`; `iva_pct`; PDF; tareas 1, 6, 8, 13 |
| P2 | **Descuento** | a) Global en USD. b) Global en %. c) Por línea. d) Sin descuento. | **a**: global en USD; IVA sobre el monto descontado | Columna `descuento_usd`; totales; tareas 1, 3 |
| P3 | **Numeración** | a) Correlativo `COT-000123` por secuencia, asignado al crear el borrador. b) Asignado solo al enviar. c) Correlativo por año. | **a**: puede haber saltos por anulados | Secuencia, `numero`; tarea 1 |
| P4 | **Quién puede cotizar** | a) Admin y operador (todo, incluido anular). b) Operador crea y comparte; solo admin anula y regenera enlaces. c) Solo admin. | **a** | RLS, menú, servicios; tareas 1, 6, 9 |
| P5 | **Estados y edición** | a) `borrador`, `enviada`, `aceptada`, `rechazada`, `anulada` + `vencida` derivada; editable en borrador y enviada. b) `enviada` inmutable. c) Sin estados de respuesta. | **a** | `cotizaciones_guard`, ficha; tareas 1, 7 |
| P6 | **Librería y tipografía del PDF** | a) `@react-pdf/renderer` con Barlow embebida e isotipo provisional. b) Ídem con Helvetica. c) Chromium headless. | **a** | Tareas 11–14 |
| P7 | **Enlace público: vigencia y forma** | a) Token de 32 caracteres, `/c/[token]`, válido hasta vencimiento + 30 días con aviso, revocable y regenerable. b) Igual, pero deja de mostrar la cotización al vencer. c) Sin expiración. d) Solo hash del token. | **b con respaldo** (cambio del usuario sobre la recomendación a): token y ruta de a, revocable y regenerable, **sin gracia**. Vencida (`fecha_vencimiento < hoy`) → página de respaldo con la marca e invitación a pedir una nueva por WhatsApp, sin mostrar la cotización ni permitir el PDF. Revocada, anulada, borrador o inexistente → respaldo genérico que no revela datos | RPC `cotizacion_publica` (`resultado`), `/c/[token]`, `/c/[token]/pdf`, `CotizacionNoDisponible`; tareas 15–19 |
| P8 | **Convertir en pedido** | a) Sí, Fase D, desde una aceptada con cliente registrado. b) Fuera de alcance. c) Directo a venta POS. | **a** | Fase D (tareas 20–23) |
| P9 | **Precio precargado** | a) `precio_referencia_usd_kg` (vacío en crudos). b) Último precio vendido al cliente. c) Siempre vacío. | **a** | `CotizacionItemsFieldArray`; tarea 8 |
| P10 | **Compartir marca «enviada»** | a) Automático al usar WhatsApp, Web Share o Copiar enlace. b) Botón explícito. | **a**: si el usuario cancela la hoja de compartir (`AbortError`) no se marca | `CompartirCotizacionDialog`; tarea 18 |
