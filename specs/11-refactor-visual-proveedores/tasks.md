# Tareas — 11-refactor-visual-proveedores

Depende de `00-estandares-ui` Fase 2a, `03-proveedores` y `10-refactor-visual-clientes` (los tres hechos). Leer antes `spec.md` de este módulo y, de `00-estandares-ui/spec.md`, las secciones Tipografía, Responsive, Loaders, Botones, Tablas y paginación, Modales y el catálogo de componentes. El patrón de casi todo está implementado en clientes: mirar cómo lo hizo 10 antes de inventar.

Tras **cada** tarea: `npm run lint` y `npx tsc --noEmit`. Antes de cada tarea: `git status` (no editar archivos con cambios ajenos sin commitear).

## A. Acciones tipadas (el listado y la ficha las usan)

1. **`ProveedorActionState` + `useProveedorAcciones`**: en `src/app/(protected)/proveedores/actions.ts`, tipar el estado de las actions como `ClienteActionState` en `clientes/actions.ts` (sin `any`); crear `useProveedorAcciones` (patrón de `useClienteAcciones` de 10): `pendienteId` por fila, guard de doble envío con ref síncrona, toasts con el verbo de la acción. Revisar el copy de las actions según la tabla de `spec.md`.
   - Hecho cuando: `proveedores-screen.tsx` ya no tiene `as never` ni `[, startTransition]`; `tsc` pasa sin `any`.
   - Archivos: `src/app/(protected)/proveedores/actions.ts`, nuevo `src/app/(protected)/proveedores/useProveedorAcciones.ts` (o donde viva el de clientes), `proveedores-screen.tsx`.

## B. Listado `/proveedores`

2. **`ProveedoresTable` sobre `AppDataGrid`**: columnas de `spec.md` (Proveedor, Teléfono, Contacto, Método de pago preferido enmascarado, Saldo pendiente con `colMonto` y **datos reales** que llegan por props, Estado con `StatusChips mostrarActivo`, acciones con `colAcciones` + `RowActionsMenu pending={pendienteId === row.id}`). `tableId="proveedores"`, `mode="client"`, `normalizeSearch={normalizarBusquedaSinSeparadores}`, `getRowHref`, `emptyState` "Aún no hay proveedores" + "Nuevo proveedor", búsqueda "Buscar por nombre, RIF o contacto", secundarias con `hideOnMobile`. Quitar `DataGrid` crudo, `GridToolbarQuickFilter`, el `Menu/MenuItem` manual, el ítem "Ver ficha", el `columnVisibilityModel` fijo (bug: ocultaba secundarias siempre) y la columna muerta `valueGetter: () => '—'`.
   - Hecho cuando: pageSize por defecto 25 y opciones `[25,50,100]`; buscar "v12345" encuentra "V-12.345"; clic o Enter en la fila abre la ficha.
   - Archivos: `src/components/organisms/ProveedoresTable.tsx`, `src/app/(protected)/proveedores/page.tsx` (pasa el saldo por fila, con `Promise.all` si hace falta), `proveedores-screen.tsx`.
3. **Filtro en chips y en la URL**: "Activos (n)" / "Bloqueados (n)" / "Todos (n)", exclusivos, en `filters` de `AppDataGrid`. Reemplaza el Switch "Mostrar inactivos". Valor en `?estado=` (sin parámetro = activos), escrito con `history.replaceState`; al cambiar el filtro, la página vuelve a 1. Filtro sin filas → `EmptyState` con mensaje del filtro + "Ver todos".
   - Archivos: `ProveedoresTable.tsx` (o donde `AppDataGrid` reciba `filters`), `proveedores-screen.tsx`.
4. **`mobileCard`**: `primary` nombre, `secondary` RIF, chips solo si hay Bloqueado/Inactivo/Doc. incompleta, saldo visible en la tarjeta, `RowActionsMenu` `medium`.
   - Archivos: `ProveedoresTable.tsx`.
5. **`proveedores-screen.tsx`**: `PageHeader` con `primaryAction` "Nuevo proveedor" (`AddOutlined`) en lugar de `children`; espacio inferior (`pb`) en `xs` para el `Fab`. `loading.tsx` del listado ya es `PageLoader variant="table"`: ajustar solo si la diferencia con la tabla final salta a la vista.
   - Archivos: `proveedores-screen.tsx`.

## C. Ficha `/proveedores/[id]`

6. **Carga en el servidor**: `[id]/page.tsx` pide con `Promise.all` (proveedor, saldo, representantes, métodos de pago, documentos, compras con su **total real** — no `subtotal_usd`) vía los servicios/repos existentes; pasa todo por props. `proveedor-ficha.tsx` deja de importar `createClient` y repos browser, pierde los estados `loading` en texto y el `as CompraCruda`. Tipar la compra embebida con `src/types/domain.ts` (o el type que ya use `compraService`).
   - Hecho cuando: `rg "createClient" src/app/(protected)/proveedores` no devuelve nada.
   - Archivos: `src/app/(protected)/proveedores/[id]/page.tsx`, `proveedor-ficha.tsx`, `src/types/domain.ts` si falta el tipo.
7. **`[id]/error.tsx`** (nuevo): `ErrorState` "No se pudo cargar la ficha del proveedor." + "Reintentar" (usar `retry` como hizo 10, ver su checklist). **`[id]/loading.tsx`**: `PageLoader variant="ficha"` (hoy `form`).
   - Archivos: `src/app/(protected)/proveedores/[id]/error.tsx`, `src/app/(protected)/proveedores/[id]/loading.tsx`.
8. **Encabezado con `FichaHeader`**: `backHref="/proveedores"`, `backLabel="Proveedores"`, vuelta con `router.back()` vía `navigationOrigin` (conserva `?pagina` y `?estado`), título `h5` con `overflowWrap`, `meta` con `CopyableText` del RIF + tipo de persona + `StatusChips` (sin "Activo"), `primaryAction` "Editar proveedor", `menuActions` Bloquear/Desbloquear (admin) y Desactivar/Activar, `pending={pendienteId === proveedor.id}`. Quitar `PageHeader` + `Avatar`, `ArrowBackIcon` relleno y el `Menu` manual.
   - Archivos: `proveedor-ficha.tsx`.
9. **Avisos y secciones**: `Alert` de bloqueo/documentación con `maxWidth: '75ch'` y botones con `loading`. `Seccion` local → `FichaSeccion`; `Fila/FilaDetalle` → `FichaDatos`; representantes como lista separada por `Divider` (no tabla); métodos de pago con `CopyableText` en cada dato (cuenta completa); documentos con botón "Ver" normal + `aria-label` (no `LinkIcon`); `Fade` con `theme.transitions.duration.short`.
   - Archivos: `proveedor-ficha.tsx`.
10. **Saldo pendiente como cifra protagonista**: `variant="h5"` con `formatUsd` + cifras tabulares, indicación de compras abiertas si el servicio la da; fuera el `body2` suelto.
    - Archivos: `proveedor-ficha.tsx`.
11. **Historial de compras con `AppDataGrid` embebida**: `searchable={false}`, `pageParam="pcompras"`, `colFecha`, `colMonto` con el total real, `colEstado`, `mobileCard`, `EmptyState` compacto "Aún no hay compras". Fuera la tabla `Table` de MUI (scroll horizontal en `xs`, sin paginación).
    - Archivos: `proveedor-ficha.tsx`.

## D. Form (alta/edición)

12. **`AppDialog` — pie custom si hace falta** (solo si el pie del Stepper no entra en `primaryAction`): prop de pie custom (p. ej. `footer?: ReactNode`), sin romper `ClienteForm` ni los diálogos existentes. Anotar la prop en `00-estandares-ui` (tabla de componentes + tasks.md).
    - Archivos: `src/components/organisms/AppDialog.tsx` (solo si aplica), `specs/00-estandares-ui/spec.md`, `specs/00-estandares-ui/tasks.md`.
13. **`ProveedorForm` → `AppDialog size="md"`**: fuera `DialogTitle/Content/Actions` a mano; pie de navegación del Stepper (Anterior / Siguiente / "Guardar y continuar" / Finalizar) conservado, en `primaryAction`/`secondaryActions` o en la prop de pie custom de la tarea 12. Todos los botones con `loading` nativo (fuera `disabled={isPending}` sueltos y el `startIcon={<CircularProgress/>}`); `useForm({ disabled: isPending })` (campos no editables mientras guarda); guard de doble envío en `onSubmit` (ref síncrona); `pending` a `AppDialog` (no se cierra mientras guarda); `dirty` mantiene el ConfirmDialog "¿Descartar cambios?"; timeouts → tokens del theme. Navegación del Stepper **intacta**: `trigger(CAMPOS_POR_PASO)`, "Guardar y continuar", `pasoInicial`, `StepButton` libre en edición, `StepLabel error`.
    - Hecho cuando: doble clic rápido en "Guardar y continuar" crea un solo proveedor; mientras guarda, ningún campo es editable y el diálogo no cierra con Esc.
    - Archivos: `src/components/organisms/ProveedorForm.tsx`.
14. **`DocumentosRequeridos` con `disabled`**: prop que propaga a cada `DocumentoUpload` (que ya tiene `disabled`); `ProveedorForm` la pasa con `isPending`.
    - Archivos: `src/components/molecules/DocumentosRequeridos.tsx`, `ProveedorForm.tsx`.
15. **Carga de representantes/documentos en edición fuera del navegador**: pasar los datos por props desde la ficha/pantalla que abre el form (la ficha ya los tiene tras la tarea 6). Si no se logra sin romper el flujo "Nuevo proveedor" (que no tiene datos previos), como mínimo: tipar el resultado (sin `as` crudos), capturar el error con `notify.error` con causa y solución, y anotarlo como deuda en `checklist.md` (pendiente (e) de 00, igual que clientes).
    - Archivos: `ProveedorForm.tsx`, `proveedores-screen.tsx`, `proveedor-ficha.tsx`.
16. **`BloqueoDialog` en proveedores**: solo copy — título "Bloquear a {nombre}" (hoy "Bloquear proveedor: {nombre}"), igual que clientes. El componente ya está migrado por 10; no tocar su interfaz.
    - Archivos: quien invoque `BloqueoDialog` en `proveedores-screen.tsx` / `proveedor-ficha.tsx`.

## E. Limpieza transversal (dentro de proveedores)

17. **Íconos y `any`**: `AddIcon` → `AddOutlined` en `MetodosPagoFieldArray.tsx` (la screen ya se cambió en la tarea 5); tipar el error del `FieldArray` en `MetodoPagoCard.tsx` (fuera `eslint-disable no-explicit-any` + `as any`, con el genérico del `useFieldArray` o los types del schema); `LinkIcon` fuera (tarea 9); timeouts numéricos de `MetodosPagoFieldArray.tsx`, `MetodoPagoCard.tsx` y `ProveedorIdentificacionFields.tsx` → `theme.transitions.duration.*`.
    - Hecho cuando: `rg "as any|no-explicit-any" src/components/molecules/MetodoPagoCard.tsx` no devuelve nada; `rg "timeout=\{[0-9]" src/app/(protected)/proveedores src/components/organisms/ProveedorForm.tsx src/components/molecules/Metodo*` tampoco.
    - Archivos: `src/components/molecules/MetodosPagoFieldArray.tsx`, `MetodoPagoCard.tsx`, `ProveedorIdentificacionFields.tsx`.
18. **Copy final**: recorrer botones y toasts del módulo contra la tabla de copy de `spec.md` (verbo del botón = verbo del toast; sentence case; errores con causa y solución).
    - Archivos: `proveedores/actions.ts`, `proveedores-screen.tsx`, `proveedor-ficha.tsx`, `ProveedorForm.tsx`.

## F. Verificación

19. `npm run lint`, `npx tsc --noEmit`, `npm run build`.
20. Recorrer `/proveedores` y una ficha (natural y jurídica, bloqueado e inactivo, con y sin compras) en 375 / 768 / 1024 / 1440 px y en claro/oscuro: sin scroll horizontal, `Fab` en `xs`, tarjetas en `xs`, `FichaHeader` con `⋮` en `xs`, form a pantalla completa en `xs`.
21. Búsqueda: "v12345", "MARÍA" y "maría" encuentran lo esperado (escritorio y `xs`). Filtro y página se conservan al ir a la ficha y volver.
22. Acciones: doble clic rápido en "Bloquear" y en "Guardar y continuar" hace una sola escritura; durante la acción el `⋮` de esa fila está deshabilitado con indicador y las demás siguen operables; el diálogo no se cierra con Esc mientras guarda; cerrar con cambios sucios pide "¿Descartar cambios?".
23. Teclado: Tab llega a búsqueda, chips, filas y `⋮`; Enter en una fila abre la ficha; foco visible; `aria-label` en todos los íconos.
24. Simular un fallo de carga de la ficha y ver `ErrorState` con "Reintentar" (nunca secciones vacías).
25. Clientes no cambió: `ClientesTable`, ficha de cliente y `ClienteForm` siguen igual (si se tocó `AppDialog`, el pie de `ClienteForm` no cambió).
26. Actualizar la tabla de "Componentes compartidos" de `00-estandares-ui/spec.md` y su `tasks.md` con lo que este módulo haya tocado (prop de `AppDialog`, `DocumentosRequeridos.disabled`), con fecha y "11-refactor-visual-proveedores".
27. Marcar `checklist.md` de este módulo y los ítems de `00-estandares-ui/checklist.md` que este módulo cierre para proveedores (con nota "proveedores, 11-refactor-visual-proveedores").