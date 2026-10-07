# Tareas — 00-estandares-ui

No depende de otro módulo. Se ejecuta primero (o en paralelo muy temprano con `01-auth`, ya que el login también debe quedar construido con estos estándares).

## Theme y modo oscuro

1. **Instalar `@mui/material-nextjs`** — DECIDIDO: no se instaló. Se mantuvo el `ThemeRegistry` custom (CacheProvider + useServerInsertedHTML) y se usó `InitColorSchemeScript` directamente desde `@mui/material` (`import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'`), que ya trae la integración con App Router. Motivo: evitar dependencia nueva y el provider manual ya funciona con SSR. Documentado 2026-10-06.
2. **`src/theme/theme.ts`**: reemplazar `palette: {...}` por `colorSchemes: { light: { palette: {...} }, dark: { palette: {...} } }`, manteniendo `cssVariables: true`. Definir paleta oscura con `background.default`/`background.paper` oscuros reales y los mismos `primary`/`secondary`/`success`/`warning`/`error` ajustados si el contraste AA no se cumple sobre fondo oscuro (verificar con una herramienta de contraste, no a ojo).
3. **`src/theme/ThemeRegistry.tsx`**: agregar `InitColorSchemeScript` antes del render para evitar flash of wrong theme en el primer load.
4. **`src/components/atoms/ColorModeToggle.tsx`**: usa `useColorScheme()` de MUI, ciclo `light → dark → system`, ícono acorde (`LightModeIcon`/`DarkModeIcon`/`SettingsBrightnessIcon`).
5. **Insertar `ColorModeToggle` en `AppShell.tsx`** (dentro del `AppBar`, a la derecha).

## Responsive

6. **`AppShell.tsx`**: agregar estado `mobileOpen` + `IconButton`/`MenuIcon` en el `AppBar` (visible solo `xs`/`sm`), `Drawer` pasa a `variant={isDesktop ? 'permanent' : 'temporary'}` usando `useMediaQuery(theme.breakpoints.up('md'))`.
   - Hecho cuando: en viewport `<900px` el drawer no está montado permanentemente, se abre con el botón de menú y se cierra al navegar o tocar fuera.

## Utilidades compartidas

7. **`src/lib/format.ts`**: `formatUsd`, `formatBs`, `formatKg`, `formatTasa` (usar `Intl.NumberFormat` con locale `es-VE` donde aplique, o formateo manual si `es-VE` no da el resultado exacto esperado — verificar con un caso real antes de asumir).
8. **`src/components/atoms/NumberField.tsx`**: envuelve `TextField` de MUI, props `decimals`, `prefix`/`suffix` (ej. `$`, `kg`), maneja el parseo a `number` para el form sin perder el formato visual mientras se escribe.

## Loaders y estados

9. **`src/components/atoms/PageLoader.tsx`**: variante `table` (filas de `Skeleton`) y variante `form` (bloques de `Skeleton` simulando campos) — recibe una prop `variant` para reusar en distintos `loading.tsx`.
10. **`src/components/molecules/EmptyState.tsx`**: props `icon`, `title`, `description?`, `action?` (botón opcional).
11. **`src/components/molecules/ErrorState.tsx`**: props `message`, `onRetry?`.
12. **`src/components/molecules/ConfirmDialog.tsx`** + **`src/lib/useConfirm.tsx`** (hook/contexto que renderiza el diálogo y retorna una promesa `confirm(options): Promise<boolean>`).

## Notificaciones

13. **`src/components/organisms/NotificationProvider.tsx`**: contexto + `Snackbar` de MUI, con cola si hay más de una notificación en simultáneo (usar el patrón de cola recomendado en la documentación de MUI para `Snackbar`, no mostrar dos superpuestos).
14. **`src/lib/useNotify.ts`**: hook que consume el contexto anterior, expone `notify.success/error/info`.
15. **Envolver el árbol en `src/app/layout.tsx`** con `NotificationProvider` (dentro de `ThemeRegistry`, para que los toasts respeten el theme).

## Formularios

16. **Instalar `react-hook-form`, `zod`, `@hookform/resolvers`**.
17. **`src/components/molecules/PageHeader.tsx`**: título (`h4`) + `children` para acciones (botones a la derecha), usado como encabezado estándar de toda página de listado.

## Validación de formularios (ya en uso, formalizar para los módulos siguientes)

21. **No crear `useAppForm`/`schemas/` nuevos** — el patrón ya vigente (`src/lib/clienteValidation.ts`: un archivo `<entidad>Validation.ts` con regex + esquema `zod` + tipo inferido, `mode: 'onSubmit'` en `useForm`) es el estándar. Esta tarea es solo dejarlo escrito en `spec.md` (ya hecho) para que `03-proveedores` lo siga sin tener que inferirlo del código.
22. **`src/lib/validationMessages.ts`**: crear **solo cuando** un segundo módulo repita un mensaje literal ya usado en `clienteValidation.ts` (ej. `proveedorValidation.ts` necesitará el mismo mensaje de RIF inválido) — en ese momento, extraer esos mensajes puntuales, no todos, y actualizar `clienteValidation.ts` para usarlos también.

## Validación en Server Actions (gap a corregir)

23. **Agregar a `02-clientes` (retroactivo)**: en `src/app/(protected)/clientes/actions.ts`, después de `JSON.parse(raw)`, correr `clienteFormSchema.safeParse(input)` y devolver el error estructurado si falla, antes de llamar a `clienteService`/`clienteRepository`. Hoy ese archivo valida el JSON pero no el esquema de negocio — queda expuesto a datos inválidos si algo llama la action sin pasar por `ClienteForm.tsx`.
24. **Regla para todos los módulos siguientes** (`03-proveedores` en adelante): ninguna Server Action que reciba datos de formulario se considera completa sin su `safeParse` correspondiente al inicio. Se verifica en el checklist de cada módulo, no solo aquí.

## Transiciones (nuevo estándar, revisar si ya se montó algo que lo contradiga)

25. **`src/app/layout.tsx` o `ThemeRegistry.tsx`**: agregar transición corta (`background-color`, `color`) a nivel global (`body` o el elemento que `CssBaseline` estiliza) usando `theme.transitions.create([...], { duration: theme.transitions.duration.short })`, para que alternar `ColorModeToggle` no sea un corte brusco. Verificar que no quede ya resuelto de otra forma antes de duplicar.
26. **Revisar formularios dinámicos existentes** (`RepresentantesLegalesFieldArray.tsx` en `02-clientes`, que usa `useFieldArray`): envolver cada fila en `Collapse` si hoy aparece/desaparece de golpe al agregar/quitar un representante. Si ya se ve bien, anotar aquí que se revisó y no hizo falta cambio.

## Verificación

18. Alternar manualmente entre claro/oscuro/sistema en al menos dos pantallas existentes (`/` y `/catalogos` aunque sigan siendo placeholders) y confirmar que no hay texto illegible ni fondos que no cambian.
19. Reducir el viewport a 375px de ancho sobre `AppShell` y confirmar que el drawer se oculta y aparece el botón de menú.
20. Documentar en este archivo (al pie) cualquier componente nuevo agregado después de esta primera pasada, para mantener la tabla de "Componentes compartidos" del `spec.md` actualizada.
27. Alternar `ColorModeToggle` y confirmar que el cambio de fondo/texto se ve como una transición corta, no un corte instantáneo.
28. Confirmar (leyendo el código, no solo probando la UI) que `clientes/actions.ts` corre `clienteFormSchema.safeParse` antes de escribir — si no, es la tarea 23 pendiente.

## Fase 2 — Acabado visual (planificada el 2026-10-07)

Pedido del usuario: el apartado visual es básico y le falta acabado. Se definieron estándares de loaders con logo, botones en carga, paginación, tablas, modales, responsive y tipografía (ver las secciones correspondientes de `spec.md`). Esta fase construye la base y migra las pantallas existentes. **Las pantallas nuevas de `07`, `08` y `09` nacen directamente con estos componentes**, así que conviene hacer al menos la Fase 2a antes que esos módulos.

**Coordinación**: otro agente puede estar trabajando en `08-tasas` sobre el mismo árbol. La migración de pantallas (Fase 2b) toca muchos organisms: revisar `git status` antes de cada tarea y no editar archivos con cambios ajenos sin commitear.

### Fase 2a — Base (bloquea al resto)

29. **Logo**: pedir al usuario el archivo del logo de Altamar (SVG; idealmente también versión monocroma). Mientras tanto, `atoms/BrandMark.tsx` con isotipo provisional en SVG (proa de peñero + franjas, tokens `brand.*`), props `size` y `variant: 'full' | 'isotipo'`. Al recibir el logo: reemplazar dentro de `BrandMark`, generar `src/app/icon.svg`/`apple-icon.png` (verificar la convención de íconos en `node_modules/next/dist/docs/`) y borrar los SVG de ejemplo de `public/`.
   - **Ejecución 2026-10-07**: `atoms/BrandMark.tsx` con el isotipo provisional de la muestra (proa + franjas, colores de `palette.brand.*` vía `theme.vars`), props `variant`, `size` (ancho; alto 64:40), `orientation` (`horizontal` menú / `vertical` loader) y `title`. Ícono de la app: `src/app/icon.svg` (convención `icon.svg` de Next 16; copia estática del isotipo con los hex de la paleta clara, sobre fondo hielo). **Pendiente** hasta tener el logo real: reemplazar dentro de `BrandMark` y en `icon.svg`, generar `apple-icon.png`, borrar `src/app/favicon.ico` (es el de Next; hoy convive con `icon.svg`) y los SVG de ejemplo de `public/`.
30. **Tipografía**: verificar si Barlow trae cifras tabulares (`tnum`). Decidir y aplicar: Barlow tabular para montos (y retirar Geist Mono de `layout.tsx` y de los `MONO` repetidos en tablas) o Geist Mono solo para montos en columnas. Ajustar `theme.ts` a la escala de `spec.md` (`h4` responsive, `caption` 12,5 px, `button`), y quitar `overline` y las mayúsculas donde existan.
   - **Ejecución 2026-10-07 — decisión**: Barlow **sí** trae cifras tabulares. Se revisaron los `.woff2` que `next/font` descarga en `.next/static/media` (tabla GSUB): el subset `latin` de Barlow 400/500/600 y Barlow Condensed 500/600 declara `tnum` (además de `pnum`, `frac`, `numr`/`dnom`). Por eso **se retiró Geist Mono**: fuera de `layout.tsx`, y los `MONO` de `ClientesTable`, `ComprasTable`, `ProcesamientosTable`, `NotasCreditoTable`, `FacturasAbiertasTable`, `NotaCreditoForm`, `ProcesamientoForm`, `CreditoResumen`, `CompraItemsFieldArray`, `PedidoItemsFieldArray`, `CopyableText` y la ficha de cliente pasaron a `NUM = { fontVariantNumeric: 'tabular-nums' }` (el theme ya aplica `tabular-nums` en `TableCell` y `DataGrid`). **Compat temporal**: `CompraForm`, `RegistrarPagoDialog`, `PagoProveedorDialog` y `PedidoForm` tienen cambios de 08-tasas sin commitear y siguen usando `var(--font-geist-mono)`; `globals.css` define esa variable como alias de `--font-body` hasta migrarlos (Fase 2b). Escala de `spec.md` aplicada en `theme.ts`: `h4` 34/28 px, `subtitle1`, `body1`, `body2`, `caption` 12,5 px, `button` 14,5 px; `overline` sin mayúsculas. No había usos de `overline` ni `uppercase` en `src/`.
31. **Theme**: locale `esES` de DataGrid en `createTheme`; radios por jerarquía (4 / 6 / 8 / 12); `MuiPaper` con `elevation` 0 + borde por defecto en superficies en reposo; set de íconos `Outlined` (reemplazar los rellenos en `AppShell` y menús).
   - **Ejecución 2026-10-07**: `createTheme(opciones, esES de @mui/x-data-grid/locales, esES de @mui/material/locale)`. Radios: chip 4, `shape` 6 (input/botón), `MuiPaper.rounded` 8 (tarjetas, tablas, menús, popovers), tooltip 8, diálogo 12 (0 en pantalla completa), `Fab` 12. `MuiPaper` con `elevation: 0` por defecto y borde `divider` cuando la elevación es 0 (lo que flota pasa su propia elevación: menú/popover 8, drawer temporal 16, diálogo 24); se anula el borde en `Alert` (standard/filled), en el drawer fijo (solo borde derecho) y en el listado de `Autocomplete` (sombra 8). Variante nueva `Chip variant="soft"` (fondo tenue + texto `dark`/`light` según esquema) para estados. Íconos `Outlined`: todo `AppShell`, `ColorModeToggle`, `PasswordField`, `CopyableText`, `DocumentoUpload` y los `Block` de los menús de `ClientesTable`, `ProveedoresTable`, `ProductosTable` y la ficha de cliente. Quedan glifos sin relleno (`Add`, `MoreVert`, `ArrowBack`, `Close`, `Search`) importados sin sufijo en pantallas existentes: se ven igual; se unifican en la Fase 2b.
32. **Shell persistente**: crear `src/app/(protected)/layout.tsx` con `AppShell`, quitar `<AppShell>` de las 14 páginas, y pasar sesión y rol desde el servidor (eliminar el `getSession` + consulta de `perfiles` en el `useEffect` de `AppShell`). Menú: permanente en `md+` (248 px), riel de 72 px en `sm`, temporal en `xs`; ítem activo con el marcador de las franjas.
   - **Ejecución 2026-10-07**: `(protected)/layout.tsx` resuelve el usuario con `getUsuarioActual()` (nuevo en `authService`, `cache` de React: una lectura de `auth.getUser()` + `perfiles` por request; `getRol`/`requireAdmin` ahora la reusan) y renderiza `AppShell` con `usuario` por props. Se eliminó el `useEffect` de sesión. Layout como la muestra: menú a la izquierda a toda la altura (permanente 248 px en `md+`, riel 72 px con tooltips en `sm`, temporal en `xs` con botón en la barra), barra superior de 64 px (56 en `xs`) con `topBarStart`, modo y menú de cuenta (perfil y cerrar sesión), contenido de máx. 1440 px con márgenes 16/24/32. Ítem activo con las franjas a la izquierda. Se agregó `(protected)/loading.tsx` como respaldo para inicio, perfil, usuarios e inventario. Los `loading.tsx` existentes ya no incluían el shell. Menú renombrado a sentence case ("Inicio", "Cobros y pagos").
   - **Pendiente (bloqueado por 08-tasas)**: `cobros/page.tsx`, `compras/page.tsx` y `pedidos/page.tsx` tienen cambios sin commitear del otro agente y siguen envolviéndose en `<AppShell>`. **Compat temporal**: `AppShell` detecta por contexto si ya está dentro de otro y en ese caso solo renderiza `children` (además acepta llamarse sin `usuario`). Al migrar esas tres páginas: quitarles `<AppShell>` y borrar `AppShellNestingContext` y la rama sin `usuario` en `AppShell.tsx`.
   - **Pendiente (08-tasas)**: el indicador de la tasa del día va en la prop `topBarStart` de `AppShell`, pasado desde `(protected)/layout.tsx`.
33. **`atoms/NavigationProgress.tsx`** (franjas de 3 px, indeterminada) conectada a `useLinkStatus` en los ítems del menú (leer `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md`).
   - **Ejecución 2026-10-07**: `atoms/NavigationProgress.tsx` con `NavigationProgressProvider` (registro de fuentes por id: activa mientras haya al menos una), `NavLinkStatus` (va dentro de cada `Link` del menú y usa `useLinkStatus`), `useNavigationPending(activo)` y la barra (3 px, aparece con 100 ms de retardo, franjas barriendo con `PeneroSweep`; quietas con `prefers-reduced-motion`). `PageLoader` se registra mientras está montado, así que la barra corre también durante cualquier `loading.tsx`. Keyframes `penero-sweep` y `penero-fade-in` en `globals.css`.
34. **`organisms/BrandLoader.tsx` + `lib/useGlobalLoader.tsx`** (provider en el layout raíz): retardo de 150 ms, mínimo de 400 ms, contador para llamadas anidadas, `role="status"`, versión sin movimiento. Usarlo en la carga posterior al login y en el cierre de sesión.
   - **Ejecución 2026-10-07**: `organisms/BrandLoader.tsx` (isotipo + nombre con vaivén, franjas de 10 px barriendo, mensaje en `body2`, `role="status"` + `aria-live="polite"`, `Fade`, sin movimiento con `prefers-reduced-motion`; prop `position="contained"` para la página de muestra) y `lib/useGlobalLoader.tsx` con `GlobalLoaderProvider` en el layout raíz. API: `show(mensaje?, { untilNavigation? })` devuelve `release`, `hide()`, `run(tarea, mensaje?)`. `untilNavigation` libera sola la llamada al cambiar de ruta (las Server Actions con `redirect()` no resuelven su promesa). Usado en `LoginForm` ("Entrando") y en "Cerrar sesión" del menú de cuenta ("Cerrando sesión").
35. **`organisms/AppDataGrid.tsx`**: props propias (`rows`, `columns`, `mode: 'client' | 'server'`, `rowCount`, `onQueryChange({ page, pageSize, sort, filter })`, `mobileCard?`, `emptyState`, `getRowHref?`, `tableId` para recordar el tamaño de página), toolbar estándar, overlays, paginación en la URL, tarjetas en `xs` y helpers de columnas (`colMonto`, `colKg`, `colFecha`, `colEstado`, `colAcciones`) para no repetir el formato.
   - **Ejecución 2026-10-07**: `organisms/AppDataGrid.tsx` + `organisms/appDataGridColumns.tsx` (`colMonto` USD/Bs, `colKg`, `colTasa`, `colFecha`, `colEstado` + `EstadoChip`, `colAcciones`) + `molecules/RowActionsMenu.tsx`. Props: `tableId`, `label`, `rows`, `columns`, `mode`, `rowCount`, `onQueryChange({ page, pageSize, sort, search })`, `loading`, `error`/`onRetry`, `emptyState`, `searchable`/`searchPlaceholder`, `filters`, `actions`, `mobileCard`, `getRowHref`, `hideOnMobile`, `initialSort`, `pageParam`. La página vive en `?pagina=` (escrita con `history.replaceState`, que Next sincroniza sin volver a pedir la página al servidor); en modo servidor el `page.tsx` lee la primera página con `paginaDesdeParam()`. Tamaño de página en `localStorage` (`useSyncExternalStore` + `try/catch`). En modo servidor la búsqueda tiene debounce de 300 ms; cancelar la consulta anterior (`AbortController`) queda a cargo de quien implementa `onQueryChange`. Desvío: en tarjetas (`xs`) y modo cliente, la búsqueda compara el texto crudo de los campos de las columnas y respeta el orden recibido (no aplica el orden de la grilla). Sin migrar tablas existentes (Fase 2b).
36. **`organisms/AppDialog.tsx`**: `size: 'xs' | 'sm' | 'md'`, `title`, `subtitle?`, `actions`, `pending`, `dirty`, `onClose`, `error?`; pantalla completa + `Slide` en `xs`; cierre protegido (pendiente / cambios sin guardar → `useConfirm`); foco inicial; pie fijo.
   - **Ejecución 2026-10-07**: `organisms/AppDialog.tsx`. Además de lo pedido: `primaryAction`, `secondaryActions`, `cancelLabel` (en pantalla completa se oculta "Cancelar": cierra la X del encabezado, como en la muestra), `onSubmit` (envuelve el contenido en un `<form noValidate>`), `autoFocusFirstField`. Divisores del contenido solo cuando hay scroll (`ResizeObserver`). Confirmación de descarte: "¿Descartar cambios?" con `useConfirm`.
37. **Botones**: regla de `Button loading` + `useForm({ disabled: isPending })` documentada con un ejemplo en `ClienteForm` (el formulario de referencia).
   - **Ejecución 2026-10-07**: `ClienteForm` migrado a `AppDialog md` + `<Button type="submit" loading={isPending}>` + `useForm({ disabled: isPending })` y guarda contra doble envío en el handler. `ClienteFormFields` y `RepresentantesLegalesFieldArray` pasan `field.disabled` a los campos controlados y deshabilitan agregar/quitar representante mientras guarda. Botón de edición renombrado a "Actualizar cliente" para coincidir con el toast "Cliente actualizado".
38. **`PageHeader`**: en `xs`, la acción primaria pasa a `Fab` y las secundarias a un menú `⋮`; título `h4` responsive.
   - **Ejecución 2026-10-07**: API extendida de forma compatible: `subtitle`, `primaryAction` y `secondaryActions` (`{ label, icon, onClick | href, disabled, loading }`); `children` sigue funcionando igual (las pantallas actuales no cambian). En `xs`: primaria como `Fab` extendido fijo abajo a la derecha con `env(safe-area-inset-bottom)` y secundarias en `⋮`; el cambio es por CSS (sin parpadeo de hidratación). Pendiente para la Fase 2b: pasar las pantallas a `primaryAction` y dejar espacio inferior para el `Fab` en las listas largas.
39. **Página de muestra `/_estandares`** (solo en desarrollo, solo admin): muestra cada componente base en sus estados (loader global, progreso de navegación, tabla vacía / cargando / con datos / sin resultados / en `xs`, diálogo de los tres tamaños, botones en carga). Sirve para revisar claro/oscuro y 375 px de un vistazo y como referencia para los agentes.
   - **Ejecución 2026-10-07**: la ruta es **`/estandares`** (`src/app/(protected)/estandares/`), no `/_estandares`: una carpeta con `_` es privada en el App Router y no genera página. `notFound()` en producción o si el rol no es admin; aparece en el menú solo en desarrollo y para admin ("Estándares UI"). Muestra marca y escala tipográfica, loader global (contenido y pantalla completa, y una operación de 100 ms que no lo muestra), barra de navegación, botones en carga, chips de estado, `AppDataGrid` con datos / vacía / cargando / error / servidor simulado (y tarjetas en `xs`), y `AppDialog` xs/sm/md con formulario, guardado de 1,5 s y error simulado. No incluye `PageLoader` porque encendería la barra de navegación de toda la página.

### Fase 2b — Migración de pantallas existentes

> **Tarea agregada (2026-10-07)**: clientes (listado, ficha, `ClienteForm`, `BloqueoDialog`) se migra en el módulo `specs/10-refactor-visual-clientes/`, que cubre las tareas 40–43 para clientes y resuelve los pendientes (b) y (d) de la Fase 2a. Las pantallas siguientes reusan lo que deja: `FichaHeader`, `normalizeSearch` de `AppDataGrid`, `StatusChips` `soft` y `BloqueoDialog` sobre `AppDialog`.

40. **Tablas** → `AppDataGrid`, con paginación en **servidor** para las que crecen con el tiempo (requiere `.range()` + `count` en sus repositorios): `ComprasTable`, `PedidosTable`, `NotasCreditoTable`, `ProcesamientosTable`, `FacturasAbiertasTable` (o su reemplazo de `09`). En **cliente**: `ClientesTable`, `ProveedoresTable`, `ProductosTable`. Cada una define su `mobileCard`.
41. **Diálogos** → `AppDialog`: `ClienteForm`, `ProveedorForm`, `CompraForm`, `PedidoForm`, `ProcesamientoForm`, `ProductoForm`, `NotaCreditoForm`, `RegistrarPagoDialog`, `PagoProveedorDialog`, `EntregaPedidoDialog`, `BloqueoDialog`, `CrearUsuarioForm` (si es diálogo). Quitar los `CircularProgress` manuales de los botones.
42. **Fichas** (cliente, proveedor): encabezado consistente (nombre `h5`, identificador en `caption`, estado con chips, acciones a la derecha o en `⋮` en `xs`) y secciones con el radio 8 + borde.
43. **Copy**: revisar botones y toasts de todas las pantallas (verbo de acción = verbo del toast; sentence case; errores con causa y solución).

### Fase 2c — Verificación

44. `npm run lint`, `npx tsc --noEmit`, `npm run build`.
45. Recorrer cada pantalla en 375 / 768 / 1024 / 1440 px y en claro/oscuro: sin scroll horizontal, menú correcto por breakpoint, `Fab` en `xs`, tablas como tarjetas en `xs`, diálogos a pantalla completa en `xs`.
46. Navegar entre secciones: el menú no parpadea ni se vuelve a montar, la barra de progreso aparece y el skeleton queda dentro del shell.
47. Acciones: doble clic rápido en "Guardar" crea un solo registro; durante el guardado no se puede cerrar el diálogo ni editar campos.
48. Paginación en servidor: con más de 100 compras de prueba, cambiar de página no recarga toda la tabla y "volver" desde una ficha mantiene la página.
49. Accesibilidad: foco visible en todo, `aria-label` en los íconos, loader global anunciado, `prefers-reduced-motion` respetado.

## Componentes agregados después de la primera pasada
- _(los módulos 01-05 anotan aquí cualquier componente genérico nuevo que creen, con fecha y motivo, y lo agregan también a la tabla de `spec.md`)_
- **2026-10-06 (03-proveedores)**: `lib/validationMessages.ts` (cierra tarea 22), `lib/actionState.ts`, `lib/documentoStore.ts`, `lib/bancosVe.ts`, generalización de `DocumentoUpload` (adaptador `DocumentoStore`) y de `RepresentantesLegalesFieldArray` (tipado genérico + `Collapse`, cierra tarea 26), y `CopyableText` / `StatusChips` en `molecules`. Todos agregados a la tabla de `spec.md`.
- **2026-10-07 (10-refactor-visual-clientes)**: `molecules/FichaHeader` (nuevo) y `lib/navigationOrigin.ts` (nuevo, para la vuelta de `FichaHeader`); `AppDataGrid` con `normalizeSearch` + `getSearchValues` (búsqueda en modo cliente resuelta por el propio componente, igual en grilla y tarjetas) y Enter en una celda para abrir la fila (`onCellKeyDown`, cierra el pendiente (b)); exporta `normalizarBusqueda` / `normalizarBusquedaSinSeparadores`, y `appDataGridColumns` exporta `ACTIONS_FIELD`; `StatusChips` en `soft` 22 px con `mostrarActivo`; `DocumentoUpload` con `disabled` y `Button loading` (cierra el pendiente (d)); `BloqueoDialog` sobre `AppDialog xs`; `EmptyState` con `compact`. Todos agregados a la tabla de `spec.md`.

## Nota de implementación (2026-10-06)

- Persistencia del modo en cookie: `src/lib/themeStorage.ts` implementa un `StorageManager` de MUI que escribe la cookie `mui-mode` además de `localStorage`; `layout.tsx` la lee y aplica `data-mui-color-scheme` en `<html>` antes del render. El `InitColorSchemeScript` cubre el primer load del cliente. No se usó Server Action para setear la cookie (diferido, ver checklist).
- `useNotify` es un re-export en `src/lib/useNotify.ts` que apunta a `components/organisms/NotificationProvider.tsx` (fuente única del hook + proveedor).
- `useConfirm` vive en `src/lib/useConfirm.tsx` (proveedor + hook) y usa `components/molecules/ConfirmDialog.tsx`.
- `NotificationProvider` usa un `useReducer` con cola para mostrar notificaciones en serie (patrón recomendado por MUI), evitando superponer Snackbars.
