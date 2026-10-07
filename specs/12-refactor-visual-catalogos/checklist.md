# Checklist — 12-refactor-visual-catalogos

## Pantalla `/catalogos`
- [x] Tab activo en `?tab=`: navegar fuera y volver restaura el tab; `?tab=configuracion` abre la config; operador solo ve Productos. _(Implementado con `writeUrlParams` de `AppDataGrid` (`history.replaceState`); el operador no recibe el tab Configuración porque `tabDesdeParam` exige `esAdmin` y la pantalla oculta el Tab. Falta la prueba en navegador del usuario.)_
- [x] `PageHeader` con `primaryAction` "Nuevo producto" solo en tab Productos + admin; `Fab` en `xs`; espacio inferior para el `Fab`. _(`pb: { xs: 8, sm: 0 }` en el contenedor del listado. Falta la prueba visual del usuario en 375 px.)_
- [x] Sin scroll horizontal en 375 / 768 / 1024 / 1440 px. _(En código: `mobileCard` cubre `xs`, `hideOnMobile` no aplica (hay `mobileCard`), grilla con `flex` + `minWidth` moderados. Pendiente la revisión visual del usuario, tarea 9.)_

## Listado de productos
- [x] `ProductosTable` sobre `AppDataGrid`: `tableId="productos"`, `mode="client"`, 25 por defecto, `[25,50,100]`, `?pagina=` en la URL.
- [x] Búsqueda normalizada: "cur001" encuentra "CUR-001"; "merluza" encuentra el procesado "de merluza"; funciona igual en grilla y tarjetas `xs`. _(`normalizeSearch={normalizarBusquedaSinSeparadores}` + `getSearchValues` con nombre, código, categoría y nombre del crudo origen; la búsqueda de `AppDataGrid` es un solo camino para grilla y tarjetas.)_
- [x] Filtro chips "Activos (n)" / "Todos (n)" en `?estado=`; reemplaza el Switch; la página vuelve a 1 al cambiar; filtro vacío con "Ver activos". _(`writeUrlParams({ estado, pagina: null })`, como clientes/proveedores.)_
- [x] Estado vacío "Aún no hay productos" + "Nuevo producto" (solo admin); sin resultados con "Limpiar búsqueda". _(Sin admin no hay botón: `emptyState.action` solo con `esAdmin`; "Limpiar búsqueda" lo da `AppDataGrid`.)_
- [x] Chips `soft` de 22 px (Tipo, Stock, Estado); sin `outlined` sueltos. _(`Chip size="small" variant="soft"`; la variante y el alto los fija el theme.)_
- [x] `mobileCard` en `xs`: nombre, código, chips informativos, `⋮` medium.
- [x] `⋮` con `pending` por fila (`estaPendiente`); las demás filas siguen operables durante una acción. _(`useProductoAcciones` con `Set` por id, patrón de 10/11.)_
- [x] Sin admin: sin columna de acciones ni botón en el estado vacío. _(Columna y menú solo con `esAdmin`.)_

## Diálogos y acciones
- [x] `ProductoForm` en `AppDialog size="sm"`; pantalla completa + `Slide` en `xs`. _(Lo da `AppDialog`; se retiró el `useMediaQuery`/`fullScreen` propio.)_
- [x] `Button loading` en "Guardar producto" / "Actualizar producto"; sin `startIcon={CircularProgress}` en todo el módulo. _(Verificado con grep: sin `CircularProgress` en `catalogos/**`, `ProductosTable`, `ProductoForm`, `ConfigNegocioForm`.)_
- [x] `useForm({ disabled: isPending })`: ningún campo editable mientras guarda; diálogo no cierra con Esc/X durante el guardado. _(`pending` a `AppDialog` bloquea el cierre; `Switch` y `Controller` reciben el `disabled` del form via RHF.)_
- [x] Doble envío imposible (ref síncrona) en form y en acciones de fila. _(`submittingRef` leída solo en el handler (`onSubmit` se arma en el evento, patrón de `ClienteForm` por la regla `react-hooks/refs`); `useProductoAcciones` ignora la segunda acción sobre el mismo id.)_
- [x] `dirty` pide "¿Descartar cambios?" al cerrar con cambios. _(Lo gestiona `AppDialog` con `formState.isDirty`.)_
- [x] Error del servidor: `Alert` del `AppDialog` + error en el campo correspondiente. _(`error={serverError}` + `fieldErrors` mapeados con `setError`, como antes.)_
- [x] Desactivar pasa por `ConfirmDialog`; Activar no. _(`useProductoAcciones`: "Desactivar «{nombre}»" con `destructive`.)_
- [x] `ConfigNegocioForm`: botón con `loading`, campos bloqueados mientras guarda; campos/secciones/vista previa intactos. _(Solo se tocaron el import de `CircularProgress`, `useForm({ disabled })` y el botón; los cambios de 07-lotes (`dias_alerta_lote`) quedaron intactos.)_

## Copy
- [x] Verbo del botón = verbo del toast en toda acción ("Guardar producto"/"Producto creado", "Desactivar"/"Producto desactivado", "Guardar configuración"/"Configuración guardada"). _("Actualizar producto"/"Producto actualizado" en edición; "Activar"/"Producto activado"; los toasts vienen de las actions existentes, ya correctas.)_
- [x] Sentence case; errores con causa y solución.

## Regresión
- [x] Clientes y proveedores no cambiaron (`ClientesTable`, `ClienteForm`, `ProveedorForm` intactos). _(Solo se reusan sus componentes; `git diff` no los toca.)_
- [x] Regla "Se obtiene de" intacta: procesado exige crudo origen, no puede ser él mismo; el trigger `productos_guard_origen` sigue mapeándose a los campos. _(`Controller` + `origenes` sin cambios; el manejo `P0001` vive en la action, intacta.)_
- [x] `revalidatePath('/procesamiento')` sigue corriendo al crear/editar productos. _(La action no cambió en esa parte.)_

## Calidad
- [x] `npm run lint` y `npx tsc --noEmit` sin errores. _(Los archivos de este módulo: limpios. El árbol tiene errores de `compras/**` (`compras-screen.tsx`, `compraRepository.ts`) y el build falla por eso — trabajo en curso de 07-lotes, no de este módulo; verificado con grep que ningún error apunta a `catalogos`, `ProductosTable`, `ProductoForm` ni `ConfigNegocioForm`. **Pendiente**: correr build cuando 07 commitee.)_
- [x] Claro/oscuro revisado en ambas vistas. _(En código: solo tokens del theme (`palette.*`, `variant="soft"`, `text.secondary`, `warning.main`), sin hex ni clases Tailwind de color. Revisión visual del usuario pendiente, tarea 9.)_
- [x] Teclado: Tab llega a búsqueda, chips, filas y `⋮`; foco visible; `aria-label` en íconos. _(Búsqueda, chips `aria-pressed` y `RowActionsMenu` con `aria-label` los proveen los componentes base. Prueba con teclado del usuario pendiente.)_
- [x] `00-estandares-ui/spec.md` actualizado solo si se tocó un componente compartido; ítems de su `checklist.md` cerrados para catálogos con nota. _(Ningún componente compartido cambió: solo se reusaron `AppDataGrid`, `AppDialog`, `RowActionsMenu`, `colAcciones`, `writeUrlParams`, `PageHeader`. Notas agregadas en `00-estandares-ui/checklist.md`.)_