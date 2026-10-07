# 06 — Contratos (acuerdos de crédito en PDF)

> Reescrita el 2026-10-07 sobre el estado real del código. La versión del 2026-10-06 suponía fichas de factura y de compra que no existen, migraciones `0007`/`0008` que ya se usaron con otro contenido y no contemplaba lo que agregaron `07-lotes`, `08-tasas`, `09-cuentas-por-cobrar` y la Fase 2 de `00-estandares-ui`.

## Contexto

Este módulo no estaba en `/SPEC.md`. Cuando el negocio vende o compra a crédito, el admin necesita un **comprobante del acuerdo**, firmable en papel o enviable por WhatsApp o correo, con la deuda en USD, la tasa pactada y la regla de ganancia cambiaria de cada abono (`/SPEC.md` §2 "Crédito" y §4.5). No es un contrato legal complejo ni un documento fiscal (`/SPEC.md` §2 "Facturación": interna). Tampoco reemplaza la factura (`05-ventas`) ni la cuenta por pagar (`04-inventario`): es un documento derivado de una de ellas.

Qué existe hoy y se reutiliza:

| Pieza | Dónde | Uso en 06 |
|---|---|---|
| Facturas con `condicion`, `estado`, `dias_credito`, `fecha_vencimiento` (derivada por trigger), `tasa_snapshot`, `tasa_origen`, `tasa_fuente`, `tasa_referencial` | `facturas` (`0001`, `0019_tasa_operaciones.sql`, `20261007170000_cartera_vencimientos.sql`); `IFacturaRepository.getById` → `FacturaDetalle` (items, pagos, notas de crédito) | Datos del contrato de venta |
| Compras con `condicion`, `estado`, `moneda`, `tasa_snapshot` + procedencia de la tasa; **sin número ni vencimiento** | `compras` (`0001`, `0019`); `ICompraRepository.getById` → `CompraDetalle` | Datos del contrato de compra |
| Clientes y proveedores con `tipo_persona`, `rif_ci`, `direccion`, `telefono`, `email` + representantes legales | `02-clientes`, `03-proveedores` | Datos de la contraparte |
| `config_negocio` (singleton, `0011_config_negocio.sql`), ya con `nombre_comercial` (09) | `configRepository`, `configService`, `configValidation.ts`, `organisms/ConfigNegocioForm` (Catálogos › Configuración, `?tab=` de 12) | Encabezado del PDF: **le faltan razón social, RIF, dirección y teléfono** |
| `/cobros`: `DocumentosCarteraTable` con `renderAcciones` (menú `⋮`, solo admin) | `cobros/cobros-screen.tsx` | Punto de entrada (facturas) |
| Ficha de cliente: sección "Facturas y cobranza" con `DocumentosCarteraTable` **sin** `renderAcciones` | `clientes/[id]/cliente-ficha.tsx` | Punto de entrada (facturas) |
| `/compras`: `ComprasTable` en `AppDataGrid` servidor, `colAcciones` solo admin ("Registrar pago") | `organisms/ComprasTable.tsx` | Punto de entrada (compras) |
| Ficha de proveedor: "Historial de compras" en `AppDataGrid` embebida **sin** columna de acciones | `proveedores/[id]/proveedor-ficha.tsx` | Punto de entrada (compras) |
| Patrón de bucket privado creado en la migración + signed URL al vuelo | `0010_documentos_proveedor.sql`, `documentoProveedorRepository.ts` | Bucket `contratos` |
| `requireAdmin()` / `getRol()` y `public.es_admin()` | `authService.ts`, `0002`/`0003` | Permisos |
| `BrandLoader` + `useGlobalLoader` (mensaje "Generando contrato", previsto en 00), `useConfirm`, `useNotify`, `AppDataGrid`, `RowActionsMenu`, `colEstado`/`EstadoChip`, `PageHeader`, `EmptyState`, `ErrorState`, `PageLoader` | `00-estandares-ui` | UI |

Depende de `02`, `03`, `04` y `05`, y usa lo que dejaron `07`, `08`, `09`, `10`, `11`, `12` y `00` Fase 2, todos hechos.

## Decisión de diseño (cerrada por el usuario el 2026-10-07)

1. **Sin fichas nuevas.** No se crean fichas de factura ni de compra. El contrato se genera desde el menú `⋮` de las tablas que ya existen:
   - Facturas a crédito: `/cobros` y la sección "Facturas y cobranza" de `/clientes/[id]`.
   - Compras a crédito: `/compras` y "Historial de compras" de `/proveedores/[id]`.
   - `/contratos` es la **bitácora central** (listar, ver, descargar, cambiar estado, anular). No genera contratos.
2. **Solo admin.** Genera, cambia el estado y entra a `/contratos`. RLS de la tabla, de la vista y del bucket solo por `public.es_admin()`. El operador no ve montos (`/SPEC.md` §5 Notas), no ve las opciones del menú y no ve el ítem "Contratos" del `AppShell` (`adminOnly`).
3. **Encabezado del PDF** con razón social, RIF, dirección y teléfono del negocio. Son columnas nuevas de `config_negocio`, editables en Catálogos › Configuración (`ConfigNegocioForm` + `configFormSchema`).
4. **Días de crédito al generar** (cerrada por el usuario el 2026-10-07). Generar abre un diálogo que pide los días de crédito del contrato. El contrato guarda sus propios `dias_credito` y `fecha_vencimiento` (= fecha del origen + días), calculados al generar y nunca recalculados.
   - Compras: el campo arranca vacío y es obligatorio, porque las compras no tienen días propios.
   - Facturas: se precarga con `facturas.dias_credito` y es editable. **La factura no se modifica**: la cobranza de 09 sigue usando `facturas.fecha_vencimiento`.
5. **Decisiones 2–5 (cerradas por el usuario el 2026-10-07, con los valores por defecto)**:
   - (2) Se genera contrato aunque el origen esté pagado (`abierta` o `pagada` son elegibles).
   - (3) Se bloquea la generación si la contraparte no tiene RIF/CI.
   - (4) El PDF muestra abonos, notas de crédito y saldo a la fecha.
   - (5) Anular solo con confirmación (sin motivo), PDF en Helvetica y sin logo.

## Alcance

### Tipos de contrato (MVP: 2)

| `tipo` | Origen | Partes | Rol del negocio |
|---|---|---|---|
| `venta_credito` | `facturas` con `condicion = 'credito'` | negocio ↔ cliente | acreedor |
| `compra_credito` | `compras` con `condicion = 'credito'` | negocio ↔ proveedor | deudor |

### Reglas de negocio

1. **Elegibilidad del origen**: `condicion = 'credito'` y `estado <> 'anulada'`. Las facturas y compras `abierta` o `pagada` son elegibles. Las de contado no muestran la opción. Las anuladas la muestran deshabilitada con el motivo "Documento anulado".
2. **Un contrato activo por origen**: activo = `generado`, `enviado` o `firmado`. Se garantiza con un **índice único parcial** en la base y además con una comprobación previa en el servicio, que da el mensaje claro: «La factura F-000123 ya tiene el contrato N.º 0007 (enviado). Anúlalo antes de generar otro.» Si el índice salta por concurrencia (`23505`), se borra el PDF ya subido y se muestra el mismo mensaje.
3. **Snapshot, sin recalcular**: el PDF toma los valores guardados del origen (`tasa_snapshot`, `tasa_origen`, `tasa_fuente`, `tasa_referencial`, `subtotal_usd`, `iva_pct`, `iva_usd`, `total_usd`, `pagado_usd`, items con `peso_kg` y `precio_usd_kg`/`costo_usd_kg`). Los días de crédito y el vencimiento salen del propio contrato (regla 9). Solo multiplica para el equivalente en Bs (`monto_usd × tasa_snapshot`) y resta para el saldo (`total − pagado − Σ notas de crédito emitidas`). Nunca consulta la tasa vigente.
4. **Inmutable**: el PDF generado no se edita ni se regenera. Si el origen cambia (nota de crédito, abono, anulación), el admin anula el contrato y genera otro (`/SPEC.md` §2 "Snapshot de tasa", aplicado al documento).
5. **Estados** (cambios manuales, sin flujo de firma digital):

   | Desde | Hacia permitido |
   |---|---|
   | `generado` | `enviado`, `firmado`, `anulado` |
   | `enviado` | `firmado`, `anulado` |
   | `firmado` | `anulado` |
   | `anulado` | — (terminal) |

   No se retrocede. Anular pasa por `ConfirmDialog` destructivo. El servicio valida la transición y un trigger la refuerza.
6. **Origen anulado después**: el contrato no cambia solo. La bitácora lo marca con el aviso "Documento anulado" para que el admin lo anule.
7. **Datos obligatorios para generar** (si falta alguno, el servicio no genera y explica qué falta y dónde completarlo):
   - Negocio: `razon_social`, `rif`, `direccion`, `telefono` → «Completa los datos del negocio en Catálogos › Configuración».
   - Contraparte: `nombre` y `rif_ci` → «Registra el RIF o la cédula de <nombre> antes de generar el contrato». La dirección es opcional (en el PDF: "No registrada").
8. **Numeración**: `contratos.numero` secuencial propio (identity), mostrado como `N.º 0007`. Las compras no tienen número: se citan como "Compra del dd/mm/aaaa (ref. <8 primeros caracteres del id>)".
9. **Días de crédito y vencimiento del contrato**:
   - `dias_credito`: entero de 0 a 365 (mismo rango que `facturas.dias_credito`). Se valida con zod en el diálogo y en la Server Action.
   - `fecha_vencimiento = fecha del origen (facturas.fecha / compras.fecha) + dias_credito`. La calcula el trigger al insertar; si el cliente la envía, se ignora. Queda guardada y no se recalcula.
   - Compras: obligatorio, sin valor inicial.
   - Facturas: se precarga con `facturas.dias_credito`. Si el valor elegido difiere, el diálogo avisa: «El vencimiento de la factura en cobranza no cambia (sigue siendo el dd/mm/aaaa); solo el contrato usará el nuevo». La factura no se toca.

### Esquema de datos

Migraciones nuevas, posteriores a `20261007180400_lotes_rpc_ventas.sql`. No se edita ninguna aplicada.

**`20261007190000_config_negocio_datos_contrato.sql`** — `alter table public.config_negocio add column if not exists …`:

| Columna | Tipo | Nota |
|---|---|---|
| `razon_social` | text null | check `char_length ≤ 160` |
| `rif` | text null | check `rif ~ '^[VEJG]-\d{6,10}(-\d)?$'` (mismo patrón que `RIF_CI_REGEX`) |
| `direccion` | text null | check `char_length ≤ 300` |
| `telefono` | text null | check `char_length ≤ 20`; el formato lo valida zod (`TELEFONO_VE_REGEX`) |

Las RLS de `config_negocio` no cambian (lectura `authenticated`, escritura `es_admin()`): son datos públicos del negocio.

**`20261007190100_contratos.sql`** — tabla `public.contratos`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | el servicio lo genera antes de subir el PDF (se usa en la ruta del archivo) |
| `numero` | bigint `generated always as identity`, unique | |
| `tipo` | text not null check (`venta_credito`, `compra_credito`) | |
| `factura_id` | uuid null references `facturas(id)` | solo `venta_credito` |
| `compra_id` | uuid null references `compras(id)` | solo `compra_credito` |
| `fecha` | date not null | fecha de emisión; la pone el servicio con `fechaHoy()` (zona de Caracas), no `current_date` |
| `dias_credito` | int not null | check `dias_credito between 0 and 365`; lo indica el admin al generar |
| `fecha_vencimiento` | date not null | = fecha del origen + `dias_credito`; la deriva el trigger al insertar y no se recalcula |
| `estado` | text not null default `'generado'` check (`generado`, `enviado`, `firmado`, `anulado`) | |
| `url_storage` | text not null | ruta en el bucket (mismo nombre de columna que `documentos_cliente`/`documentos_proveedor`); nunca una URL firmada |
| `notas` | text null | check `char_length ≤ 500` |
| `generado_por` | uuid not null default `auth.uid()` references `auth.users(id)` | |
| `estado_cambiado_por` | uuid null references `auth.users(id)` | último cambio de estado |
| `estado_cambiado_at` | timestamptz null | |
| `created_at` | timestamptz not null default `now()` | |

Restricciones e índices:
- `contratos_origen_check`: `(tipo = 'venta_credito' and factura_id is not null and compra_id is null) or (tipo = 'compra_credito' and compra_id is not null and factura_id is null)`.
- `contratos_factura_activo_uq`: `unique (factura_id) where factura_id is not null and estado <> 'anulado'`.
- `contratos_compra_activo_uq`: `unique (compra_id) where compra_id is not null and estado <> 'anulado'`.
- `idx_contratos_fecha` (`fecha desc, numero desc`), `idx_contratos_estado` (`estado`).

Trigger `contratos_validar` (`before insert or update`, `security invoker`, errcode `23514` con mensaje en español):
- Insert: el origen existe, tiene `condicion = 'credito'` y no está `anulada`. Además fija `fecha_vencimiento := <fecha del origen> + dias_credito` e ignora el valor enviado.
- Update: solo pueden cambiar `estado`, `notas`, `estado_cambiado_por` y `estado_cambiado_at`. La transición de `estado` respeta la tabla de reglas. `estado_cambiado_por`/`_at` se completan solos (`auth.uid()`, `now()`).

Vista `public.contratos_listado_view` (`with (security_invoker = true)`, así que hereda la RLS de `contratos`): columnas de `contratos` + `contraparte_id`, `contraparte_nombre`, `contraparte_rif_ci`, `documento_fecha`, `documento_numero` (`facturas.numero`; `null` en compras), `monto_usd` (`facturas.total_usd` o `compras.subtotal_usd`), `origen_anulado` (bool). La usa el listado para buscar, filtrar y ordenar en el servidor sin lógica en el repositorio.

RLS de `contratos`: `enable row level security`. `select`, `insert` y `update` para `authenticated` con `using/with check (public.es_admin())`. **Sin política de `delete`**: los contratos se anulan, no se borran.

Bucket de Storage, en la misma migración (patrón de `0010_documentos_proveedor.sql`):
- `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('contratos', 'contratos', false, 5242880, array['application/pdf']) on conflict (id) do nothing`.
- Políticas sobre `storage.objects` acotadas a `bucket_id = 'contratos' and public.es_admin()`: `select`, `insert` y `delete` (el `delete` solo para limpiar el archivo si falla el insert de la fila). **Sin `update`**: el PDF es inmutable y se sube con `upsert: false`.
- Ruta del archivo: `{tipo}/{yyyy}/{contrato_id}.pdf`.

### Contenido del PDF

Las dos plantillas comparten los bloques. Solo cambian los textos de las partes y la tabla de items. Tamaño carta, tipografía Helvetica (integrada en la librería, sin archivos de fuente) y montos con `lib/format.ts` (`formatUsd`, `formatBs`, `formatKg`, `formatTasa`, `formatFecha`).

1. **Encabezado**: `nombre_comercial`, `razon_social`, `RIF`, `direccion`, `telefono`. Título "Acuerdo de venta a crédito" o "Acuerdo de compra a crédito". N.º de contrato y fecha de emisión.
2. **Partes**:
   - El negocio.
   - La contraparte: nombre, persona natural o jurídica, RIF/CI, dirección y teléfono.
   - Si es jurídica, sus representantes legales (nombre, cédula y cargo).
   - Rol de cada parte: acreedor o deudor.
3. **Documento de origen y plazo**:
   - Venta: factura N.º y fecha.
   - Compra: fecha y moneda pactada.
   - En ambos, los **días de crédito** y la **fecha de vencimiento del contrato** (`contratos.dias_credito`, `contratos.fecha_vencimiento`).
4. **Items**: producto (código + nombre), kg, precio o costo USD/kg y subtotal USD.
5. **Totales**:
   - Venta: subtotal, IVA (`iva_pct`) y total en USD.
   - Compra: total en USD.
   - Debajo, el equivalente en Bs a la tasa pactada.
   - Abonos a la fecha, notas de crédito emitidas (solo venta) y **saldo adeudado** en USD y su equivalente en Bs.
6. **Tasa pactada**: valor (`formatTasa`) y procedencia, sin recalcular:
   - `referencial`: «Tasa referencial <BCV | paralela> vigente a la fecha del documento».
   - `manual`: «Tasa acordada entre las partes (referencial vigente: <tasa_referencial>)», o sin el paréntesis si `tasa_referencial` es `null`.
7. **Cláusula de ganancia cambiaria**: una única constante compartida `CLAUSULA_GANANCIA_CAMBIARIA` (en `src/lib/contratos/clausulas.ts`), redactada con "EL ACREEDOR"/"EL DEUDOR" para servir en ambos tipos y parametrizada solo con la tasa pactada. Explica que la deuda se expresa en USD, que cada abono en Bs se convierte a la tasa del día del pago y que la diferencia `(tasa_pago − tasa_pactada) × USD pagados` es ganancia o pérdida cambiaria (`/SPEC.md` §4.5). Ninguna plantilla escribe su propio texto de cláusula.
8. **Firmas**: dos líneas (por el negocio y por la contraparte, con nombre y RIF/CI). No hay firma digital.
9. **Pie**: «Documento interno, no fiscal» + «Página X de Y».

### Generación y entrega del PDF

- **Librería**: `@react-pdf/renderer`, con render en el servidor (`renderToBuffer`) dentro de una Server Action (runtime Node). Next 16 ya incluye `@react-pdf/renderer` en su lista por defecto de `serverExternalPackages` (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`). Solo se agrega a `next.config.ts` si la evaluación de la tarea 1 lo exige.
- **Alternativa documentada**: `pdf-lib` (`StandardFonts.Helvetica`, layout manual con `drawText` y un helper de tablas). Se usa si `@react-pdf/renderer` falla con React 19.2 / Next 16.3 o en el build. El render queda detrás de la interfaz `IContratoPdfRenderer` (Strategy), así que cambiar de librería no toca servicios ni UI.
- **Orden de la generación** (en `contratoService`):
  1. Validar.
  2. Resolver los datos.
  3. Renderizar.
  4. Subir al bucket (`upsert: false`).
  5. Insertar la fila.
  6. Si el insert falla, borrar el archivo subido.
- **Ver o descargar**: route handler `GET /contratos/[id]/pdf` que verifica admin, crea una **signed URL al vuelo** (TTL 60 s; con `?descargar=1`, opción `download` con nombre `contrato-0007.pdf`) y responde con redirección 302. La URL firmada nunca se guarda. Los enlaces "Ver PDF" abren esa ruta en una pestaña nueva, en el mismo clic (sin `await` previo, sin bloqueo de ventanas emergentes).

### Arquitectura

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Tipos | `src/types/domain.ts` | `TipoContrato`, `EstadoContrato`, `Contrato`, `ContratoListado`, `DatosContratoPdf`, `ElegibilidadContrato`; `ConfigNegocio` + 4 campos |
| Validación | `src/lib/contratoValidation.ts` | `generarContratoSchema` (unión discriminada por `tipo`: `factura_id` o `compra_id`, uuid; `dias_credito` entero 0–365 obligatorio; `notas` ≤ 500 opcional), `cambiarEstadoContratoSchema` (`id`, `estado` ∈ `enviado`/`firmado`/`anulado`), `filtrosContratosSchema` (params de la URL: `pagina`, `tipo`, `estado`, `q`), `TRANSICIONES_CONTRATO` |
| Repository | `interfaces.ts` → `IContratoRepository`, `IContratoArchivoRepository`; `contratoRepository.ts`, `contratoArchivoRepository.ts` (`make…Repository(client)`) | Solo acceso a datos: tabla y vista por un lado, Storage por el otro |
| PDF | `src/lib/contratos/` (`clausulas.ts`, `textos.ts`, `plantillas/*.tsx`, `plantillas/factory.ts`) | Plantillas puras (datos → documento). **Factory** `ContratoTemplateFactory.crear(tipo)` |
| Servicios | `src/lib/services/contratoPdfService.ts` | Implementa `IContratoPdfRenderer`: datos → `Uint8Array` vía factory |
| | `src/lib/services/contratoService.ts` | Orquesta: elegibilidad, armado de `DatosContratoPdf`, generación, listado, cambio de estado, URL firmada. Único que usa los repos de contratos |
| Server Actions | `src/app/(protected)/contratos/actions.ts` | `safeParse` con zod → servicio → `ActionState` + `revalidatePath` |
| Route handler | `src/app/(protected)/contratos/[id]/pdf/route.ts` | Entrega por signed URL |

### UI (según `00-estandares-ui` Fase 2)

**Menú `⋮` en los cuatro puntos de entrada** (solo admin). Las opciones salen de un solo hook, `useContratoAcciones`, para no repetir lógica:

| Situación del origen | Opciones |
|---|---|
| Crédito, sin contrato activo | "Generar contrato" (`DescriptionOutlined`) |
| Crédito, con contrato activo | "Ver contrato N.º 0007" (`PictureAsPdfOutlined`, pestaña nueva) |
| Crédito, anulada | "Generar contrato" deshabilitada, con el motivo "Documento anulado" |
| Contado | ninguna |

- "Generar contrato" **no genera con un solo clic**: abre `organisms/GenerarContratoDialog` (`AppDialog xs`).
  - Título "Generar contrato". Subtítulo con el contexto: «Factura F-000123 · Restaurante El Muelle» o «Compra del 07/10/2026 · Pesquera X».
  - Campo "Días de crédito *": reutiliza `DiasCreditoField` de 09 (entero, atajos 7/15/30, «Vence el …» en vivo calculado desde la fecha del origen). En compras arranca vacío; en facturas, con `facturas.dias_credito`.
  - Si el valor difiere del de la factura, `Alert` `info` con el aviso de la regla 9.
  - Campo "Notas" opcional (≤ 500).
  - Primario "Generar contrato" con `loading` y `useForm({ disabled })`. Cierre protegido mientras está en curso; los errores del servidor van en el `Alert` del diálogo, y el de días, en su campo.
- Al enviar: `useGlobalLoader().run(…, 'Generando contrato')` (nivel 1 de loaders de 00). Al terminar, cierra el diálogo con `notify.success('Contrato N.º 0007 generado')` + `router.refresh()`, o lo deja abierto con el error.
- La elegibilidad la calcula el servidor (`contratoService.elegibilidadFacturas(ids)` / `elegibilidadCompras(ids)`) y llega por props. El núcleo `lib/cartera` **no se toca**: `DocumentoCartera` no gana campos.

**`/contratos`** (bitácora; `page.tsx` server con `requireAdmin()` → `redirect('/')`):
- `PageHeader` "Contratos", sin acción primaria (no se genera desde aquí). Subtítulo: "Se generan desde el menú ⋮ de una factura o compra a crédito".
- `organisms/ContratosTable` sobre `AppDataGrid` en **modo servidor** (`rowCount`, `?pagina=`, 25 por página).
  - Columnas: N.º, fecha (`colFecha`), tipo (Venta/Compra), documento (factura N.º o "Compra del …"), contraparte (nombre + RIF en `caption`), monto (`colMonto`), estado (`colEstado` + chip "Documento anulado" si `origen_anulado`) y acciones (`colAcciones`).
  - Fila abrible: `getRowHref` → ficha de la contraparte (`/clientes/[id]` o `/proveedores/[id]`).
- Filtros como chips en la URL: `?tipo=venta|compra` y `?estado=activos|generado|enviado|firmado|anulado|todos` (por defecto `activos`). Búsqueda `?q=` por N.º de contrato, N.º de factura o contraparte (debounce 300 ms, en el servidor sobre la vista).
- Menú `⋮` por fila:
  - "Ver PDF".
  - "Descargar".
  - "Marcar como enviado" y "Marcar como firmado" (solo las transiciones válidas).
  - "Anular" (`destructive`, `ConfirmDialog`: «Anular el contrato N.º 0007. El PDF se conserva y podrás generar otro para esta factura.»).
- En `xs`, `mobileCard`:
  - Principal: contraparte.
  - Secundaria: «N.º 0007 · Factura F-000123 · 07/10/2026».
  - Chip de estado y monto.
- `EmptyState`: «Aún no hay contratos», con la descripción de dónde se generan y botones `outlined` a `/cobros` y `/compras`.
- `loading.tsx` (`PageLoader table`) y `error.tsx` (`ErrorState`).

**Catálogos › Configuración**: nueva `FormSection` "Datos del negocio para contratos" en `ConfigNegocioForm`, con estos campos:
- Razón social (`TextField`).
- RIF (`RifCiField`).
- Dirección (`TextField` multilinea).
- Teléfono (`PhoneField`).

Todos `size="small"`, opcionales en el formulario y con la ayuda «Obligatorios para generar contratos».

**`AppShell`**: ítem "Contratos" (`DescriptionOutlined`, `adminOnly: true`) después de "Cobros y pagos".

Íconos `Outlined`, tipografía de la escala (sin tamaños sueltos), montos con cifras tabulares, revisión en 375/768/1024/1440 px y en claro y oscuro.

## Fuera de alcance (MVP)

- Firma digital real (proveedor de e-signature) y carga del PDF firmado escaneado.
- Envío automático por correo o WhatsApp (se descarga y se envía a mano; los canales de `09` no se reutilizan aquí todavía).
- Versionado o edición de un contrato: si el origen cambia, se anula y se genera otro.
- Cambiar el vencimiento de la factura o de la compra desde el contrato. Los días del contrato solo viven en `contratos`; la cobranza de 09 y la futura de cuentas por pagar usan los del documento de origen.
- Logo y tipografía de marca (Barlow) en el PDF: se agregan cuando exista el archivo real del logo (ver `BrandMark` en `00-estandares-ui`).
- Plantillas editables por el usuario. El texto vive en código.
- Contratos que no salen de una factura o compra (préstamos, acuerdos marco).

## Variables de entorno nuevas

Ninguna. Usa la sesión de Supabase del usuario (RLS admin), no `service_role`.
