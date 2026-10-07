# 11 — Refactor visual de Proveedores

## Historia de usuario

> **Como** quien administra las compras (admin u operador),
> **quiero** que el listado, la ficha y los diálogos de proveedores se vean y se comporten igual que el resto de la app (tablas, fichas, botones y teléfono),
> **para** encontrar rápido al proveedor, ver de un vistazo cuánto se le debe y actuar sobre él sin dudar si la acción se hizo o no.

Criterios de aceptación (resumen; el detalle está en `checklist.md`):

1. El listado `/proveedores` usa `AppDataGrid`: 25 filas por defecto, búsqueda que ignora acentos y separadores del RIF, filtros como chips en la URL, fila abrible con clic o Enter, tarjetas en el teléfono y saldo pendiente real.
2. En el teléfono, "Nuevo proveedor" es un `Fab` y ninguna pantalla de proveedores tiene scroll horizontal.
3. La ficha tiene encabezado estándar (`FichaHeader`: nombre `h5`, RIF copiable, chips, acciones en `⋮` en `xs`), secciones con radio 8 y borde, y el saldo pendiente como cifra protagonista.
4. La ficha carga todos sus datos en el servidor: un error muestra `ErrorState`, nunca secciones vacías.
5. Todo diálogo de proveedores es `AppDialog` (el form migra a `md` conservando el Stepper de 3 pasos) y toda acción en curso usa `Button loading`; mientras guarda no se puede cerrar ni editar, y el doble envío es imposible.
6. Se ve bien en claro y oscuro, a 375, 768, 1024 y 1440 px.

## Contexto

`03-proveedores` está `done` en lo funcional. La Fase 2a de `00-estandares-ui` construyó la base del acabado visual y `10-refactor-visual-clientes` (hecho, piloto) migró clientes dejando en los componentes base lo que este módulo reusa: `FichaHeader`, `normalizeSearch` de `AppDataGrid`, `StatusChips` `soft` con `mostrarActivo`, `BloqueoDialog` sobre `AppDialog`, `EmptyState compact`, `RowActionsMenu` con `pending`, `navigationOrigin`.

Este módulo es la **Fase 2b de `00-estandares-ui` aplicada a proveedores** (tareas 40–43 de `00-estandares-ui/tasks.md` para `ProveedoresTable`, `ProveedorForm` y la ficha).

**Referencias** (no se duplican aquí):
- `00-estandares-ui/spec.md`: Identidad visual, Tipografía, Responsive, Loaders, Botones, Tablas y paginación, Modales, catálogo de Componentes compartidos.
- `10-refactor-visual-clientes/spec.md`: el patrón a replicar (listado, ficha, acciones, copy).
- `03-proveedores/spec.md`: qué datos y acciones existen (no cambian).

**No cambia**: esquema, RLS, servicios de negocio, validaciones (`proveedorValidation.ts`), reglas de bloqueo/desactivación ni permisos por rol. Las Server Actions ya corren `safeParse` (verificado en `03-proveedores/checklist.md`). Es refactor de presentación + mover la carga de datos de la ficha al servidor. El Stepper de 3 pasos con "Guardar y continuar" se **conserva** (decisión de `03-proveedores/spec.md`); solo migra a `AppDialog size="md"`.

Decisiones cerradas con el usuario (2026-10-07):

1. **Columnas secundarias del listado** (teléfono, contacto, método de pago preferido, saldo pendiente): visibles en `md+`, ocultas en `xs`/`sm`. Hoy están ocultas **siempre** (`columnVisibilityModel` fijo), lo que contradice `03-proveedores/spec.md` §89 ("ocultas en `xs`/`sm`"): es un bug que este módulo corrige.
2. **Saldo pendiente con datos reales**: el listado y la ficha muestran el saldo vía `proveedorService.getSaldoPendiente` / `proveedorBalanceService` (04-inventario ya lo expone). La columna actual es un placeholder muerto (`valueGetter: () => '—'`). En la ficha es cifra protagonista (`h5` con cifras tabulares), no un `body2` suelto.
3. **CarteraIndicador de 09**: fuera de alcance. El dominio CxP no existe (sin `fecha_vencimiento` en compras ni `carteraDeProveedor`); queda para el futuro módulo de cuentas por pagar.
4. La carga de representantes y documentos en la edición del form se mueve al servidor (o al menos se tipa y se maneja su error); ver "Diálogos y acciones".

## Estado actual (2026-10-07)

| Pieza | Archivo | Qué falta frente al estándar |
|---|---|---|
| Listado | `organisms/ProveedoresTable.tsx` | `DataGrid` crudo (no `AppDataGrid`); `pageSize 10`, opciones `[10,25,50]`; `GridToolbarQuickFilter` sin normalizar (buscar "v12345" no encuentra "V-12.345") ni reinicio de página; Switch "Mostrar inactivos" con estado local (no chips, no URL); `columnVisibilityModel` oculta teléfono/contacto/método/saldo **siempre**; menú `⋮` armado a mano (`Menu/MenuItem`, `MoreVertIcon` relleno); "Ver ficha" duplica el clic de fila; fila solo con clic de mouse (sin `getRowHref` ni Enter); sin `mobileCard`; `StatusChips` sin `mostrarActivo`; columna "Saldo pendiente" con `valueGetter: () => '—'` (muerta); `EmptyState` fuera de la tabla; `noResultsOverlay` sin "Limpiar búsqueda". |
| Pantalla | `proveedores/proveedores-screen.tsx` | `PageHeader` con `children` (sin `Fab` en `xs`); `AddIcon` relleno; `run()` con `as never` sobre las actions (no existe `ProveedorActionState` ni `useProveedorAcciones`); un solo `isPending` global descartado con `[, startTransition]` (sin `pendienteId` por fila); sin guard de doble envío; falta espacio inferior para el futuro `Fab`. |
| Ficha | `proveedores/[id]/proveedor-ficha.tsx` | `PageHeader` + `Avatar` en vez de `FichaHeader` (título no `h5 component="h1"`; acciones se apilan en `xs` en vez de ir a `⋮`); `ArrowBackIcon` relleno; sin `navigationOrigin`/`router.back()` (no conserva `?pagina`); **consulta Supabase desde el navegador** (`createClient` + repos browser + query cruda a `compras` con `as CompraCruda` y `total_usd: c.subtotal_usd`, incorrecto: el total real de la compra no es el subtotal) **sin catch**: si falla, secciones vacías; `Seccion` local (`Paper p:3`) en vez de `FichaSeccion`; filas `Fila/FilaDetalle` a mano en vez de `FichaDatos`; tablas `Table` de MUI para representantes y compras (scroll horizontal en `xs`, sin paginación); "Cargando…" en texto en vez de skeleton; botones `disabled` sin `loading`; `isPending` global; saldo en un `body2` suelto; documentos con `LinkIcon` como enlace "Ver"; `Fade timeout={200}` numérico. |
| Carga ficha | `proveedores/[id]/page.tsx` | Servidor carga solo proveedor y saldo; representantes, métodos, documentos y compras van en el cliente; consultas secuenciales (sin `Promise.all`). |
| Loading ficha | `proveedores/[id]/loading.tsx` | `PageLoader variant="form"` (debería ser `"ficha"`, como clientes). |
| Error ficha | `proveedores/[id]/error.tsx` | **No existe**: un fallo de carga deja secciones vacías. |
| Form | `organisms/ProveedorForm.tsx` | `Dialog` a mano (`DialogTitle/Content/Actions`), no `AppDialog size="md"`; botones con `disabled={isPending}` en vez de prop `loading` (uno con el patrón prohibido `startIcon={isPending ? <CircularProgress/>}`); sin `useForm({ disabled: isPending })` (campos editables mientras guarda); carga de representantes y documentos desde el navegador al abrir edición; sin guard de doble envío en `onSubmit`; timeouts numéricos sueltos (`{enter: 200, exit: 100}`). |
| Molecules | `DocumentosRequeridos.tsx` | Sin prop `disabled` (no puede propagar a `DocumentoUpload.disabled`, que ya existe). |
| Molecules | `MetodosPagoFieldArray.tsx` | `AddIcon` relleno; `timeout={300}` numérico. |
| Molecules | `MetodoPagoCard.tsx` | `eslint-disable no-explicit-any` + `as any` (~38–39); `timeout={200}` numérico. |
| Molecules | `ProveedorIdentificacionFields.tsx` | `timeout={300}` numérico. |
| Bloqueo | `organisms/BloqueoDialog.tsx` (compartido) | Ya migrado por 10 (`AppDialog xs`, `loading`, `pending`/`dirty`, anti doble envío). Solo copy: en proveedores el título es "Bloquear proveedor: {nombre}" vs. el patrón "Bloquear a {nombre}". |

**Ya cumple** (no se toca): carga del listado en servidor; `PageLoader` en ambos `loading.tsx` (salvo la variante de ficha); `ErrorState` en `error.tsx` del listado; `EmptyState` + `not-found.tsx`; `StatusChips` soft; `CopyableText` en la ficha; `useConfirm`; `useNotify`; Server Actions con `safeParse`; Stepper con "Guardar y continuar"; `enmascararCuenta` en el listado; `DocumentoUpload` en sí.

## Alcance

### Listado `/proveedores`

- **Encabezado**: `PageHeader title="Proveedores"` con `primaryAction` "Nuevo proveedor" (`AddOutlined`). En `xs` es `Fab` extendido; la lista deja espacio inferior (`pb`) para que no tape la última tarjeta.
- **Tabla**: `ProveedoresTable` pasa a ser un envoltorio de `AppDataGrid` (`tableId="proveedores"`, `label="Proveedores"`, `mode="client"`), con `pageSize 25` y opciones `[25,50,100]`:

  | Columna | Contenido | Notas |
  |---|---|---|
  | Proveedor | nombre (`body2` 500) + RIF/cédula en `caption` | "Sin RIF / cédula" si falta |
  | Teléfono | teléfono o `—` | cifras tabulares; secundaria |
  | Contacto | `contacto_nombre` o `—` | secundaria |
  | Método de pago preferido | etiqueta del método, cuenta enmascarada (`enmascararCuenta`) | secundaria |
  | Saldo pendiente | `colMonto` USD a la derecha | **datos reales** vía `getSaldoPendiente`; `—` si es `null` |
  | Estado | `StatusChips soft` con `mostrarActivo`: Activo / Bloqueado (tooltip motivo) / Inactivo / Doc. incompleta (tooltip faltantes) | como en clientes |
  | (acciones) | `colAcciones` + `RowActionsMenu` | Editar · Bloquear/Desbloquear (solo admin) · Desactivar/Activar. `pending` en la fila cuya acción está en curso |

  Las columnas secundarias (Teléfono, Contacto, Método de pago, Saldo pendiente) van con `hideOnMobile`: visibles en `md+`, ocultas en `xs`/`sm`.
- **Filtros**: chips exclusivos en la barra (`filters` de `AppDataGrid`): "Activos (n)" (por defecto), "Bloqueados (n)", "Todos (n)". **Reemplaza el Switch "Mostrar inactivos"** (cubre lo que hacía el switch: "Todos" incluye inactivos). Vive en la URL (`?estado=`, sin parámetro = activos), como `?pagina=`. Al cambiar de filtro, la página vuelve a 1.
- **Búsqueda**: placeholder "Buscar por nombre, RIF o contacto" con `normalizeSearch={normalizarBusquedaSinSeparadores}` (10 ya lo dejó en `AppDataGrid`): "v12345" encuentra "V-12.345".
- **Fila → ficha**: `getRowHref` a `/proveedores/[id]` (clic + Enter). Quita el ítem "Ver ficha" del menú `⋮` y el menú `Menu/MenuItem` a mano.
- **Estados**: sin proveedores → `EmptyState` "Aún no hay proveedores" + acción "Nuevo proveedor". Sin resultados → el estándar de `AppDataGrid` ("Sin resultados para «…»" + "Limpiar búsqueda"). Filtro sin filas → `EmptyState` con mensaje del filtro ("No hay proveedores bloqueados") y acción "Ver todos".
- **Teléfono (`xs`)** — `mobileCard`: `primary` nombre, `secondary` RIF, `status` solo chips que informan (Bloqueado / Inactivo / Doc. incompleta; "Activo" no se repite), `actions` el mismo `RowActionsMenu` con tamaño `medium` (44 px), y **saldo visible en la tarjeta** (los pagos son el motivo de consulta más común).

### Ficha `/proveedores/[id]`

- **Encabezado** — `FichaHeader` (reusa el de 10): `backHref="/proveedores"`, `backLabel="Proveedores"`, vuelta con `navigationOrigin`/`router.back()` (conserva `?pagina` y `?estado`), título `h5 component="h1"` con `overflowWrap: anywhere`; `meta`: RIF con `CopyableText` + tipo de persona + `StatusChips` sin "Activo"; acciones: `sm+` "Editar proveedor" `outlined` + `⋮` (Bloquear/Desbloquear, Desactivar/Activar; solo admin), `xs` todo en `⋮`; `pending={pendienteId === proveedor.id}`. Quita el `Avatar` con iniciales.
- **Avisos**: los `Alert` de bloqueo y documentación incompleta se mantienen, con `maxWidth: '75ch'` y botones ("Desbloquear", "Completar documentos") con `loading`.
- **Secciones** (`FichaSeccion`, radio 8 + borde, sin sombra), dos columnas en `md+` y una en `xs`:
  - **Datos generales y contacto** — `FichaDatos`.
  - **Representantes legales** (solo jurídica) — lista tipo `FichaDatos` (nombre, cédula, cargo, teléfono), separados por `Divider`; no tabla (así `xs` no pierde columnas).
  - **Métodos de pago** — `CopyableText` en cada dato (cuenta, teléfono Pago Móvil, RIF del titular, email de Zelle); la cuenta se muestra **completa** en la ficha (en el listado va enmascarada).
  - **Documentos** — miniaturas de imágenes / ícono PDF + botón "Ver" normal (signed URL en pestaña nueva) con `aria-label` que diga qué se abre; no un `LinkIcon` como enlace.
  - **Saldo pendiente** — **cifra protagonista**: `variant="h5"` con `formatUsd` + cifras tabulares (como `CreditoResumen` en clientes), no un `body2` suelto. Si el servicio expone el conteo de compras abiertas, se indica; si el saldo es `null` (sin compras abiertas), "$0.00" o "—" según lo que devuelva hoy el servicio (que no cambia).
  - **Historial de compras** — `AppDataGrid` embebida: `colFecha`, `colMonto` con el **total real** de la compra (corregir el `total_usd: c.subtotal_usd` actual), `colEstado`, `searchable={false}`, `pageParam` propio (p. ej. `pcompras`), `mobileCard`, `EmptyState` compacto "Aún no hay compras". Sustituye la tabla `Table` de MUI a mano.
- **Carga 100% en servidor**: `[id]/page.tsx` obtiene proveedor, saldo, representantes, métodos, documentos y compras con `Promise.all` vía los servicios existentes (`proveedorService`, repositorios ya definidos en `lib/repositories/interfaces.ts`), y los pasa por props. `proveedor-ficha.tsx` deja de importar `createClient` y los repos browser, y pierde los estados `loading` en texto. La carga la cubre `[id]/loading.tsx` con `PageLoader variant="ficha"`, y un fallo lo captura un **`[id]/error.tsx` nuevo** con `ErrorState` + "Reintentar". Botones con `loading`, `pendienteId` de `useProveedorAcciones`.

### Diálogos y acciones

- **`useProveedorAcciones` + `ProveedorActionState`**: hook nuevo (patrón de `useClienteAcciones` de 10) y estado tipado en `proveedores/actions.ts` (como `ClienteActionState` en `clientes/actions.ts`): elimina los `as never` de `proveedores-screen.tsx`; expone `pendienteId` por fila; guard de doble envío con ref síncrona (ignora una segunda acción sobre el mismo proveedor mientras la primera corre).
- **`ProveedorForm` → `AppDialog size="md"`**: conserva el Stepper de 3 pasos y su pie de navegación (Anterior / Siguiente / "Guardar y continuar" / Finalizar). Si `AppDialog` no soporta un pie custom con esos botones, se **extiende `AppDialog` con una prop de pie custom sin romper `ClienteForm`**. `fullScreen` + `Slide` en `xs` lo da `AppDialog`. Todos los botones con `loading` nativo (fuera `startIcon={isPending ? <CircularProgress/>}` y `disabled={isPending}` sueltos); `useForm({ disabled: isPending })`; `DocumentoUpload` deshabilitado mientras guarda.
- **`DocumentosRequeridos`**: prop `disabled`/`pending` que propaga a cada `DocumentoUpload` (que ya tiene `disabled` desde 10).
- **Navegación del Stepper intacta**: `trigger(CAMPOS_POR_PASO)`, "Guardar y continuar" (paso 2 crea y avanza sin cerrar), `pasoInicial` desde la ficha ("Completar documentos" abre en el paso 3), `StepButton` libre en edición, `StepLabel error`, ConfirmDialog al cerrar sucio.
- **Carga de representantes y documentos en edición**: hoy se hace desde el navegador al abrir el diálogo. Migrarla al servidor: la forma más simple es que los datos lleguen por props desde donde abre el form (la ficha ya los tendrá tras la carga en servidor). Si eso obliga a tocar demasiado, como mínimo: tipar el resultado, manejar el error (toast con causa) y anotarlo como deuda en el checklist. Lo decide quien implemente, sin abrir el form desde la ficha dos veces la misma carga.
- **`BloqueoDialog`**: ya migrado por 10; solo copy en el uso de proveedores — título "Bloquear a {nombre}" (hoy "Bloquear proveedor: {nombre}"), unificado con el patrón de clientes.
- **Copy** (tarea 43 de 00): verbo del botón = verbo del toast — "Guardar proveedor"/"Proveedor guardado", "Actualizar proveedor"/"Proveedor actualizado", "Bloquear a {nombre}"/"Proveedor bloqueado", "Desbloquear"/"Proveedor desbloqueado", "Desactivar"/"Proveedor desactivado", "Activar"/"Proveedor activado". Errores con causa y solución, sin disculpas.

### Cambios en componentes compartidos

| Componente | Cambio |
|---|---|
| `organisms/AppDialog` | Si el pie del Stepper no entra en `primaryAction`, prop de pie custom (p. ej. `footer?: ReactNode`), sin romper `ClienteForm` ni los diálogos existentes. |
| `molecules/DocumentosRequeridos` | Prop `disabled` (propaga a `DocumentoUpload`). |
| `FichaHeader` / `FichaSeccion` / `FichaDatos` / `RowActionsMenu` / `AppDataGrid` / `StatusChips` / `BloqueoDialog` | Solo se **reusan**; no cambian salvo un gap real que se detecte al usarlos (anotarlo si pasa). |
| `organisms/BloqueoDialog` | Solo revisión de uso en proveedores + unificar copy del título. |

Los que se toquen se anotan en la tabla de "Componentes compartidos" de `00-estandares-ui/spec.md` y en su `tasks.md` ("Componentes agregados después de la primera pasada").

### Limpieza transversal (dentro de proveedores)

- `AddIcon` → `AddOutlined` (`proveedores-screen.tsx`, `MetodosPagoFieldArray.tsx`).
- `as any` + `eslint-disable` en `MetodoPagoCard.tsx`: tipar con el genérico del FieldArray o los types del schema.
- `LinkIcon` como enlace "Ver" → botón "Ver" normal.
- Timeouts numéricos (`timeout={200/300}`, `{enter: 200, exit: 100}`) → tokens del theme (`theme.transitions.duration.short/standard`).
- Query cruda `as CompraCruda` y `total_usd: subtotal_usd`: fuera (carga en servidor con el total real).

## Fuera de alcance (MVP)

- **CarteraIndicador / CxP**: el dominio CxP no existe (compras sin `fecha_vencimiento`, sin `carteraDeProveedor`). Queda para el futuro módulo de cuentas por pagar que reusará `lib/cartera` (ver `09-cuentas-por-cobrar`).
- Vencimientos de compras.
- Paginación en servidor del listado: proveedores es un catálogo → `mode="client"` (00, "Tablas y paginación").
- Cambios de esquema, RLS, servicios de negocio o validaciones.
- Logo real (pendiente (g) de 00), "Exportar", recordatorios a proveedores.

## Dependencias y orden

- Depende de: `00-estandares-ui` Fase 2a (hecha), `03-proveedores` (hecho), `10-refactor-visual-clientes` (hecho — provee `FichaHeader`, `useClienteAcciones` como patrón, `StatusChips` `soft`, `BloqueoDialog` ya migrado). `09-cuentas-por-cobrar` está hecho, pero su cartera no aplica a proveedores (ver "Fuera de alcance").
- Coordinación: otro agente puede estar trabajando en el mismo árbol (Fase 2b sigue con otras tablas). Revisar `git status` antes de cada tarea y no editar archivos con cambios ajenos sin commitear.