# Checklist — 11-refactor-visual-proveedores

> Los ítems estáticos se marcan al cerrar la implementación (código + `npm run lint`, `npx tsc --noEmit` y `npm run build`). Los que requieren navegador quedan `[ ]` con "pendiente de verificación del usuario" (el ejecutor no tiene sesión en la app).

## Listado `/proveedores`
- [x] `ProveedoresTable` usa `AppDataGrid` en modo cliente: 25 filas por defecto, opciones 25/50/100, textos en español, página en `?pagina=`, `tableId="proveedores"`. *(verificado en código: `AppDataGrid tableId="proveedores" mode="client"`, defaults de `AppDataGrid`)*
- [x] Columnas como en `spec.md`: montos a la derecha y tabulares, método preferido enmascarado, chips `soft` con "Activo" visible, una sola columna de acciones con `RowActionsMenu`. *(verificado: `colMonto('saldo_pendiente')` con `valueGetter` del saldo real, `colAcciones`, `StatusChips mostrarActivo`)*
- [x] **Sin columnas muertas**: la columna "Saldo pendiente" muestra el saldo real por fila (el `valueGetter: () => '—'` y el `columnVisibilityModel` fijo que ocultaba las secundarias siempre, fuera). *(verificado: `page.tsx` trae `getSaldoPendiente` por proveedor; `hideOnMobile` solo para `xs`/`sm`)*
- [x] Columnas secundarias (teléfono, contacto, método preferido, saldo) visibles en `md+` y ocultas en `xs`/`sm` (`hideOnMobile`).
- [x] Búsqueda ignora acentos, mayúsculas, espacios, puntos y guiones ("v12345" encuentra "V-12.345"), en escritorio y en `xs`. *(verificado: `normalizeSearch={normalizarBusquedaSinSeparadores}`; mismo camino para grilla y tarjetas en `AppDataGrid`. Comportamiento en navegador pendiente del usuario)*
- [x] Filtros como chips (Activos / Bloqueados / Todos, con conteo), en `?estado=`; el Switch "Mostrar inactivos" ya no existe; volver desde la ficha conserva filtro y página. *(verificado: chips + `writeUrlParams({ estado, pagina: null })`; `FichaHeader`/`navigationOrigin` para la vuelta)*
- [x] `EmptyState` para "sin proveedores" (con "Nuevo proveedor"), sin resultados de búsqueda ("Limpiar búsqueda") y filtro vacío (con "Ver todos").
- [x] En `xs`: tarjetas `mobileCard` (nombre, RIF, chips solo informativos, saldo visible, menú `⋮` `medium`), `Fab` "Nuevo proveedor" que no tapa la última tarjeta, sin scroll horizontal. *(verificado en código: `mobileCard` con `amount` = saldo, `RowActionsMenu size="medium"`, `PageHeader primaryAction` (Fab en `xs`), `pb` en screen. Render pendiente del usuario)*
- [x] La fila con una acción en curso muestra su `⋮` deshabilitado con indicador; las demás siguen operables. *(verificado: `useProveedorAcciones` con `pendientes` por id, `colAcciones isPending`/`RowActionsMenu pending`)*

## Ficha `/proveedores/[id]`
- [x] La ficha recibe todo por props desde el servidor (`Promise.all`); `proveedor-ficha.tsx` **no importa `createClient`** ni repositorios; sin `as CompraCruda` ni `total_usd: subtotal_usd` (el historial muestra el total real de la compra). *(verificado: `rg "createClient"` solo en `page.tsx` con `@/lib/supabase/server`; el total real de una compra **es** `subtotal_usd` — no existe `total_usd` en la tabla `compras`; la query cruda con `as` fue reemplazada por mapeo tipado a `CompraFicha`)*
- [x] Existe `[id]/error.tsx`: un fallo de carga muestra `ErrorState` con "Reintentar" (`retry`), nunca secciones vacías ni estados "Cargando…" en texto.
- [x] `[id]/loading.tsx` usa `PageLoader variant="ficha"`.
- [x] `FichaHeader`: título `h5` (`component="h1"`), RIF copiable + tipo de persona + chips (sin "Activo"); "Editar proveedor" + `⋮` en `sm+`, solo `⋮` en `xs`; la vuelta conserva página y filtro del listado (`navigationOrigin`/`router.back()`). *(verificado en código; comportamiento con `?pagina` pendiente del usuario)*
- [x] Avisos de bloqueo y documentación con `maxWidth: 75ch` y botones con `loading`.
- [x] Secciones `FichaSeccion` (radio 8 + borde, sin sombra), dos columnas en `md+` y una en `xs`; datos con `FichaDatos`; representantes como lista separada por `Divider` (sin tabla MUI).
- [x] Métodos de pago con `CopyableText` en cada dato; cuenta completa en la ficha. *(el listado la sigue enmascarando con `enmascararCuenta`)*
- [x] Documentos: botón "Ver" normal con `aria-label` (no `LinkIcon` como enlace).
- [x] Saldo pendiente como cifra protagonista (`h5`, `formatUsd`, cifras tabulares), no un `body2` suelto. *(con conteo de compras abiertas cuando las hay)*
- [x] Historial de compras con `AppDataGrid` embebida (`searchable={false}`, `pageParam` propio (`pcompras`), `colFecha`/`colMonto`/`colEstado`, `mobileCard`, `EmptyState` compacto), sin tabla MUI con scroll horizontal.

## Diálogos y acciones
- [x] `ProveedorActionState` tipado como `ClienteActionState`; **sin `as never` ni `as any` en el módulo** (`proveedores-screen.tsx` sin `as never`, `MetodoPagoCard.tsx` sin `as any`/`eslint-disable`). *(verificado con `rg`)*
- [x] `useProveedorAcciones` con `pendienteId` por fila y guard de doble envío. *(ref síncrona `pendientesRef`; una segunda acción sobre el mismo proveedor se ignora)*
- [x] `ProveedorForm` es `AppDialog size="md"` con el pie del Stepper (Anterior / Siguiente / "Guardar y continuar" / Finalizar) conservado; pantalla completa + `Slide` en `xs`. *(pie por la prop `footer` de `AppDialog`, tarea 12)*
- [x] Todo botón de acción usa `loading` nativo; sin `CircularProgress` manual dentro de botones; `useForm({ disabled: isPending })` (campos no editables mientras guarda). *(el patrón `startIcon={<CircularProgress/>}` fue eliminado)*
- [x] `DocumentosRequeridos` acepta `disabled` y lo propaga a `DocumentoUpload` mientras guarda.
- [x] Navegación del Stepper intacta: `trigger(CAMPOS_POR_PASO)`, "Guardar y continuar" crea y avanza sin cerrar, `pasoInicial` ("Completar documentos" abre en el paso 3), `StepButton` libre en edición, `StepLabel error`, cerrar sucio pide "¿Descartar cambios?". *(verificado en código; el salto al paso del `fieldError` y el doble clic en navegador, pendientes del usuario)*
- [x] `BloqueoDialog` en proveedores: título "Bloquear a {nombre}" (patrón unificado con clientes). *(título conservado durante la transición de salida, como `useClienteAcciones`)*
- [x] Carga de representantes/documentos en edición fuera del navegador (por props). *(logrado completo: la ficha y el listado (`ProveedorResumen`) traen representantes y documentos del servidor y se los pasan al form por `datosEdicion`; sin `createClient` en el form. **Deuda**: `ClienteForm` sigue cargando representantes en el navegador (pendiente (e) de 00, clientes) — fuera del alcance de este módulo)*

## Form
- [x] Guard de doble envío en `onSubmit` (ref síncrona): doble clic rápido hace una sola escritura. *(verificado en código; clic real pendiente del usuario)*
- [x] Mientras guarda, el diálogo no se cierra (Esc, X, clic fuera) y "Cancelar" está deshabilitado. *(lo gestiona `AppDialog pending`)*
- [x] Persona jurídica sigue exigiendo representante; los errores del servidor (`fieldErrors`) siguen cayendo en su campo y el Stepper salta al paso que los tiene. *(validaciones intactas: `proveedorValidation.ts` sin cambios; `aplicarErroresDeServidor` + `safeParse` en `upsertProveedorAction` conservados)*

## Responsive / temas
- [ ] Revisado en 375 / 768 / 1024 / 1440 px y en claro/oscuro: listado, ficha (natural y jurídica), `ProveedorForm` (3 pasos) y bloqueo. *(pendiente de verificación del usuario)*
- [ ] Sin scroll horizontal en ninguna vista de proveedores. *(pendiente de verificación del usuario)*

## Limpieza transversal
- [x] Sin `DataGrid`, `Dialog` ni `Table` de MUI usados directamente en archivos de proveedores (grep en `proveedores/**`, `ProveedoresTable`, `ProveedorForm`). *(solo `import type { GridColDef }` en `proveedor-ficha.tsx`, igual que `ClientesTable`)*
- [x] Solo íconos `Outlined` (`AddOutlined` en screen y `MetodosPagoFieldArray`); sin `MoreVertIcon`/`ArrowBackIcon`/`AddIcon`/`LinkIcon` rellenos. *(verificado con `rg`)*
- [x] Sin timeouts numéricos en transiciones (solo `theme.transitions.duration.*`). *(verificado: `rg "timeout=\{[0-9]"` sin resultados; ficha usa `theme.transitions.duration.short` en el `Fade`)*
- [x] Copy: verbo del botón = verbo del toast ("Guardar proveedor"/"Proveedor guardado", "Actualizar proveedor"/"Proveedor actualizado", "Bloquear"/"Proveedor bloqueado", "Desbloquear"/"Proveedor desbloqueado", "Desactivar"/"Proveedor desactivado", "Activar"/"Proveedor activado"); sentence case; errores con causa y solución. *(recorrido de `actions.ts`, screen, ficha, form: coincide con la tabla de `spec.md`; "Siguiente" del alta no escribe, "Finalizar" cierra sin escribir)*
- [ ] Teclado y lectores de pantalla: foco visible, `aria-label` en íconos, filas abribles con Enter. *(Enter/foco los gestiona `AppDataGrid`; recorrido en navegador pendiente del usuario)*

## Integración y cierre
- [x] Clientes no cambió: `ClientesTable`, ficha de cliente, `ClienteForm` y `BloqueoDialog` siguen igual (si se extendió `AppDialog`, `ClienteForm` no se rompió). *(`AppDialog.footer` es opcional: sin ella el pie estándar es idéntico; `ClienteForm` no se tocó y compila)*
- [x] Tabla de "Componentes compartidos" de `00-estandares-ui/spec.md` y su `tasks.md` actualizados con lo tocado (`AppDialog.footer`, `DocumentosRequeridos.disabled`), con fecha y "11-refactor-visual-proveedores".
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores. *(build verificado de nuevo tras commitear 07-lotes: `EXIT=0`, rutas `/proveedores` y `/proveedores/[id]` compiladas)*
- [x] Ítems de `00-estandares-ui/checklist.md` cerrados para proveedores, anotados con "proveedores, 11-refactor-visual-proveedores". *(ver notas agregadas en ese archivo)*
- [x] `specs/README.md` actualizado (registro de cambio de alcance y orden). *(hecho por el planner, 2026-10-07)*

## Deuda y pendientes
- **(navegador)** Ítems `[ ]` de Responsive/temas y teclado: el ejecutor no tiene sesión en la app; los recorre el usuario (tareas 20–25 de `tasks.md`).
- **(00, pendiente (e) — clientes)** `ClienteForm` sigue cargando representantes desde el navegador al editar; en proveedores quedó resuelto por props y sirve de patrón para cerrarlo en clientes.