# 12 — Refactor visual de Catálogos

## Historia de usuario

> **Como** administrador,
> **quiero** que el catálogo de productos y la configuración del negocio se vean y se comporten igual que el resto de la app (tabla, diálogos, botones y teléfono),
> **para** dar de alta o ajustar un producto rápido, sin dudar si la acción se hizo o no, y retomar donde estaba tras navegar fuera.

Criterios de aceptación (resumen; el detalle en `checklist.md`):

1. `/catalogos` usa `AppDataGrid` para productos: 25 filas por defecto, búsqueda que ignora acentos y separadores del código ("cur001" encuentra "CUR-001"), filtro en chips que vive en la URL, tarjetas en el teléfono.
2. El tab activo (Productos / Configuración) persiste en `?tab=`: navegar fuera y volver restaura el tab, y el vínculo directo `?tab=configuracion` abre la configuración.
3. En el teléfono, "Nuevo producto" es un `Fab` y ninguna vista de catálogos tiene scroll horizontal.
4. Todo diálogo de catálogos es `AppDialog` ("sm" el de producto) y toda acción en curso usa `Button loading`; mientras guarda no se puede cerrar ni editar, y el doble envío es imposible.
5. Se ve bien en claro y oscuro, a 375, 768, 1024 y 1440 px.

## Contexto

`04-inventario` construyó la pantalla funcional de catálogos (`/catalogos`: productos + configuración). La Fase 2a de `00-estandares-ui` construyó la base visual y `10`/`11` migraron clientes y proveedores dejando el patrón a seguir: `AppDataGrid` con `normalizeSearch` y chips en la URL, `RowActionsMenu` con `pending` por fila, `AppDialog` con `pending`/`dirty`, hook de acciones tipado (`useClienteAcciones` como referencia).

Este módulo es la **Fase 2b de `00-estandares-ui` aplicada a catálogos** (tareas 40–43 de `00-estandares-ui/tasks.md` para `ProductosTable`, `ProductoForm` y `ConfigNegocioForm`).

**Referencias** (no se duplican aquí):
- `00-estandares-ui/spec.md`: Identidad visual, Tipografía, Responsive, Loaders, Botones, Tablas y paginación, Modales, catálogo de Componentes compartidos.
- `11-refactor-visual-proveedores/spec.md`: el patrón a replicar (listado, acciones tipadas, copy).
- `04-inventario/spec.md`: qué datos y acciones existen (no cambian).

**No cambia**: esquema, RLS, `productoService`, validaciones (`productoValidation.ts`, `configValidation.ts`), reglas de activar/desactivar, permisos por rol (catálogos y config son admin-only para escribir; el listado lo ve todo `authenticated`) ni el comportamiento del trigger `productos_guard_origen`. Las Server Actions ya corren `safeParse` (verificado). Es refactor de presentación.

Decisiones cerradas con el usuario (2026-10-07):

1. **Pestañas**: Productos y Configuración siguen conviviendo en `/catalogos` con Tabs. El tab activo persiste en `?tab=` (`history.replaceState`, sin recarga del servidor), porque hoy el admin que edita la configuración pierde el tab al navegar fuera y volver.
2. **Búsqueda normalizada**: `normalizarBusquedaSinSeparadores` sobre nombre, código y categoría: "cur001" encuentra "CUR-001" y "merluza" ignora acentos.

## Estado actual (2026-10-07)

| Pieza | Archivo | Qué falta frente al estándar |
|---|---|---|
| Pantalla | `catalogos/catalogos-screen.tsx` | `PageHeader` con `children` (sin `Fab` en `xs`); `AddIcon` relleno; Tabs con estado local (`useState(0)`, sin URL): navegar fuera y volver siempre aterriza en Productos; "Nuevo producto" visible aunque el tab activo sea Configuración. |
| Tabla | `organisms/ProductosTable.tsx` | `DataGrid` crudo (no `AppDataGrid`): pageSize 10 y opciones `[10,25,50]`; `GridToolbarQuickFilter` fuera de la barra estándar (sin normalizar, sin reinicio de página al buscar); Switch "Mostrar inactivos" con estado local (no chips, no URL, no cuenta en el label); `categoria` oculta **siempre** (`columnVisibilityModel` fijo); acciones como `IconButton`s sueltos con un solo `isPending` global (todas las filas quedan bloqueadas a la vez, sin `pendienteId`); chips `outlined` sueltos para tipo/stock/estado (no `soft`); sin `mobileCard` (tabla con scroll horizontal potencial en `xs`); `EmptyState` fuera de la tabla (renderiza tabla vacía o `EmptyState`, nunca overlay); sin botón de acción en el estado vacío. |
| Form | `organisms/ProductoForm.tsx` | `Dialog` a mano (`DialogTitle/Content/Actions`, `maxWidth="sm"`, `useMediaQuery` propio para `fullScreen`) en vez de `AppDialog size="sm"`; patrón prohibido `startIcon={isPending ? <CircularProgress/>}` y `disabled={isPending}` sueltos; sin `useForm({ disabled: isPending })` (campos editables mientras guarda); sin guard de doble envío en `onSubmit`; copy "Guardar" (el toast dice "Producto creado" — verbo del botón ≠ verbo del toast). |
| Config | `organisms/ConfigNegocioForm.tsx` | Patrón prohibido en el botón guardar (`startIcon={CircularProgress}`); campos editables mientras guarda (sin `useForm({ disabled })`). El resto (campos, secciones, vista previa) está bien. |
| Actions | `catalogos/actions.ts` | Funcionales y con `safeParse` (bien); sin `ProductoActionState` tipado (usa `UpsertProductoState` con `id`, suficiente para el form; desactivar/activar devuelven `ActionState` crudo que la tabla consume con un `fn` tipado a mano y un `isPending` global). |

**Ya cumple** (no se toca): carga del listado y config en el servidor (`page.tsx` con repos y `requireAdmin`); `loading.tsx` con `PageLoader variant="table"`; `error.tsx` con `ErrorState` + "Reintentar"; `NumberField` en config; `useConfirm` en desactivar; `useNotify`; Server Actions con `safeParse`; `EmptyState` con mensajes correctos; `productoValidation`/`configValidation` intactas.

## Alcance

### Pantalla `/catalogos`

- **Encabezado**: `PageHeader title="Catálogos"` con `primaryAction` "Nuevo producto" (`AddOutlined`), **solo cuando el tab activo es Productos y el usuario es admin**. En `xs` es `Fab` extendido; la lista deja espacio inferior (`pb`) para que no tape la última tarjeta.
- **Tabs**: "Productos" y "Configuración" (solo admin). El activo vive en `?tab=` (`configuracion`; sin parámetro o `productos` = Productos), escrito con `history.replaceState` (sin pedir la página al servidor, igual que `?pagina=` de `AppDataGrid`). Navegar fuera y volver restaura el tab; el vínculo directo con `?tab=configuracion` abre la config.
- **Listado (tab Productos)**: `ProductosTable` (abajo).
- **Configuración (tab Configuración)**: `ConfigNegocioForm` con el patrón de botones en carga (abajo). Secciones y campos intactos.

### `ProductosTable` sobre `AppDataGrid`

`tableId="productos"`, `label="Productos"`, `mode="client"` (catálogo que crece poco), `pageSize` 25 y `[25,50,100]`:

| Columna | Contenido | Notas |
|---|---|---|
| Producto | nombre (`body2` 500) + "de {crudo}" en `caption` si es procesado ("Sin crudo asignado" en `warning.main`, como hoy) | |
| Código | código o `—` | cifras tabulares |
| Tipo | chip `soft`: "Crudo" (`secondary` suave) / "Procesado" (`primary` suave) | los colores por estado se toman de la variante `soft` del theme, no `outlined` |
| Categoría | categoría o `—` | `hideOnMobile` |
| Stock | chip `soft` "Controla stock" / "Sin stock" | `hideOnMobile` |
| Estado | chip `soft`: Activo (success) / Inactivo (default) | 22 px |
| (acciones) | `colAcciones` + `RowActionsMenu` (solo admin) | Editar · Desactivar (confirm, `destructive`) / Activar. `pending` en la fila cuya acción está en curso |

Sin `getRowHref` (no hay ficha de producto; la edición es el diálogo).

- **Filtros**: chips exclusivos "Activos (n)" (por defecto) / "Todos (n)" en `filters` de `AppDataGrid`. **Reemplaza el Switch "Mostrar inactivos"** ("Todos" incluye inactivos). Vive en `?estado=` (`todos`; sin parámetro = activos) como `?pagina=`; al cambiar el filtro, la página vuelve a 1. Filtro sin filas → `EmptyState` "No hay productos inactivos" + "Ver activos".
- **Búsqueda**: placeholder "Buscar por nombre, código o categoría" con `normalizeSearch={normalizarBusquedaSinSeparadores}` y `getSearchValues` = [nombre, codigo, categoria, nombre del crudo origen] (que "merluza" también encuentre el procesado "de merluza"). "cur001" encuentra "CUR-001".
- **Estados**: sin productos → `EmptyState` "Aún no hay productos" + descripción + acción "Nuevo producto" (solo admin; sin admin, sin botón). Sin resultados → el estándar de `AppDataGrid` ("Limpiar búsqueda").
- **Teléfono (`xs`)** — `mobileCard`: `primary` nombre, `secondary` código o "Sin código", chips solo informativos (Tipo / Inactivo; "Activo" no se repite), `RowActionsMenu` `medium`.

### `ProductoForm` → `AppDialog size="sm"`

- Fuera `DialogTitle/Content/Actions` a mano, el `useMediaQuery`/`fullScreen` propio (lo da `AppDialog`: pantalla completa + `Slide` en `xs`) y el `CircularProgress` manual.
- `Button type="submit" variant="contained" loading={isPending}` como `primaryAction` de `AppDialog`; `useForm({ disabled: isPending })` (campos no editables mientras guarda); `pending` a `AppDialog` (no se cierra con Esc ni con la X mientras guarda); `dirty` mantiene la protección de "¿Descartar cambios?" (la gestiona `AppDialog`); `onSubmit` del diálogo envuelve el contenido en el `<form>`.
- Guard de doble envío en el handler (ref síncrona, como `ClienteForm.submittingRef`).
- Error del servidor: `Alert` del `AppDialog` (`error`) + `fieldErrors` mapeados a cada campo (como hoy).
- **Copy**: "Nuevo producto" / "Editar producto" (títulos); "Guardar producto"/"Producto creado" y "Actualizar producto"/"Producto actualizado" (verbo del botón = verbo del toast).
- Campos, validación, regla "se obtiene de" (procesado → crudo origen, filtrando al propio producto) y manejo del trigger `productos_guard_origen` intactos.

### `ConfigNegocioForm`

- Solo el patrón del botón: `Button type="submit" loading={isPending}` (fuera el `startIcon={CircularProgress}`) y `useForm({ disabled: isPending })` para que ningún campo sea editable mientras guarda.
- Sin tocar campos, secciones, vista previa de instrucciones, defaults de 08/09 ni la action (`updateConfigAction` ya valida con `safeParse` y revalida las rutas que dependen de ella).

### Acciones tipadas

- **`ProductoActionState` + `useProductoAcciones`** (patrón de `useClienteAcciones` de 10): estado tipado en `catalogos/actions.ts` para desactivar/activar (hoy `ActionState` crudo consumido con un tipo a mano en la tabla); hook con `pendienteId` por fila, guard de doble envío con ref síncrona (ignora una segunda acción sobre el mismo producto mientras la primera corre), toasts con el verbo de la acción, y la confirmación de "Desactivar producto" (hoy en la tabla, con `useConfirm`). `estaPendiente(id)` para el `⋮` de cada fila.
- La screen consume el hook: fuera el `run` con `fn` tipado a mano y el `isPending` global de `useTransition` dentro de la tabla.

### Copy (tarea 43 de 00)

| Acción | Botón | Toast |
|---|---|---|
| Crear | "Guardar producto" | "Producto creado" |
| Editar | "Actualizar producto" | "Producto actualizado" |
| Desactivar | "Desactivar" (confirm: "¿Desactivar «{nombre}»? No se podrá usar en nuevas compras.") | "Producto desactivado" |
| Activar | "Activar" | "Producto activado" |
| Config | "Guardar configuración" | "Configuración guardada" |

Errores con causa y solución, sin disculpas (los de hoy ya cumplen).

### Cambios en componentes compartidos

Ninguno previsto: `AppDataGrid`, `RowActionsMenu`, `colAcciones`, `AppDialog`, `EmptyState`, `StatusChips`-soft (la variante de chip `soft` la expone el theme) **solo se reusan**. Si al usarlos aparece un gap real, se anota en el checklist y en la tabla de `00-estandares-ui/spec.md`.

### Limpieza transversal (dentro de catálogos)

- `AddIcon` → `AddOutlined` (`catalogos-screen.tsx`).
- Patrón prohibido `startIcon={isPending ? <CircularProgress/>}` → `loading` nativo (`ProductoForm`, `ConfigNegocioForm`).
- Chips `variant="outlined"` sueltos en `ProductosTable` → `soft`.
- Switch "Mostrar inactivos" → chips en la URL.
- `GridToolbarQuickFilter`, `Menu/MenuItem` manual (no hay), `IconButton`s sueltos en filas → `⋮` con `pending` por fila.

## Fuera de alcance (MVP)

- Ficha de producto (el catálogo es lista + diálogo; no hay página `/catalogos/[id]`).
- CRUD de categorías (sigue siendo el select fijo `CATEGORIAS`).
- Paginación en servidor del listado: catálogo → `mode="client"` (00, "Tablas y paginación").
- Cambios de esquema, RLS, servicios de negocio o validaciones.
- Logo real (pendiente (g) de 00), exportar, historial de cambios de un producto.

## Dependencias y orden

- Depende de: `00-estandares-ui` Fase 2a (hecha), `04-inventario` (hecho), `10`/`11` (hechos — patrón y componentes base).
- Coordinación: otro agente puede estar trabajando en el mismo árbol (Fase 2b sigue con otras pantallas). Revisar `git status` antes de cada tarea y no editar archivos con cambios ajenos sin commitear.