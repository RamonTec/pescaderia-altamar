# 03 — Proveedores (control e información)

## Contexto

`proveedores` ya existe en el esquema (`0001_initial_schema.sql`) con `nombre, rif_ci, telefono, notas, activo, created_at`, y `IProveedorRepository` ya está definido en `lib/repositories/interfaces.ts` (implementación provisional en `catalogRepositories.ts`). Hoy se gestiona dentro de la pantalla genérica `/catalogos` (placeholder).

El usuario pidió un módulo propio para tener control real de con quién compra el negocio: a quién y cómo se le paga, cuánto se le debe y qué proveedores no son confiables (entregas incompletas, producto en mal estado, desaparecen con un pago adelantado). Es el mismo principio que `02-clientes` aplicado a la otra punta del negocio: **identificar sin ambigüedad a la persona o empresa y a quien responde por ella, con respaldo documental** (cédula, RIF, acta constitutiva).

## Decisiones cerradas (2026-10-06, con el usuario)

| Tema | Decisión |
|---|---|
| Representantes legales | **Sí, igual que clientes**: un proveedor `juridica` exige al menos un representante (nombre, cédula, cargo, teléfono), cada uno con su foto de cédula. |
| Datos de pago | **Varios métodos por proveedor**: transferencia bancaria (cuenta de 20 dígitos), Pago Móvil y Zelle. Reemplaza la idea original de "una sola cuenta" (columnas `banco/numero_cuenta/titular_cuenta`), que se descarta. |
| Documentación incompleta | **Solo indicador visual** ("Documentación incompleta" + lista de faltantes). No bloquea compras ni la activación. |
| Bloqueo | Igual que clientes: solo `admin`, motivo obligatorio. Un proveedor bloqueado no recibe compras **a crédito** (la validación real ocurre en `04-inventario`). |
| Ruta | `/proveedores` propia, separada de `/catalogos` (que queda solo para productos + configuración). |

## Modelo de datos

### `proveedores` (extiende la tabla existente)

| Campo | Tipo | Nota |
|---|---|---|
| `nombre` | text, requerido | ya existe — razón social si es jurídica |
| `tipo_persona` | text check (`natural`,`juridica`) | **nuevo**, default `juridica` (cooperativas/empresas son mayoría; puede haber pescadores independientes) |
| `rif_ci` | text | ya existe — **único** entre proveedores (índice único sobre `upper(rif_ci)`, ignora nulos) |
| `telefono` | text | ya existe |
| `email` | text | **nuevo** |
| `direccion` | text | **nuevo** — dirección fiscal (se usa en `06-contratos`) |
| `contacto_nombre` | text, nullable | **nuevo** — con quién se hacen los pedidos (puede no ser el representante legal) |
| `contacto_telefono` | text, nullable | **nuevo** |
| `notas` | text | ya existe |
| `bloqueado` | boolean, default false | **nuevo** |
| `motivo_bloqueo` | text, nullable | **nuevo** — `check (not bloqueado or length(trim(motivo_bloqueo)) > 0)` |
| `activo` | boolean | ya existe |

**Protección del bloqueo a nivel de base** (no solo en el servicio): trigger `before insert or update` que rechaza (`errcode 42501`) cualquier cambio a `bloqueado`/`motivo_bloqueo` si `public.es_admin()` es falso. Motivo: la RLS de `proveedores` es `using (true)` para `authenticated`, así que un operador podría saltarse el servicio llamando a PostgREST directamente. *(`02-clientes` tiene el mismo hueco: ver tarea agregada en `02-clientes/tasks.md`.)*

### `representantes_proveedor` (nueva)

Mismo esquema que `representantes_legales` de `02-clientes` pero con `proveedor_id uuid not null references proveedores on delete cascade`. Se usa una tabla aparte (no una tabla polimórfica compartida) para conservar la FK real y no tocar el esquema de `02-clientes`.

### `metodos_pago_proveedor` (nueva)

| Columna | Tipo | Aplica a |
|---|---|---|
| `id`, `proveedor_id` (FK cascade), `created_at` | | todos |
| `tipo` | text check (`transferencia`,`pago_movil`,`zelle`) | todos |
| `banco_codigo` | text (4 dígitos) | transferencia (derivado de la cuenta), pago_movil |
| `numero_cuenta` | text `^\d{20}$` | transferencia |
| `tipo_cuenta` | text check (`corriente`,`ahorro`), nullable | transferencia |
| `telefono` | text | pago_movil (obligatorio), zelle (alternativa al email) |
| `email` | text | zelle |
| `titular` | text | transferencia, zelle |
| `titular_rif_ci` | text | transferencia, pago_movil |
| `preferido` | boolean default false | todos — índice único parcial: a lo sumo uno preferido por proveedor |

Check constraint por `tipo` que exige los campos obligatorios de cada uno (la misma regla vive en el esquema `zod`, así el error se ve en el formulario y la base no acepta basura si alguien la salta).

Catálogo de bancos venezolanos (código SUDEBAN de 4 dígitos → nombre) en `src/lib/bancosVe.ts`, constante estática (no tabla): sirve para el `Autocomplete` de Pago Móvil y para **detectar el banco automáticamente** con los primeros 4 dígitos de la cuenta. Una cuenta cuyo prefijo no esté en el catálogo es inválida.

### `documentos_proveedor` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id`, `proveedor_id` (FK cascade), `created_at` | | |
| `tipo` | text check (`cedula`,`rif`,`acta_constitutiva`,`otro`) | |
| `representante_id` | uuid nullable, FK `representantes_proveedor` on delete cascade | se llena solo para la cédula de un representante |
| `url_storage` | text | ruta en el bucket, nunca URL pública |
| `nombre_original`, `mime_type`, `tamano_bytes` | text/text/int | para mostrar el archivo sin descargarlo |

Bucket privado `documentos-proveedores`, **creado en la migración** (`insert into storage.buckets` con `file_size_limit = 5 MB` y `allowed_mime_types = image/jpeg, image/png, image/webp, application/pdf`) más políticas sobre `storage.objects` para `authenticated`. Así no queda un paso manual pendiente en el dashboard, como le pasó a `02-clientes`. Ver o descargar = signed URL de 1 h generada al vuelo.

### Documentación requerida (indicador)

Función pura `evaluarDocumentacion(proveedor, representantes, documentos) → { completa: boolean, faltantes: string[] }` en `proveedorService.ts`:

- **Natural**: cédula + RIF.
- **Jurídica**: RIF + acta constitutiva + cédula de **cada** representante.

Solo alimenta el chip "Documentación incompleta" (listado y ficha) y la lista de faltantes. No bloquea nada.

## Pantallas

### `/proveedores` (listado)

- `PageHeader` "Proveedores" + botón "Nuevo proveedor".
- DataGrid. Columnas **esenciales** (siempre): nombre (con RIF debajo en `caption`) y estado (chips). Columnas **secundarias** (ocultas en `xs`/`sm` vía `columnVisibilityModel`): teléfono, contacto, método de pago preferido, saldo pendiente.
- Chips de estado: `Bloqueado` (error, tooltip con motivo), `Doc. incompleta` (warning, tooltip con faltantes), `Inactivo` (default).
- Búsqueda rápida (`GridToolbarQuickFilter`) por nombre/RIF/contacto. Switch "Mostrar inactivos" (por defecto solo activos).
- Clic en la fila → ficha. Acciones por fila en un menú `⋮` (editar, desactivar/activar, bloquear/desbloquear solo si es `admin`), así no se amontonan íconos en móvil.
- `EmptyState` ("Aún no hay proveedores" + botón) y `EmptyState` distinto cuando la búsqueda no da resultados.

### Formulario (alta/edición): diálogo con pasos

`Dialog` `maxWidth="md"`, **`fullScreen` en `xs`**. `Stepper` de 3 pasos:

1. **Identificación**: toggle `tipo_persona` (`ToggleButtonGroup`), nombre, RIF/cédula (etiqueta dinámica: "RIF" en jurídica, "Cédula" en natural), teléfono, email, dirección, contacto, notas. En jurídica aparece (con `Collapse`) la sub-sección de representantes, que reutiliza `RepresentantesLegalesFieldArray`.
2. **Pagos**: lista de métodos como tarjetas. "Agregar método" abre un menú (Transferencia / Pago Móvil / Zelle) y cada tarjeta muestra solo los campos de su tipo. Con la cuenta de 20 dígitos el banco se completa solo (chip con el nombre del banco). Radio "Preferido". Las tarjetas entran y salen con `Collapse`. El paso puede quedar vacío (no es obligatorio tener método de pago).
3. **Documentos**: checklist visual de documentos requeridos según tipo de persona, cada uno con su `DocumentoUpload`. Más "Otros documentos".

Flujo:
- **Alta**: "Siguiente" valida solo los campos del paso (`trigger([...])`). En el paso 2, el botón dice **"Guardar y continuar"**: crea el proveedor y avanza al paso 3 **sin cerrar el diálogo**, para subir los documentos en el mismo flujo (corrige la fricción de clientes, donde hay que cerrar y volver a abrir). "Finalizar" cierra. Si se cierra en el paso 3, el proveedor ya quedó guardado (solo faltan documentos, y el indicador lo muestra).
- **Edición**: los pasos se navegan libremente (`StepButton`). Un paso con errores muestra el `StepLabel` en `error` para que el usuario sepa a dónde ir.
- Si se cierra con cambios sin guardar (`formState.isDirty`) → `ConfirmDialog` "¿Descartar cambios?".
- Contenido de cada paso con `Fade` (`duration.short`) al cambiar de paso.

### `/proveedores/[id]` (ficha)

- Encabezado: `Avatar` con iniciales + nombre + RIF + chips de estado. Acciones: Editar (abre el diálogo en el paso que corresponda), Bloquear/Desbloquear (admin), Desactivar/Activar.
- Si está bloqueado: `Alert severity="error"` arriba con el motivo.
- Si falta documentación: `Alert severity="warning"` con la lista de faltantes y el botón "Completar documentos" (abre el diálogo en el paso 3).
- Grid responsive (1 columna en `xs`, 2 en `md+`) de tarjetas:
  - **Datos generales y contacto.**
  - **Representantes legales** (solo jurídica).
  - **Métodos de pago**: cada dato (cuenta, teléfono de Pago Móvil, RIF del titular, email de Zelle) con un botón **copiar al portapapeles** (`navigator.clipboard` + toast "Copiado"), porque es lo que se usa al momento de pagarle al proveedor. En la ficha la cuenta se muestra completa; en el listado, enmascarada (`0105 •••• •••• 1234`).
  - **Documentos**: miniaturas de imágenes, ícono para PDF, "Ver" (signed URL en pestaña nueva).
  - **Saldo pendiente**: `—` hasta que `04-inventario` exponga `proveedorBalanceService`.
  - **Historial de compras**: solo lectura desde `compras` (fecha, condición, total, estado), con `EmptyState` si no hay compras.

### Diálogo de bloqueo

Pequeño formulario propio (no `ConfirmDialog` genérico, porque lleva un campo): `TextField` multilínea "Motivo *", validado con `zod` (mínimo 10 caracteres, para que el motivo sea útil después). Botón `error` con loader interno. El desbloqueo sí usa `ConfirmDialog`.

## Validación (patrón de `00-estandares-ui`)

`src/lib/proveedorValidation.ts`:
- Reusa `RIF_CI_REGEX`, `CEDULA_REGEX` y `representanteSchema` de `clienteValidation.ts` (no se redeclaran).
- `TELEFONO_VE_REGEX` (`^0(2\d{2}|4(12|14|16|24|26|22))-?\d{7}$`), que se agrega a `clienteValidation.ts` para que clientes lo use también.
- `metodoPagoSchema` = `z.discriminatedUnion('tipo', [...])`: transferencia (cuenta 20 dígitos + prefijo de banco conocido + titular + RIF/CI del titular), pago_movil (banco + teléfono móvil + RIF/CI), zelle (titular + email **o** teléfono, con `.refine`).
- `proveedorFormSchema` con `.superRefine`: jurídica exige ≥1 representante; a lo sumo un método `preferido`; no hay métodos duplicados (misma cuenta o mismo teléfono de Pago Móvil dos veces).
- `bloqueoSchema` (motivo ≥10 caracteres).

**Server Actions**: cada action corre `proveedorFormSchema.safeParse` **antes** de llamar al servicio (regla de `00-estandares-ui`, desde el primer commit). El estado de la action incluye `fieldErrors?: Record<string, string>` y el formulario los aplica con `setError`. Así aparecen en su campo:
- errores de `zod` del servidor;
- **RIF duplicado** (violación del índice único `23505` → "Ya existe un proveedor con este RIF", en el campo `rif_ci`);
- violaciones de los `check` de métodos de pago.

Como este es el segundo módulo que repite mensajes ("Formato inválido (V-/E-/J- + números)", "Email inválido", "Nombre requerido"), se crea **ahora** `src/lib/validationMessages.ts` y `clienteValidation.ts` pasa a usarlo (tarea 22 de `00-estandares-ui`).

## Componentes compartidos que este módulo generaliza

| Componente | Cambio | Impacto en `02-clientes` |
|---|---|---|
| `molecules/DocumentoUpload` | Deja de estar atado a `documentoClienteRepository`: recibe un adaptador `DocumentoStore` (`list`, `upload`, `getUrl`, `remove`). Se le suman arrastrar y soltar, validación de tipo/tamaño antes de subir, compresión de fotos en el cliente (canvas, lado mayor 1600 px, JPEG 0.8, sin dependencias), `capture="environment"` en móvil (abre la cámara), miniatura, `Skeleton` en vez de "Cargando…", `Fade` al mostrar, y **reemplazo real** (sube el nuevo y luego borra el anterior, en vez de acumular). | Clientes pasa su propio adaptador; mismo comportamiento y mejor UX. |
| `molecules/RepresentantesLegalesFieldArray` | Tipado genérico (`{ representantes: RepresentanteFormValues[] }`) en vez de `ClienteFormValues`. Filas con `Collapse` (tarea 26 de `00-estandares-ui`). | Ninguno funcional. |
| `molecules/CopyableText` (**nuevo**) | Texto + `IconButton` copiar + toast. | Disponible para la ficha de cliente. |
| `molecules/StatusChips` (**nuevo**) | Chips de bloqueado / doc. incompleta / inactivo con tooltip. | Clientes puede adoptarlo. |
| `lib/actionState.ts` (**nuevo**) | Tipo `ActionState { error, success, fieldErrors? }` + `toActionError(e)` (sale de `clientes/actions.ts`, hoy duplicado) que mapea errores de Postgres (`23505`, `23514`, `42501`) a mensajes de dominio. | `clientes/actions.ts` lo reutiliza. |
| `lib/bancosVe.ts` (**nuevo**) | Catálogo de bancos + `bancoDesdeCuenta()` + `enmascararCuenta()`. | Útil luego en `05-ventas` (cobros). |

Todos se agregan a la tabla de "Componentes compartidos" de `00-estandares-ui/spec.md`.

## Regla de integridad

- Un proveedor con `compras` nunca se borra físicamente. La UI **no ofrece "eliminar"**, solo desactivar. El repositorio sí implementa `delete` (lo exige la interfaz), pero primero cuenta las compras y, si hay, lanza `ProveedorConComprasError`.
- Desactivar un proveedor no borra sus métodos de pago, representantes ni documentos.

## Saldo pendiente (solo lectura)

`Σ(compras.subtotal_usd − compras.pagado_usd)` de las compras `abierta`. La lógica vive en `04-inventario` (`proveedorBalanceService`). Este módulo expone `getSaldoPendiente(id): Promise<number | null>`, que devuelve `null` (UI: `—`) hasta que ese servicio exista.

## Fuera de alcance (MVP)

- Verificación automática de RIF contra SENIAT o de cuentas contra el banco (sí se valida formato y prefijo de banco).
- Dígitos de control de la cuenta bancaria (algoritmo SUDEBAN): se puede agregar después en `bancosVe.ts` sin cambiar el esquema.
- Historial de cambios (auditoría), scoring de proveedores, vencimiento de documentos.
- OCR de cédula/RIF.
