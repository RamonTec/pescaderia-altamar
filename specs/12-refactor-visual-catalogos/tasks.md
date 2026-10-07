# Tareas — 12-refactor-visual-catalogos

Depende de `00-estandares-ui` Fase 2a, `04-inventario` y `10`/`11` (todos hechos). Leer antes `spec.md` de este módulo y, de `00-estandares-ui/spec.md`, las secciones Tipografía, Responsive, Loaders, Botones, Tablas y paginación, Modales y el catálogo de componentes. El patrón está en clientes (10) y proveedores (11): mirar `ClientesTable`, `useClienteAcciones` y `ProveedorForm` antes de inventar.

Tras **cada** tarea: `npm run lint` y `npx tsc --noEmit`. Antes de cada tarea: `git status` (no editar archivos con cambios ajenos sin commitear).

## A. Acciones tipadas (la tabla y la pantalla las usan)

1. **`ProductoActionState` + `useProductoAcciones`**: tipar el estado de desactivar/activar en `catalogos/actions.ts` (patrón de `ClienteActionState` en `clientes/actions.ts`); crear `useProductoAcciones` (patrón de `useClienteAcciones`, sin diálogos de bloqueo): `pendienteId`/`estaPendiente(id)` por fila, guard de doble envío con ref síncrona, confirmación de "Desactivar producto" dentro del hook (con `useConfirm`), toasts con el verbo de la acción. Revisar el copy de las actions según la tabla de `spec.md`.
   - Hecho cuando: `ProductosTable` ya no tiene `useTransition`, `useConfirm`, `notify` ni el `run` con `fn` tipado a mano; `tsc` pasa sin `any`.
   - Archivos: `src/app/(protected)/catalogos/actions.ts`, nuevo `src/app/(protected)/catalogos/useProductoAcciones.ts`.

## B. Pantalla `/catalogos`

2. **Tabs en la URL**: "Productos" y "Configuración" (solo admin); el activo vive en `?tab=` (`configuracion`; sin parámetro = Productos), escrito con `history.replaceState` (sin recarga del servidor, como `?pagina=`). "Nuevo producto" (`primaryAction` de `PageHeader`) solo en el tab Productos y solo admin; en `xs` es `Fab` (lo hace `PageHeader`), y el listado deja espacio inferior (`pb`) para que no tape la última tarjeta. `AddIcon` → `AddOutlined`. En el tab Configuración no hay acción primaria.
   - Hecho cuando: navegar a otra sección y volver mantiene el tab; abrir `/catalogos?tab=configuracion` (admin) aterriza en la configuración.
   - Archivos: `src/app/(protected)/catalogos/catalogos-screen.tsx`.

## C. Listado de productos

3. **`ProductosTable` sobre `AppDataGrid`**: columnas de `spec.md` (Producto con "de {crudo}", Código, Tipo chip `soft`, Categoría `hideOnMobile`, Stock chip `soft` `hideOnMobile`, Estado chip `soft`, `colAcciones` + `RowActionsMenu pending={estaPendiente(row.id)}`). `tableId="productos"`, `mode="client"`, `normalizeSearch={normalizarBusquedaSinSeparadores}`, `getSearchValues` = nombre, código, categoría y nombre del crudo origen, `emptyState` "Aún no hay productos" + "Nuevo producto" (solo admin), búsqueda "Buscar por nombre, código o categoría". Quitar el `DataGrid` crudo, `GridToolbarQuickFilter`, los `IconButton` sueltos, los chips `outlined`, el `columnVisibilityModel` fijo (ocultaba Categoría siempre) y el renderizado condicional del `EmptyState` fuera de la tabla.
   - Hecho cuando: pageSize por defecto 25 y opciones `[25,50,100]`; "cur001" encuentra "CUR-001" en escritorio y `xs`; los chips de tipo/stock/estado son `soft` de 22 px; sin admin no hay columna de acciones ni botón en el estado vacío.
   - Archivos: `src/components/organisms/ProductosTable.tsx`, `catalogos-screen.tsx` (props).
4. **Filtro en chips y en la URL**: "Activos (n)" / "Todos (n)", exclusivos, en `filters` de `AppDataGrid`. Reemplaza el Switch "Mostrar inactivos". Valor en `?estado=todos` (sin parámetro = activos); al cambiar el filtro, la página vuelve a 1. Filtro sin filas → `EmptyState` "No hay productos inactivos" + "Ver activos".
   - Archivos: `ProductosTable.tsx`.
5. **`mobileCard`**: `primary` nombre, `secondary` código o "Sin código", chips solo informativos (Tipo / Inactivo), `RowActionsMenu` `medium`.
   - Archivos: `ProductosTable.tsx`.

## D. Diálogos

6. **`ProductoForm` → `AppDialog size="sm"`**: fuera `DialogTitle/Content/Actions` a mano y el `useMediaQuery`/`fullScreen` propio; `primaryAction` = `<Button type="submit" variant="contained" loading={isPending}>Guardar producto / Actualizar producto</Button>`; `useForm({ disabled: isPending })`; `pending` a `AppDialog` (bloquea cierre); `dirty` (lo gestiona `AppDialog`); `onSubmit` del diálogo como `<form>`; `error` del servidor en el `Alert` del `AppDialog` + `fieldErrors` mapeados a cada campo (como hoy); guard de doble envío con ref síncrona en el handler. Campos, regla "Se obtiene de" y manejo del trigger intactos.
   - Hecho cuando: doble clic rápido en "Guardar producto" crea un solo producto; mientras guarda, ningún campo es editable y el diálogo no cierra con Esc; cerrar con cambios sucios pide "¿Descartar cambios?".
   - Archivos: `src/components/organisms/ProductoForm.tsx`.
7. **`ConfigNegocioForm`**: `Button type="submit" loading={isPending}` (fuera el `startIcon={CircularProgress}`) y `useForm({ disabled: isPending })`. Sin tocar campos, secciones, vista previa ni la action.
   - Archivos: `src/components/organisms/ConfigNegocioForm.tsx`.

## E. Verificación

8. `npm run lint`, `npx tsc --noEmit`, `npm run build`.
9. Recorrer `/catalogos` (tab Productos y Configuración, con y sin productos, activo e inactivo, crudo y procesado con y sin origen) en 375 / 768 / 1024 / 1440 px y en claro/oscuro: sin scroll horizontal, `Fab` en `xs` (solo tab Productos), tarjetas en `xs`, form a pantalla completa en `xs`.
10. Tabs: navegar fuera y volver mantiene el tab activo; `?tab=configuracion` directo; un operador solo ve Productos.
11. Búsqueda: "cur001" y "CUR-001" encuentran lo mismo; "merluza" encuentra también el procesado "de merluza". Filtro y página se conservan al navegar fuera y volver.
12. Acciones: doble clic rápido en "Guardar producto" y en "Desactivar" hace una sola escritura; durante la acción el `⋮` de esa fila está deshabilitado con indicador y las demás siguen operables; el diálogo no se cierra con Esc mientras guarda; cerrar con cambios sucios pide confirmación.
13. Teclado: Tab llega a búsqueda, chips, filas y `⋮`; foco visible; `aria-label` en todos los íconos.
14. Cliente/proveedores no cambió: `ClientesTable`, ficha de cliente, `ProveedorForm` siguen igual.
15. Actualizar la tabla de "Componentes compartidos" de `00-estandares-ui/spec.md` solo si se tocó algún componente (con fecha y "12-refactor-visual-catalogos"); marcar `checklist.md` de este módulo y los ítems de `00-estandares-ui/checklist.md` que este módulo cierre para catálogos (con nota).