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
>
> **Tarea agregada (2026-10-07)**: proveedores (listado, ficha, `ProveedorForm`) se migra en el módulo `specs/11-refactor-visual-proveedores/`, que cubre las tareas 40–43 para proveedores sobre el patrón de 10 (`FichaHeader`, `AppDataGrid` con `normalizarBusquedaSinSeparadores`, `StatusChips` `mostrarActivo`, `AppDialog md` con el Stepper conservado). Sin `CarteraIndicador` (dominio CxP inexistente; futuro módulo de cuentas por pagar).
>
> **Tarea agregada (2026-10-07)**: catálogos (`/catalogos`: `ProductosTable`, `ProductoForm`, `ConfigNegocioForm`, tabs) se migra en el módulo `specs/12-refactor-visual-catalogos/`, que cubre las tareas 40–43 para catálogos sobre el patrón de 10/11: `AppDataGrid` modo cliente con búsqueda normalizada de códigos, chips Activos/Todos en `?estado=`, tab Productos/Configuración persistente en `?tab=`, `AppDialog sm` para el form de producto y `Button loading` + `useForm({ disabled })` en la config. Sin ficha de producto (lista + diálogo).

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

## Formularios — estilo y distribución (nuevo estándar, aprobado el 2026-10-07)

Problemas planteados por el usuario sobre `ClienteForm`: sin división clara de secciones, inputs demasiado grandes, `NumberField` aceptaba letras sin validar, sin máscara de teléfono ni de cédula/RIF completa. Reglas nuevas en `spec.md` § "Estructura visual".

50. **Instalar `react-number-format`** — única librería de máscaras del sistema (`NumericFormat`/`PatternFormat` con `customInput={TextField}`).
   - **Ejecución 2026-10-07**: v5.4.5. Desvío documentado: `RifCiField` usa `NumberFormatBase` (no `PatternFormat`) porque el string-format de `PatternFormat` solo acepta dígitos en los slots `#` — la letra inicial `V|E|J|G` requeriría un formato-función con `removeFormatting` propio.
51. **`src/components/molecules/FormSection.tsx`**: título `h6` + `ayuda?` + divisor 1 px encima (excepto primera) + prop `dense`. Reemplaza al helper local `Seccion` de `ClienteFormFields` y el markup manual de "Documentos" en `ClienteForm`.
   - **Ejecución 2026-10-07**: hecho, más `ConfigNegocioForm` (sus dos encabezados `h6` manuales con `Divider` pasaron a `FormSection`). `RepresentantesLegalesFieldArray` y el Stepper de `ProveedorForm` conservan encabezado propio por ahora (consistentes en `h6`).
52. **Reconstruir `atoms/NumberField.tsx` sobre `NumericFormat`**: letras bloqueadas en vivo, misma interfaz (`value: number | null`, `onChange(number | null)`, `decimals`, `prefix`, `suffix`) para que los 14 consumidores no cambien. Borrar `parseInput`/`display` artesanales.
   - **Ejecución 2026-10-07**: hecho. Agregada prop `allowNegative` (default `false`; el parseo viejo admitía `-`, ningún consumidor la usaba). Separadores es-VE (`.` miles, `,` decimal) con `allowedDecimalSeparators` para aceptar ambos al escribir.
53. **`src/components/atoms/PhoneField.tsx`**: máscara `####-#######`, normaliza `+58`/`58`, `inputMode="tel"`. Reemplaza los `TextField type="tel"` de `ClienteFormFields`, `RepresentantesLegalesFieldArray` y `ProveedorIdentificacionFields`.
   - **Ejecución 2026-10-07**: hecho, incluida export `normalizarTelefono`.
54. **Reconstruir `atoms/RifCiField.tsx` sobre `PatternFormat`**: máscara completa letra `V|E|J|G` + guion + hasta 10 dígitos + dígito verificador opcional. Mantiene la etiqueta dinámica.
   - **Ejecución 2026-10-07**: hecho sobre `NumberFormatBase` (ver desvío en la tarea 50). La etiqueta llega por props como cualquier `TextField`.
55. **Aplicar el estándar al formulario de referencia**: `ClienteFormFields` (FormSection + `size="small"` + PhoneField) y `ClienteForm` ("Documentos" como FormSection). También `RepresentantesLegalesFieldArray` y `ProveedorIdentificacionFields`.
   - **Ejecución 2026-10-07**: hecho.
56. **Barrido `size="small"`** en el resto de los formularios que usan `NumberField` dentro de `AppDialog` (14 consumidores listados en `rg -l 'NumberField' src`): solo el prop, sin cambiar lógica.
   - **Ejecución 2026-10-07**: hecho en los 14 consumidores y en todos los demás formularios (diálogos y páginas) de `organisms`/`molecules`: verificado con script (cero `TextField`/`NumberField` con `fullWidth` y sin `size`). Incluye `organismos/compras/CompraForm.tsx` (versión en curso del otro agente, mismo barrido mecánico).
57. **`/estandares`**: agregar muestra del estándar nuevo (FormSection, inputs small, NumberField bloqueando letras, PhoneField, RifCiField) para revisar claro/oscuro y 375 px.
   - **Ejecución 2026-10-07**: sección "Formularios" al final de la página. Revisión visual pendiente del usuario.
   - Verificación: escribir letras en NumberField no aparece nada; `04141234567` → `0414-1234567`; `v12345678` → `V-12345678`; zod sigue validando al submit (la máscara previene, no valida). _(Casos del RifCiField verificados con script node: escritura progresiva, pegado formateado y crudo, verificador, letra inválida bloqueada.)_

## Fase 3 — Rediseño Puerto (planificada el 2026-10-22)

El cliente eligió la identidad "Puerto" (fresco, premium, confiable), que **reemplaza a "Peñero"**. Lo pidió el usuario el 2026-10-22. Valores, escala y reglas en `spec.md` § "Identidad visual «Puerto»" y § "Tipografía". Referencia: artboard "B · Puerto" del lienzo citado en la spec.

**Alcance**: la piel (tokens, fuentes, radios, decorativo y componentes base) más la revisión de cada pantalla. No cambia datos, reglas ni la anatomía de tablas, diálogos y formularios. Las decisiones P-UI1 a P-UI10 (`spec.md` § "Decisiones de la Fase 3") las aprobó el cliente el 2026-10-22 tal como se propusieron. Si el cliente cambia alguna, se toca solo el token o el componente que indica la tarea. Rama sugerida: `feat/rediseno-puerto`.

**Después de cada tarea: `npm run lint` y `npx tsc --noEmit` en verde** antes de seguir. Para no romper consumidores a mitad de fase, los tokens nuevos conviven con los de Peñero hasta la tarea 88 (*desde el 2026-10-29, la tarea 140 de la Fase 4*).

### Fase 3a — Tokens, fuentes y theme

58. **Decisiones**: presentar al usuario P-UI1 a P-UI10 con la propuesta de cada una.
   - Hecho cuando: cada decisión está marcada como aprobada, o con el valor elegido, en la tabla de `spec.md`. Las que sigan abiertas quedan anotadas sin bloquear: se avanza con la propuesta.
   - **Hecho 2026-10-22** (rama `docs/rediseno-puerto`): el cliente aprobó las diez propuestas sin cambios; tabla de `spec.md` actualizada.
59. **Verificar cifras tabulares** de Instrument Sans 400/500/600 y Fraunces 500/600 con el método de la tarea 30: leer la tabla GSUB de los `.woff2`. Se usan los de Google Fonts, descargados a un directorio temporal fuera del repo. Si no se pueden descargar, se usan los que `next/font` deja en `.next/static/media` al terminar la tarea 64, y esta verificación se hace antes de la 65.
   - Hecho cuando: el resultado (`tnum` sí/no por familia) queda anotado en esta tarea. Si alguna no lo trae, se aplica P-UI8 (consultar) antes de la tarea 65.
   - **Ejecución 2026-10-22 — decisión**: Verificadas las tablas GSUB con fontTools sobre los TTF de Google Fonts. Instrument Sans **sí** declara `tnum` en GSUB y sus glifos tabulares (`.tf`) tienen un ancho uniforme exacto de 600 unidades para todos los dígitos (0-9), garantizando la alineación perfecta en tablas, DataGrid y montos de interfaz. Fraunces no declara `tnum` en GSUB (solo 'case', 'liga', 'rvrn', 'ss01'); al usarse para display, títulos y cifras de KPI grandes y no en columnas alineadas, no requiere cifras tabulares y no hace falta incorporar una tercera familia (P-UI8 resuelto sin sumar fuentes).
60. **`src/theme/marca.ts`**: agregar a `MarcaPaleta` las claves Puerto (`midnight`, `navy`, `onMidnight`, `onMidnightMuted`, `brass`, `brassText`) en `MARCA_CLARO` y `MARCA_OSCURO`, con los valores de la spec (P-UI10 en oscuro). Las de Peñero se dejan (compat). Actualizar el comentario del archivo.
   - Hecho cuando: compila sin tocar consumidores y los hex nuevos viven solo aquí.
   - **Ejecución 2026-10-22**: Añadidas a `MarcaPaleta`, `MARCA_CLARO` y `MARCA_OSCURO` en `src/theme/marca.ts` las claves `midnight`, `navy`, `onMidnight`, `onMidnightMuted`, `brass` y `brassText` con los hex de la spec (P-UI10 en oscuro). Se conservan las claves Peñero para compatibilidad temporal.
61. **`src/theme/theme.ts` — esquema claro**: `primary`, `secondary` (latón texto), `success` (P-UI1: `main` `#2F5E9E`, `light` `#ABC7F1`), `warning`, `error`, `info` (P-UI6), `background.default`/`paper`, `text.*` y `divider` según la spec. En `BrandPalette` se suman las claves de la tarea 60. Actualizar el comentario de cabecera ("Puerto").
   - Hecho cuando: `/estandares` en claro muestra la paleta nueva y ningún componente usa hex.
   - **Ejecución 2026-10-22**: `src/theme/theme.ts` actualizado en esquema claro con `primary` (#0B1B33), `secondary` (#7A5C2E), `success` (P-UI1: main #2F5E9E, light/soft #ABC7F1), `warning` (#A15C07), `error` (#B3261E), `info` (#44597A), fondos default (#F7F6F2), paper (#FFFFFF), subtle (#F0EEE7), texto (#0B1B33 / #5B6474) y divider (#E4E1D8).
62. **`theme.ts` — esquema oscuro**: `primary` latón `#D4B27A` con `contrastText` `#241A0B`, `secondary`, `success` `#ABC7F1`, `warning` `#E9B460`, `error` `#EE8A83`, `info`, fondos `#0A1424`/`#121F35`, texto `#EEF0F4`/`#A3ADBD` y `divider` `#22314B`.
   - Hecho cuando: `/estandares` en oscuro muestra el botón principal latón con texto oscuro y los fondos nuevos.
   - **Ejecución 2026-10-22**: `src/theme/theme.ts` actualizado en esquema oscuro con `primary` latón #D4B27A (contrastText #241A0B), `secondary` #D4B27A, `success` #ABC7F1, `warning` #E9B460, `error` #EE8A83, `info` #9FB4D3, fondos default #0A1424, paper #121F35, subtle #17253D, texto #EEF0F4/#A3ADBD y divider #22314B.
63. **Tokens nuevos del theme** (aumento de módulos en `theme.ts`):
   - `background.subtle` (`TypeBackground`);
   - `soft`/`onSoft` en `PaletteColor`, con los valores de la tabla de chips de la spec;
   - `palette.chart` `c1`–`c6` (P-UI9);
   - borde de input (P-UI7) como `palette.inputBorder` o como override de `MuiOutlinedInput.notchedOutline`, documentando cuál se usó.
   - Hecho cuando: los cuatro existen como variables CSS (`--mui-palette-background-subtle`, etc.) en ambos esquemas y tipan sin `any`.
   - **Ejecución 2026-10-22**: Módulo augmentation en `theme.ts` para `background.subtle`, `soft`/`onSoft` en `PaletteColor`, `palette.chart` `c1`–`c6` y `palette.inputBorder`. Usado `palette.inputBorder` referenciado en `MuiOutlinedInput.notchedOutline` para borde de input P-UI7 (#A9A397 claro, #2C3B55 oscuro).
64. **Fuentes en `src/app/layout.tsx`**: reemplazar `Barlow`/`Barlow_Condensed` por `Fraunces` (500/600) e `Instrument_Sans` (400/500/600) de `next/font/google`, subsets `latin` y `latin-ext`, con las mismas variables `--font-display`/`--font-body`. Antes, leer la guía de fuentes en `node_modules/next/dist/docs/` (nombre del export, `weight` vs fuente variable, `axes`). En `theme.ts`, `DISPLAY_FONT` pasa a `var(--font-display), Georgia, serif`.
   - Hecho cuando: `layout.tsx` no importa Barlow, el HTML servido carga las dos familias nuevas y `npm run build` pasa.
   - **Ejecución 2026-10-22**: En `src/app/layout.tsx`, Barlow y Barlow Condensed reemplazados por Fraunces (500/600) e Instrument_Sans (400/500/600) de `next/font/google`, inyectando `--font-display` y `--font-body`. En `theme.ts`, `DISPLAY_FONT` actualizado a `var(--font-display), Georgia, serif`. `npm run build` verificado exitoso en Turbopack.
65. **Escala tipográfica en `theme.ts`**: `h3`, `h4` (con su tamaño en `xs`), `h5` (Fraunces 500, P-UI5), `h6` (Instrument Sans 600, ya **no** display), `subtitle1`, `subtitle2` (etiqueta 12/600/0.04em), `body1` (lh 1.55), `body2`, `caption` 12 y `button` 14/500, como la tabla de la spec. `overline` sigue sin mayúsculas.
   - Hecho cuando: la sección de tipografía de `/estandares` coincide con la tabla de la spec.
   - **Ejecución 2026-10-22**: Escala tipográfica en `theme.ts` aplicada: `h3` (52/42 px, Fraunces 600, lh 1.05), `h4` (26/24 px, Fraunces 600, lh 1.2), `h5` (24 px, Fraunces 500 tabular, lh 1.2), `h6` (18 px, Instrument Sans 600, lh 1.35), `subtitle1` (16 px, Instrument Sans 500), `subtitle2` (12 px, Instrument Sans 600, letter-spacing 0.04em, sentence case), `body1` (16 px, lh 1.55), `body2` (14 px, lh 1.5), `caption` (12 px, lh 1.4) y `button` (14 px, Instrument Sans 500, sentence case).
66. **Radios, bordes y elevación en `theme.ts`**:
   - `shape` 6;
   - `MuiChip` 4;
   - `MuiMenuItem`, `MuiTooltip` y `MuiListItemButton` 4;
   - `MuiFab` 6 (antes 12);
   - `MuiPaper.rounded` 8;
   - `MuiDialog` según P-UI3;
   - menú, popover y `Autocomplete` 6;
   - `MuiDataGrid` y `MuiTableContainer` 6;
   - encabezado de `MuiTableCell` y `MuiDataGrid` sobre `background.subtle`, con el estilo de `subtitle2`;
   - foco visible de 2 px de `primary`.

   Se conservan cero sombras en reposo y el borde de 1 px.
   - Hecho cuando: cada radio de la tabla "Jerarquía de superficies y radios" se ve en `/estandares` y no quedan radios escritos a mano en `sx` que lo contradigan (grep de `borderRadius:` en `src/components` revisado).
   - **Ejecución 2026-10-22**: Radios y elevación en `theme.ts` aplicados: `shape` 6; `MuiChip`, `MuiMenuItem`, `MuiTooltip`, `MuiListItemButton` 4; `MuiFab` 6; `MuiPaper.rounded` 8; `MuiDialog` 8 (0 en fullscreen); `MuiMenu`, `MuiPopover`, `MuiAutocomplete` 6; `MuiDataGrid`, `MuiTableContainer` 6; encabezados de tabla sobre `background.subtle` en `subtitle2`; foco visible de 2 px de `primary.main` con offset 2 px en `MuiButtonBase`.
67. **`Chip variant="soft"`** pasa a usar `soft`/`onSoft` (tarea 63) en lugar del alfa de `mainChannel`. En claro, "Pagada" se ve con fondo `#ABC7F1` y texto `#0B1B33`, "Pendiente" y "Por vencer" con `#F8EEDD`/`#7E4705` y "Vencida" con `#F8E5E3`/`#8E1F18`. En `atoms/EstadoCarteraChip.tsx`, `COLOR_ESTADO_CARTERA.pendiente` pasa de `info` a `warning` (decisión del cliente, 2026-10-22; tarea agregada en `09-cuentas-por-cobrar/tasks.md`).
   - Hecho cuando: `StatusChips`, `EstadoCarteraChip`, `LoteChip`, `SenalFacturaChip`/`NivelSenalChip` y `TasaChip` se ven así en `/estandares` y en sus pantallas, sin cambiar sus props.
   - **Ejecución 2026-10-22**: `Chip variant="soft"` actualizado para leer `theme.vars.palette[color].soft` y `onSoft`. En `src/components/atoms/EstadoCarteraChip.tsx`, `COLOR_ESTADO_CARTERA.pendiente` actualizado de `info` a `warning`.
68. **`fontSize="xlarge"` para íconos**: aumento de `SvgIconPropsSizeOverrides` + variante en `MuiSvgIcon` (40 px).
   - Hecho cuando: `<XIcon fontSize="xlarge" />` tipa y mide 40 px.
   - **Ejecución 2026-10-22**: Agregado `SvgIconPropsSizeOverrides` con `xlarge: true` y variante `fontSize="xlarge"` (40 px / 2.5rem) en `MuiSvgIcon`.
69. **`src/app/globals.css`**: renombrar los keyframes `penero-*` a `puerto-*` (`puerto-sweep`, `puerto-fade-in`; `penero-paint` y `penero-bob` se borran si la tarea 72 los deja sin uso) y actualizar sus comentarios. Migrar el último `MONO` con `var(--font-geist-mono)` (`organisms/RegistrarPagoDialog.tsx`) a `NUM = { fontVariantNumeric: 'tabular-nums' }` y borrar el alias `--font-geist-mono` (cierra la segunda mitad del pendiente (f)).
   - Hecho cuando: `rg 'penero-|geist' src` solo encuentra lo que todavía usan `PeneroStripes` y `BrandLoader`, que se limpia en las tareas 72 y 88.
   - **Ejecución 2026-10-22**: En `globals.css`, añadidos keyframes `puerto-sweep` y `puerto-fade-in`. Eliminado alias `--font-geist-mono`. En `src/components/organisms/RegistrarPagoDialog.tsx`, migrado el último `MONO` a `NUM = { fontVariantNumeric: 'tabular-nums' }`. Verificado que `rg 'geist' src` no arroja resultados.

### Fase 3b — Decorativo y marca (P-UI2, P-UI4) — _Reemplazada el 2026-10-29 por la Fase 4_

> **Reemplazada el 2026-10-29 por la Fase 4** (pedido del usuario: no quedó conforme con el acabado de la Fase 3a y pidió un design system). Las Fases 3b, 3c y 3d no se implementaron. Se conservan como historial: **no se ejecutan**. Lo que sigue vigente pasó a la Fase 4:
>
> | Tarea 3b–3d | Pasa a |
> |---|---|
> | 70 `FileteLaton` | 131 |
> | 71 `NavigationProgress` | 132 (3 px en el borde superior) |
> | 72 `BrandLoader` | 133 |
> | 73 isotipo Puerto | 134 |
> | 74 `AuthLayout` / `DocumentoPublicoLayout` | 135 |
> | 75 `CreditoResumen` | 137 (revisada: superficie normal, sin bloque de color) |
> | 76 PDF y correo | 138 |
> | 77 `AppShell` | 136 |
> | 78 `PageHeader` | 113 |
> | 79 `FichaHeader` | 118 |
> | 80 `FormSection` | 114 |
> | 81 `KpiCard` | 119 |
> | 82 `ChartCard` y afines | 121 |
> | 83 `AppDialog` / `ConfirmDialog` | 116 |
> | 84 `AppDataGrid` | 111–112 |
> | 85 gráficos | 139 |
> | 86 y 90 barridos | 158 |
> | 87 `/estandares` | 141–145 |
> | 88 retirar Peñero | 140 |
> | 89 contraste | 159 |
> | 91 revisión visual | 160 |
> | 92 cierre | 161 |

70. **`src/components/atoms/FileteLaton.tsx`** (nuevo): `variant: 'rule' | 'sweep'`, `height` (2 por defecto), `width`, `track` (riel tenue en `sweep`); color `brand.brass`; `sweep` con `puerto-sweep` y quieto con `prefers-reduced-motion`. Duración y retardos como constantes exportadas, no ms sueltos (cierra el pendiente (c)).
   - Hecho cuando: `/estandares` muestra ambas variantes en claro y oscuro.
71. **`atoms/NavigationProgress.tsx`**: `PeneroSweep height={3}` → `FileteLaton variant="sweep" height={2}`. El registro de fuentes y el retardo de 100 ms (ahora constante) no cambian.
   - Hecho cuando: navegar entre secciones muestra la línea de latón en el borde de la barra superior.
72. **`organisms/BrandLoader.tsx`**: isotipo + "Altamar Sea Food" en `h3`/Fraunces + `FileteLaton sweep` de 2 px (antes franjas de 10 px). Se quita el vaivén `penero-bob` (Puerto es sobrio). Se conservan el retardo, el mínimo, el contador, `role="status"` y la versión sin movimiento.
   - Hecho cuando: el login ("Entrando") y "Cerrar sesión" muestran el loader nuevo, y con `prefers-reduced-motion` todo queda quieto.
73. **`atoms/BrandMark.tsx` + `src/lib/marca/isotipo.ts` + `src/app/icon.svg`**: isotipo provisional Puerto (P-UI4) con `brand.midnight`/`brand.onMidnight` y `brand.brass`; la variante `full` lleva "Altamar" en Fraunces 600; la `orientation` y el `size` no cambian. `icon.svg` se regenera con los hex claros de `marca.ts`.
   - Hecho cuando: el menú, el loader, el login y la pestaña del navegador muestran el isotipo nuevo, sin franjas ocre ni rojas.
74. **`templates/AuthLayout.tsx` y `templates/DocumentoPublicoLayout.tsx`**: panel `brand.midnight` con texto `brand.onMidnight`/`onMidnightMuted`, logo y `FileteLaton rule` en lugar de `PeneroStripes`. En la página pública, filete bajo el encabezado.
   - Hecho cuando: `/login`, `/recuperar`, `/actualizar-password` y `/c/[token]` (vigente y respaldo) no usan franjas.
75. **`molecules/CreditoResumen.tsx`**: el bloque "casco" pasa a `brand.midnight`, la barra de uso a `brand.brass` (y a `error.main` con ícono al superar el límite, no solo por color) y los textos a `onMidnight*`.
   - Hecho cuando: la ficha de cliente muestra el bloque nuevo en claro y oscuro con contraste AA.
76. **PDF y correo con la marca nueva** (tarea agregada en `21-cotizaciones` y `09-cuentas-por-cobrar`):
   - `lib/pdf/fuentes.ts` y `lib/pdf/fuentes/LEEME.md`: Fraunces 600 e Instrument Sans 400/600 en TTF estáticos (OFL), con Helvetica de respaldo;
   - `lib/pdf/marca.tsx`: filete de latón en lugar de franjas;
   - `lib/cotizaciones/pdf/CotizacionPdf.tsx`: `MARCA_CLARO.hull` → `MARCA_CLARO.midnight`;
   - `lib/cartera/recordatorios/plantillas.ts`: colores del correo desde las claves Puerto.
   - Hecho cuando: `npx tsx scripts/probar-cotizaciones.ts --pdf` genera el PDF con la marca nueva y la vista previa del correo de `RecordatorioDialog` ya no lleva franjas.

### Fase 3c — Componentes base — _Reemplazada el 2026-10-29 por la Fase 4_

> Reemplazada el 2026-10-29 por la Fase 4 (ver la tabla de la Fase 3b). No se ejecuta.

77. **`templates/AppShell.tsx`**:
   - sidebar `brand.midnight` en ambos esquemas;
   - logo con nombre en Fraunces y `FileteLaton rule` de 2 px debajo;
   - ítem activo con fondo `brand.navy`, punto de latón de 6 px a la izquierda (reemplaza el marcador de franjas, líneas ~190–200) y texto `onMidnight`; inactivos en `onMidnightMuted`; radio 4;
   - riel `sm` y drawer temporal `xs` con el mismo tratamiento;
   - barra superior en `background.paper` con borde `divider`;
   - `ColorModeToggle`, `TasaIndicador` y el menú de cuenta legibles sobre su fondo.
   - Hecho cuando: los tres breakpoints del menú se ven como el artboard y el foco del teclado es visible sobre medianoche.
78. **`molecules/PageHeader.tsx`**: título `h4` (Fraunces 26/24). Revisar que el `Fab` de `xs` herede el radio 6 y el color `primary` de cada esquema.
   - Hecho cuando: el título de cada listado se ve en serifa y el `Fab` en latón en oscuro.
79. **`molecules/FichaHeader.tsx`**: nombre `h5` (Fraunces) con `component="h1"`, `meta` en `body2`/`caption` y vuelta en `secondary` (latón texto).
   - Hecho cuando: las fichas de cliente, proveedor, compra, factura, lote, empleado y cotización comparten el encabezado nuevo.
80. **`molecules/FormSection.tsx`**: título `h6` (ahora Instrument Sans 600, 18 px); divisor `divider`. Revisar `RepresentantesLegalesFieldArray` y el Stepper de `ProveedorForm`, que conservan encabezado propio: deben usar `h6` del theme, sin estilos sueltos.
   - Hecho cuando: los formularios con secciones se ven iguales entre sí.
81. **`molecules/KpiCard.tsx`**:
   - título en `subtitle2`;
   - cifra `h5` Fraunces 500 tabular;
   - radio 6;
   - `tone` con ícono (`ErrorOutlineOutlined`, `WarningAmberOutlined`, `CheckCircleOutlineOutlined`) además del borde izquierdo, porque `success` es azul como `primary`;
   - el `Skeleton` usa `variant` de tipografía (`sx={{ typography: 'h5' }}`) en lugar de `fontSize: '1.625rem'`;
   - comentario actualizado (sin Barlow).
   - Hecho cuando: el dashboard distingue los KPI de estado sin depender del color.
82. **`molecules/ChartCard.tsx`, `ChartLegendTable.tsx`, `ListaResumen.tsx` y `CadenaTrazabilidad.tsx`**: radio 8, borde `divider`, título `h6` sans y montos tabulares. En `CadenaTrazabilidad`, el `'& svg': { fontSize: 20 }` pasa a `fontSize="small"` en los íconos que recibe.
   - Hecho cuando: el dashboard y `/facturas/[id]` se ven con superficies Puerto.
83. **`organisms/AppDialog.tsx` + `molecules/ConfirmDialog.tsx`**: radio de P-UI3 (0 a pantalla completa), título `h6` sans, subtítulo `body2` `text.secondary`, pie con divisor fino cuando hay scroll (sin cambio) y botones con radio 6.
   - Hecho cuando: los tres tamaños de `/estandares` y un `ConfirmDialog` se ven con el acabado nuevo.
84. **`organisms/AppDataGrid.tsx` + `appDataGridColumns.tsx` + `molecules/RowActionsMenu.tsx`**:
   - encabezado de 44 px sobre `background.subtle`, en `subtitle2`;
   - hover de fila en `background.subtle`;
   - divisores de 1 px y radio 6;
   - tarjetas `xs` (`mobileCard`) con radio 6 y borde;
   - `LinearProgress` de carga en `primary`;
   - menú `⋮` con ítems de radio 4.
   - Hecho cuando: la tabla de `/estandares` (con datos, vacía, cargando y error) y las tarjetas en 375 px se ven como el artboard.
85. **Gráficos** (P-UI9): `lib/dashboard/chartColors.ts` toma `categorias` de `palette.chart` y revisa `usd`/`kg`/`positivo` para que no coincidan en tono. En `organisms/BarLineChart.tsx`, el `labelStyle` `fontSize: 12` de la referencia pasa a la escala (`theme.typography.caption`).
   - Hecho cuando: las series del dashboard se distinguen en claro y oscuro, cada una con ≥ 3:1 contra `background.paper`.
86. **Tamaños sueltos fuera del theme** (hoy hay 12 en 10 archivos de UI; los PDF de react-pdf no cuentan):
   - íconos de estado de 40/48 → `fontSize="xlarge"` (tarea 68): `molecules/ErrorState.tsx`, `organisms/RecuperarForm.tsx`, `organisms/GastosRecurrentesTable.tsx`, `organisms/CotizacionNoDisponible.tsx` (×2);
   - íconos de 16 → `fontSize="small"` o `inherit` dentro del texto: `organisms/CompraLineasLotes.tsx`, `molecules/TasaIndicador.tsx`, `app/(protected)/tasas/tasas-screen.tsx` (×2);
   - `KpiCard` (tarea 81), `CadenaTrazabilidad` (tarea 82) y `BarLineChart` (tarea 85).
   - Hecho cuando: `rg "fontSize:\s*['\"0-9]" src --glob '!src/lib/**/pdf/**' --glob '!src/lib/pdf/**' --glob '!src/lib/contratos/**'` no devuelve nada (el `fontSize: 'inherit'` de `AppShell` es válido).
87. **Pantalla `/estandares`** (`estandares-screen.tsx`): paleta Puerto con los hex y su rol, escala tipográfica nueva, `FileteLaton` (dos variantes), chips de estado, `KpiCard` con `tone`, `ChartCard`, radios por jerarquía y botones en claro y oscuro. Quitar las referencias a franjas y a Peñero.
   - Hecho cuando: la página sirve como referencia única de Puerto para los agentes.
88. **Retirar Peñero** (después de las tareas 70–87, que dejan sin consumidores lo viejo): borrar `atoms/PeneroStripes.tsx` (`PeneroStripes` y `PeneroSweep`), las claves `hull`, `hullDeep`, `onHull`, `onHullMuted`, `ochre`, `red` y `trim` de `BrandPalette` y de `marca.ts`, y los keyframes sin uso.
   - Hecho cuando: `rg -i 'penero|hull|ochre|brand\.red|brand\.trim' src` no encuentra nada.

### Fase 3d — Verificación — _Reemplazada el 2026-10-29 por la Fase 4_

> Reemplazada el 2026-10-29 por la Fase 4 (ver la tabla de la Fase 3b). No se ejecuta.

89. **Contraste AA** con herramienta (no a ojo), en claro y oscuro. Anotar cada par y su razón en el checklist. Como mínimo:
   - `text.primary` y `text.secondary` sobre `background.default`, `paper` y `subtle`;
   - texto de `primary` y `secondary` (latón texto) sobre `paper`;
   - `contrastText` de cada botón;
   - `onSoft` sobre `soft` de cada chip;
   - `success` de texto (P-UI1), `warning` y `error` sobre `paper`;
   - `onMidnight` y `onMidnightMuted` sobre `midnight` y sobre `navy`;
   - contorno de input (P-UI7), foco y series de gráfico, ≥ 3:1.
   - Hecho cuando: todos los pares dan ≥ 4.5:1 (texto) o ≥ 3:1 (texto grande y no textual), o el ajuste está hecho en el token.
90. **Barridos con grep** (resultado esperado: vacío):
   - hex fuera de `src/theme/`, `src/app/icon.svg` y los PDF;
   - `Barlow` en `src/`;
   - `penero`/`Penero` en `src/`;
   - `brand.(hull|ochre|red|trim)`;
   - `fontSize` suelto (tarea 86);
   - clases de color de Tailwind.
   - Hecho cuando: cada grep está anotado en el checklist con su resultado.
91. **Revisión visual pantalla por pantalla** en claro y oscuro, a 375, 768, 1024 y 1440 px, contra el artboard:
   - acceso: `/login`, `/recuperar`, `/actualizar-password`;
   - inicio (dashboard);
   - clientes y su ficha;
   - proveedores y su ficha;
   - `/catalogos` (las dos tabs);
   - compras y su ficha;
   - `/procesamiento`;
   - `/inventario` y la ficha de lote;
   - `/pedidos` y POS;
   - `/facturas/[id]`;
   - `/cobros`, `/notas-credito`, `/tasas`, `/contratos`;
   - `/gastos` y la ficha de empleado;
   - `/cotizaciones`, su ficha y `/c/[token]`;
   - `/usuarios`, `/perfil` y `/estandares`;
   - además, los diálogos principales de cada pantalla, el loader global y la barra de navegación.
   - Hecho cuando: cada pantalla queda marcada en el checklist, y las diferencias con el artboard están corregidas o anotadas como pendiente con motivo.
92. **Catálogo y cierre**: actualizar en `spec.md` la tabla de componentes (`FileteLaton` sin "propuesta"; `PeneroStripes`/`PeneroSweep` como retirados) y la tabla de decisiones P-UI con lo aprobado. Después, `npm run lint`, `npx tsc --noEmit` y `npm run build`.
   - Hecho cuando: los tres comandos pasan y la spec describe lo que hay en el código.

## Fase 4 — Design system (planificada el 2026-10-29)

Lo pidió el usuario el 2026-10-29, tras la auditoría con capturas de la Fase 3a. Reglas y valores en `spec.md` § «Design system (Fase 4)». Referencia: el lienzo «Design system Altamar» citado ahí (artboards 1–4).

- **Reemplaza** a las Fases 3b, 3c y 3d (ver la tabla de correspondencia en la Fase 3b).
- **Depende** de la Fase 3a, mergeada en `dev` el 2026-10-29 (#20). Las ramas de la Fase 4 salen de `dev`.
- La paleta Puerto, P-UI1–P-UI10 y la tipografía Fraunces + Instrument Sans **no cambian**.
- Las decisiones DS-1 a DS-8 las aprobó el usuario el 2026-10-29 tal como se propusieron.

**Después de cada tarea: `npm run lint` y `npx tsc --noEmit` en verde** antes de seguir. La API pública de los componentes existentes se mantiene compatible: se agregan props, no se rompen consumidores. Lo que se depreca se anota en el componente y se retira en la tarea 158.

**Ramas sugeridas** (una por bloque o grupo de bloques; regla 1 del flujo Git):
- `feat/ds-fundamentos`: 4a + 4b;
- `feat/ds-patrones`: 4c + 4d;
- `feat/ds-marca`: 4e;
- `feat/ds-catalogo`: 4f;
- `feat/ds-migracion-<grupo>`: 4g, una por grupo de pantallas.

**Orden y paralelismo**:

| Bloque | Depende de | ¿En paralelo? |
|---|---|---|
| 4a — Decisiones, inventario, tokens y theme | 3a | Secuencial: casi todo toca `theme.ts`. 93 y 94 son solo documentales y pueden ir en paralelo con 95–102 |
| 4b — Primitivos | 4a | 103, 104, 106–110 son archivos nuevos o distintos y van en paralelo. 105 toca `theme.ts`: no la hace otra rama a la vez |
| 4c — Patrones | 4b | Hay tres grupos en paralelo: (111→112) en `AppDataGrid`; (114→115) en formularios; 116 en `AppDialog`. 113, 118, 119, 120 y 121 tocan archivos distintos y van en paralelo con esos grupos |
| 4d — Carga, feedback y fallbacks | 4c (124 y 127 tocan `AppDataGrid` después de 112; 126 antes de 127) | 122→123 secuencial; 125, 126, 128, 129 y 130 en paralelo |
| 4e — Marca y decorativo heredado | 4a | **En paralelo con 4b–4d**, porque toca otros archivos. Excepciones: 140 edita `theme.ts` y `marca.ts`, y va al final, cuando 105 esté hecha; 136 (`AppShell`) no corre a la vez que otra tarea sobre `AppShell` |
| 4f — Catálogo vivo `/estandares` | 141 puede ir apenas termina 4a; 142–145, después del bloque que muestran | Ninguna tarea de 4a–4e edita `estandares-screen.tsx`: todo lo que se muestra entra en 4f. 142–145 van en paralelo entre sí (un archivo por sección, tras 141) |
| 4g — Migración y verificación | 4b–4d (y 4e para 160) | 147–157 van en paralelo **por grupo de pantallas** (archivos disjuntos, ver cada tarea); 158→159→160→161, secuencial al final |

### Fase 4a — Decisiones, inventario, tokens y theme

93. **Decisiones DS-1 a DS-8**: presentarlas al usuario con su propuesta (`spec.md` § «Decisiones de la Fase 4»).
   - Hecho cuando: cada fila tiene «aprobada», el valor elegido o «abierta, se ejecuta la propuesta». Si DS-1 se rechaza, la tarea 105 se ejecuta en su variante B. Si DS-4 pide páginas dedicadas, se replanifica la tarea 151 antes de ejecutarla.
   - **Hecho 2026-10-29** (rama `docs/design-system`): el usuario aprobó las ocho propuestas sin cambios; tabla de `spec.md` actualizada.
94. **Inventario de componentes**: recorrer `src/components/**` (~150 archivos) y `src/app/**/*-screen.tsx`, y llenar en `spec.md` una tabla «Unificación» bajo § «Catálogo e inventario». Columnas: componente, rol (primitivo / patrón / dominio), duplicado de…, destino (se queda / se apoya en X / se retira) y tarea de la Fase 4 que lo resuelve. Parte de los duplicados ya listados en la spec.
   - Hecho cuando: todo componente de `atoms`, `molecules` y `templates`, más los `organisms` genéricos, figura en la tabla. Los de dominio sin duplicado pueden agruparse en una fila.
   - **Hecho 2026-10-29**: tabla «Unificación» completa en `spec.md` con todos los componentes de `atoms`, `molecules`, `templates`, organismos genéricos y patrones de pantalla agrupados por categoría y asignados a su tarea de destino.
95. **`src/theme/tokens.ts`** (nuevo):
   - `MOTION`: duraciones `rapida` 120, `media` 200, `lenta` 280 y `salida` 180; curvas `entrada` y `salida`;
   - `TIEMPOS`: `LOADER_RETARDO_MS` 150, `LOADER_MINIMO_MS` 400, `NAV_RETARDO_MS` 100, `TOAST_MS` 5000, `RESALTADO_MS` 2000;
   - `ESPACIO`: los usos semánticos de la tabla «Espaciado», en unidades de `theme.spacing`;
   - `SOMBRAS`: `elevacion1` y `elevacion2`, claro y oscuro.

   En `theme.ts`, `transitions.duration` y `transitions.easing` se alimentan de `MOTION`, con el mapeo comentado (`shortest`/`shorter` → rápida, `short`/`standard` → media, `enteringScreen`/`complex` → lenta, `leavingScreen` → salida).
   - Hecho cuando: `tokens.ts` compila sin `any`, `theme.transitions.duration.shortest === 120` y ningún componente nuevo de la Fase 4 escribe milisegundos.
   - **Hecho 2026-10-29**: `src/theme/tokens.ts` creado y tipado; `theme.transitions` configurado con `MOTION` y mapeo documentado (`shortest: 120`).
96. **`theme.ts` — tokens de superficie y color** (aumento de módulos, claro y oscuro, valores de `spec.md` § «Superficies por nivel» y «Color y jerarquía»):
   - `background.elevated` y `background.field`;
   - `inputBorder` oscuro → `#5E7194`;
   - `rowDivider`, `dialogDivider`, `scrim`, `focusRing`, `highlight` y `outlineBorder`;
   - `segmented` (`track`, `selected`, `selectedHover`, `selectedText`, `selectedShadow`);
   - `neutral` como `PaletteColor` con `soft`/`onSoft`;
   - `dot` en `PaletteColor`;
   - fondos `soft` oscuros **opacos** para `warning`/`success`, calculando el 16 % sobre `#121F35` y anotando el hex resultante en un comentario. `error.soft` oscuro → `#3D2228`.

   Los valores *(DS-8)* llevan un comentario `// DS-8`.
   - Hecho cuando: cada token existe como variable CSS (`--mui-palette-background-elevated`, `--mui-palette-segmented-track`, etc.) en ambos esquemas, tipa sin `any`, y los hex nuevos viven solo en `theme.ts`.
   - **Hecho 2026-10-29**: aumento de módulos completo en `theme.ts` para ambos esquemas. CSS variables generadas para superficies, divisores, controles de segmentado y tonos semánticos con opacos para dark mode comentados con `DS-8`.
97. **Superficies elevadas sin la capa de MUI**. Leer en `node_modules/@mui/material/styles/` cómo se generan `overlays` y `--Paper-overlay` en la versión instalada, y anularlos: con `overlays` vacío o `'none'` en el esquema oscuro, o con `backgroundImage: 'none'` en `MuiPaper`. Documentar el mecanismo elegido en un comentario de `theme.ts` y en `spec.md` § «Superficies por nivel». Después:
   - `MuiDialog` `paper`: `background.elevated`, `SOMBRAS.elevacion2` y borde `dialogDivider` en oscuro;
   - `MuiBackdrop`: `scrim`;
   - `MuiMenu`, `MuiPopover` y `MuiAutocomplete` `paper`: `background.elevated` + `elevacion1` (reemplaza `shadows[8]`);
   - `MuiDrawer` temporal: `elevacion2`.
   - Hecho cuando: en oscuro, con las herramientas del navegador, el `Paper` del modal no tiene `background-image`, y el encabezado, el cuerpo y el pie dan `#1A2A45`. Un menú abierto sobre la página da `#1A2A45`.
   - **Hecho 2026-10-29**: anulada capa automática de elevación con `overlays: Array(25).fill('none')` en dark mode y `backgroundImage: 'none'` en `MuiPaper.styleOverrides.root`. Superficies elevadas (`MuiDialog`, `MuiMenu`, `MuiPopover`, `MuiAutocomplete`, `MuiDrawer` modal) configuradas con `background.elevated` (`#1A2A45` en oscuro) y sombras de `tokens.ts`. Scrim para `MuiBackdrop`. Mecanismo documentado en `theme.ts` y `spec.md`.
98. **Campo en el theme** (`MuiOutlinedInput`, `MuiInputBase`, `MuiFormHelperText`):
   - fondo `background.field`, borde `inputBorder`, hover `text.secondary`;
   - foco: en claro, borde `primary` + anillo `focusRing` de 3 px; en oscuro, borde `#D4B27A` de 2 px;
   - error con `error.main`;
   - alto de 40 px en `size="small"`;
   - ayuda de 12 px a 6 px del campo;
   - adornos (`InputAdornment`) en `text.secondary`.

   Se reemplaza `backgroundColor: 'var(--mui-palette-background-paper)'` (línea ~220).
   - Hecho cuando: en oscuro, un campo dentro del modal se ve más oscuro que la superficie y con borde visible (≥ 3:1, se verifica en 159), y no «hueco».
   - **Hecho 2026-10-29**: `MuiOutlinedInput` actualizado con `background.field`, borde `inputBorder`, hover `text.secondary`, foco y error; alto 40px en `size="small"` sin limitar textareas; `MuiFormHelperText` a 6px y `MuiInputAdornment` en `text.secondary`.
99. **Foco y jerarquía de color en el theme**:
   - `MuiButtonBase` `.Mui-focusVisible` con `focusRing` (reemplaza el contorno de `primary`, líneas ~205–212);
   - `MuiButton`: `variant="text"` y `variant="outlined"` con `color="primary"` pasan a `text.primary`, con borde `outlineBorder` en `outlined` (variants del theme, sin tocar consumidores); `contained` sin cambio;
   - `MuiTabs`: indicador y pestaña seleccionada en `text.primary`;
   - `MuiSwitch`, `MuiCheckbox` y `MuiRadio` seleccionados en `text.primary`, con el track del switch en `text.primary` al 100 % y el pulgar en `background.paper`;
   - `MuiLink` en `text.primary` con subrayado;
   - `MuiChip` clicable o `filled` con `color="primary"` en neutro.
   - Hecho cuando: en oscuro, el único latón visible en `/clientes` y en un modal abierto es el botón principal y el foco. Comprobarlo con `rg "color=\"primary\"" src/components` sin cambiar nada de esos archivos.
   - **Hecho 2026-10-29**: foco visible con `focusRing`, botones text y outlined en `text.primary`, tabs, switch, checkbox, radio, link en `text.primary`, y chip primary en neutro. Verificado con `rg` que el único botón con latón en oscuro es el primario `contained`.
100. **Tipografía**: agregar las variantes `label` (13/1.4/500) y `sectionTitle` (16/1.4/600) en `typography`, con aumento de `TypographyVariants`, `TypographyVariantsOptions` y `TypographyPropsVariantOverrides`. El encabezado de `MuiTableCell` y `MuiDataGrid` pasa a leer `theme.typography.subtitle2` en lugar de repetir `0.75rem`/`0.04em` (líneas ~306–340).
   - Hecho cuando: `<Typography variant="label">` y `variant="sectionTitle"` tipan y miden lo indicado, y `rg "0\\.04em" src/theme/theme.ts` solo encuentra `subtitle2`.
   - **Hecho 2026-10-29**: variantes `label` y `sectionTitle` creadas y tipadas; encabezados de tabla migrados a `...theme.typography.subtitle2`; `rg "0\\.04em"` sólo encuentra `subtitle2`.
101. **Tabla en el theme** (`MuiDataGrid`):
   - encabezado de 40 px con el fondo `background.subtle` también en el relleno a la derecha (`.MuiDataGrid-filler`, `--DataGrid-containerBackground`, encabezado vacío);
   - celdas con `display: flex; align-items: center`;
   - divisor `rowDivider`;
   - hover de fila `background.subtle`;
   - sin fondo de fila seleccionada;
   - icono de orden sin círculo (botón del encabezado transparente, `fontSize="small"`).
   - Hecho cuando: en `/estandares` (sección existente de tablas) el encabezado llega al borde derecho y la flecha no tiene fondo blanco.
   - **Hecho 2026-10-29**: `MuiDataGrid` con encabezado 40px extendido al filler, celdas centradas, divisores `rowDivider`, hover suave, sin selección de fila por fondo e icono de orden sin círculo ni fondo blanco.
102. **`src/app/globals.css` y skeleton**:
   - keyframe `puerto-highlight` (fondo `var(--mui-palette-highlight)` → transparente);
   - regla global de `prefers-reduced-motion: reduce` (animaciones y transiciones a 0,01 ms, una iteración);
   - `MuiSkeleton` con `animation: 'pulse'` (DS-7) y color `background.subtle`;
   - `MuiSnackbar` sin cambio (se hace en 108).

   Los keyframes `penero-*` se quedan hasta la tarea 140.
   - Hecho cuando: con «reducir movimiento» del sistema activado, el skeleton y la barra de navegación quedan quietos.
   - **Hecho 2026-10-29**: keyframe `puerto-highlight` y regla global `prefers-reduced-motion: reduce` agregados a `globals.css`; `MuiSkeleton` configurado con pulso y fondo `background.subtle`.

### Fase 4b — Primitivos

103. **`src/components/atoms/SegmentedControl.tsx`** (nuevo). Va sobre `ToggleButtonGroup exclusive`, con estilos de los tokens `segmented` (`spec.md` § «Primitivos»).
   - Props: `value`, `onChange(value)`, `options: { value, label, count?, icon? }[]`, `aria-label` (obligatorio), `size` (`medium` 32 px por defecto), `fullWidth`, `disabled`.
   - Siempre hay una opción elegida (ignora el `null` de deselección).
   - Navegación con flechas.
   - El contador va en `caption` y `text.secondary`, y se anuncia en el nombre accesible ("Activos, 12").
   - En `xs` hace scroll horizontal dentro de su contenedor, sin desbordar la página.
   - Hecho cuando: compila, en claro y oscuro la opción elegida se distingue sin depender solo del color (por peso y sombra) y el teclado funciona.
   - **Hecho 2026-10-29**: Creado `src/components/atoms/SegmentedControl.tsx` con tokens `palette.segmented`, selección distinguible en ambos modos, navegación accesible con flechas y scroll en `xs`.
104. **`src/components/atoms/EstadoChip.tsx`** (nuevo):
   - `tono` (`error` \| `warning` \| `success` \| `neutral`), `label`, `tooltip?`;
   - 22 px, radio 4, punto de 6 px (`dot`), texto 12/600, colores `soft`/`onSoft`.

   `organisms/appDataGridColumns.tsx` reexporta `EstadoChip` (el actual pasa a ser este, con mapeo de su `color` a `tono`). Rebasar sobre él, sin cambiar sus props:
   - `molecules/StatusChips.tsx`: "Activo" ya no se muestra y `mostrarActivo` queda deprecado sin efecto; Inactivo `neutral`, Bloqueado `error`, Doc. incompleta `warning`;
   - `atoms/EstadoCarteraChip.tsx`: Anulada `neutral`;
   - `molecules/CotizacionEstadoChip.tsx`: Borrador, Rechazada y Anulada `neutral`, Vencida `error`; Enviada y Aceptada como texto sin chip (estados normales, `spec.md` § «Primitivos»);
   - `atoms/SenalFacturaChip.tsx` (`SenalFacturaChip`, `NivelSenalChip`).

   `LoteChip` y `TasaChip` son etiquetas de identidad y no de estado: pasan a `neutral` sin punto.
   - Hecho cuando: `rg "variant=\"soft\"" src/components src/app` solo encuentra `EstadoChip`, `LoteChip` y `TasaChip`.
   - **Hecho 2026-10-29**: Creado `src/components/atoms/EstadoChip.tsx` (22 px, dot 6 px, tonos semánticos con soft/onSoft). Rebasados `appDataGridColumns.tsx`, `StatusChips.tsx` (retirado «Activo»), `EstadoCarteraChip.tsx`, `CotizacionEstadoChip.tsx`, `SenalFacturaChip.tsx`, `LoteChip.tsx` y `TasaChip.tsx`. Verificado que solo tres componentes en todo el codebase usan `variant="soft"`.
105. **Campo con etiqueta fija arriba (DS-1)**, en `theme.ts`:
   - variante A (propuesta):
     - `MuiInputLabel`: `defaultProps.shrink: true`, estática (`position: relative`, `transform: none`), en `label` y `text.primary`, con 6 px hasta el campo;
     - `MuiOutlinedInput`: `defaultProps.notched: false` y sin `legend`;
     - `MuiTextField` y `MuiFormControl` sin margen extra;
     - el asterisco de requerido en `text.secondary`.

     Verificar `NumberField`, `PhoneField`, `RifCiField`, `Select`, `Autocomplete`, `TasaSelector` y los adornos `$`/`kg`.
   - variante B (si DS-1 se rechaza): se mantiene la etiqueta flotante, pero los campos con adorno quedan con la etiqueta siempre encogida, para que «Costo/kg» se comporte igual que el resto.
   - Hecho cuando: en `/estandares` y en un `ClienteForm` abierto, todas las etiquetas quedan arriba y alineadas, «Costo/kg $» igual que las demás, y sin cambios en los archivos consumidores.
   - **Hecho 2026-10-29**: Configurada etiqueta estática arriba (DS-1) en `theme.ts` con `shrink: true`, sin hendidura en `MuiOutlinedInput` (`notched: false`, sin `legend`), asterisco en `text.secondary` y márgenes normalizados.
106. **`src/components/atoms/DateField.tsx`** (nuevo), sobre `DatePicker` de `@mui/x-date-pickers` (ya en `package.json`):
   - `value`/`onChange` en ISO `YYYY-MM-DD` \| `null`, formato `DD/MM/YYYY`;
   - `minDate`/`maxDate` en ISO, `error`, `helperText`, `size="small"` y ancho mínimo de 160 px;
   - acepta `field` de `react-hook-form` vía `Controller`.

   Mover el `LocalizationProvider` (dayjs, locale `es`) de `molecules/RangoFechasSelector.tsx` a un proveedor global en `src/theme/ThemeRegistry.tsx` (o `src/app/layout.tsx`), y quitarlo de `RangoFechasSelector`.
   - Hecho cuando: el campo muestra `29/10/2026`, devuelve `'2026-10-29'` y `RangoFechasSelector` sigue funcionando.
   - **Hecho 2026-10-29**: Creado `src/components/atoms/DateField.tsx` (formato `DD/MM/YYYY`, valor ISO, 40 px, compatible con RHF). Movido `LocalizationProvider` (dayjs, es) a nivel global en `ThemeRegistry.tsx`.
107. **`src/components/atoms/SubmitButton.tsx`** (nuevo): `Button` `contained` con `type="submit"` por defecto, `pending`, `pendingLabel` (por defecto "Guardando…") y `loading={pending}` + `loadingPosition="start"`. Mide su ancho en reposo y lo fija como `minWidth` mientras está `pending`, para que no salte. Si se le pasa `onClick`, ignora los clics mientras está `pending`.
   - Hecho cuando: al pasar a `pending`, el botón no cambia de ancho y muestra spinner + "Guardando…".
   - **Hecho 2026-10-29**: Creado `src/components/atoms/SubmitButton.tsx` con fijación dinámica de `minWidth` para prevenir saltos de ancho en estado `pending`, bloqueo de clics y spinner + texto en curso.
108. **Toast** (`organisms/NotificationProvider.tsx`, `lib/useNotify.ts`):
   - `notify.success/error/info(msg, opciones?)` con `opciones.action` (`{ label, href } | { label, onClick }`); las 97 llamadas actuales con un solo string no cambian;
   - contenido propio en lugar de `Alert filled`: fondo `brand.midnight`, texto `brand.onMidnight`, ícono de check `success.soft` (error: ícono `error` en su tono claro), acción en `brand.brass` como botón de texto, cerrar con `aria-label`;
   - `elevacion1`, `Slide` desde abajo con `MOTION.media` y `TIEMPOS.TOAST_MS`;
   - `role="status"` (éxito/info) o `role="alert"` (error);
   - abajo a la derecha, y abajo al centro en `xs`, por encima del `Fab` del `PageHeader`;
   - la cola actual se conserva.
   - Hecho cuando: un toast con `action: { label: 'Ver', href }` navega y cierra, y el toast se ve igual en ambos modos.
   - **Hecho 2026-10-29**: Rediseñado Toast en `NotificationProvider.tsx` y `useNotify.ts` con fondo `brand.midnight`, borde `dialogDivider` en oscuro, iconos semánticos claros, botón de acción en latón (`brand.brass`), botón cerrar accesible, roles `status`/`alert`, y Slide desde abajo a 80 px en `xs` (sobre el Fab).
109. **`src/components/molecules/FilterMenuButton.tsx`** (nuevo):
   - props `label` ("Tipo"), `value`, `onChange`, `options`, `multiple?` y `todosLabel` ("todos");
   - el botón `outlined` muestra "Tipo: todos" o "Tipo: Crudo", y "Tipo: 2" si hay varias opciones elegidas;
   - el menú tiene `elevacion1`, `Checkbox` o `Radio` según `multiple`, y "Limpiar".
   - Hecho cuando: compila y funciona con teclado.
   - **Hecho 2026-10-29**: Creado `src/components/molecules/FilterMenuButton.tsx` con botón `outlined`, soporte para selección única (Radio) y múltiple (Checkbox), contador en etiqueta, elevación 1 y acción "Limpiar".
110. **`molecules/RowActionsMenu.tsx`**:
   - disparador `IconButton` de 32 px (44 px de área en `xs`);
   - las opciones `destructive` van en `error.main` dentro del menú, separadas por un divisor;
   - el menú tiene `elevacion1`;
   - `pending` sin cambio.
   - Hecho cuando: las tablas existentes muestran el `⋮` de 32 px sin cambios en los consumidores.
   - **Hecho 2026-10-29**: Actualizado `src/components/molecules/RowActionsMenu.tsx` con disparador de 32 px (44 px en `xs`), elevación 1 y opciones `destructive` en `error.main` agrupadas y separadas por `Divider`.

### Fase 4c — Patrones

111. **`AppDataGrid`, barra de herramientas** (`organisms/AppDataGrid.tsx`, ~líneas 463–500):
   - búsqueda de 340 px (100 % en `xs`);
   - prop nueva `estados?: { value, onChange, options }`, que renderiza un `SegmentedControl` a la derecha de la búsqueda;
   - `filters` (sin cambio de tipo) pensado para `FilterMenuButton`;
   - `actions` a la derecha;
   - prop `onClearFilters?`, que usa el «Sin resultados» de la tarea 127.
   - Hecho cuando: la tabla de `/estandares` con `estados` se ve como el artboard 2 y las tablas sin `estados` no cambian.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): tabla de `/estandares` con `estados`: no se mostró aún porque `estandares-screen.tsx` es de la 4f (144). `onClearFilters` se pasa solo con algún filtro activo; entonces la tabla vacía muestra «Sin resultados» con «Limpiar filtros».
112. **`AppDataGrid`, cuerpo y columnas** (`AppDataGrid.tsx`, `appDataGridColumns.tsx`):
   - `rowHeight` 56 (línea ~546) y `columnHeaderHeight` 40;
   - si ninguna columna tiene `flex`, la primera de texto recibe `flex: 1` y `minWidth`, así las columnas llenan el ancho;
   - el pie de paginación se oculta con 0 filas;
   - helper nuevo `colPrincipal({ field, headerName, secundario: (row) => string | null })`: nombre en `body2` 500 y secundario en `caption` `text.secondary`, en la misma celda;
   - `colMonto` con `destacarPositivo` (600 si > 0);
   - `valueFormatter` por defecto "—" para `null`/`''` en las columnas helper;
   - `mobileCard` con la misma jerarquía.
   - Hecho cuando: una tabla de una línea mide 56 px por fila, las columnas cubren el ancho a 1440 px y la tabla vacía no muestra «0–0 de 0».
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): la primera columna sin `type` (o `string`) que no sea la de acciones pasa a `flex: 1` con su ancho como mínimo. `colEstado` muestra «—» sin valor.
113. **`molecules/PageHeader.tsx`**: título `h4` y subtítulo `body2` `text.secondary` con 4 px entre ellos, la acción principal alineada al título y 48 px hasta el bloque siguiente (lo pone el contenedor de la página, ver 136). El `Fab` de `xs` hereda el radio 6 y `primary` (absorbe la tarea 78).
   - Hecho cuando: los listados muestran título, subtítulo y acción como el artboard 2.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): la acción se alinea arriba con el título (`flex-start`) y el encabezado deja 48 px (32 en `xs`) con `ESPACIO.bloquesPagina` mientras la 136 no lleve ese espacio al contenedor. El `Fab` ya tenía radio 6 y `primary` en el theme.
114. **Formulario: `FormSection`, `FormGrid` y `FormSubgroup`**:
   - `molecules/FormSection.tsx`:
     - encabezado `sectionTitle` con divisor **inferior** y 16 px hasta el contenido;
     - 40 px entre secciones (lo da el contenedor, así la primera no lleva margen);
     - `ayuda` en `body2` bajo el título, **sin** el `mt: -1.25` actual (causa del encimado en Configuración);
     - se mantiene la semántica `fieldset` y `legend`, pero el `legend` deja de ser hijo de la grilla (envolverlo o usar `role="group"` + `aria-labelledby`), para que no se monte sobre la ayuda;
     - `dense` y `primera` siguen aceptándose (`primera` queda sin efecto visual).
   - `molecules/FormGrid.tsx` (nuevo): 1 columna en `xs` y 2 en `sm+`, 24 vertical y 16 entre columnas; `FormGrid.Full` o la prop `full` en el hijo para ocupar el ancho completo.
   - `molecules/FormSubgroup.tsx` (nuevo): etiqueta `label` + contenido, sin divisor.

   Absorbe la tarea 80.
   - Hecho cuando: en `ConfigNegocioForm`, el título «Configuración del negocio» no se monta sobre su descripción, y en `/estandares` los espaciados miden 16/24/40.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): `FormSection` pasa a `role="group"` + `aria-labelledby` con `h3`; dentro de un modal el divisor usa `dialogDivider`. Los 40 px entre secciones los pone cada contenedor de formulario: se aplican al migrar (150–151); hoy los contenedores siguen con su `gap` propio. `FormGrid.Full` para el ancho completo (no se agregó una prop `full` al hijo: los campos MUI no la aceptan en sus tipos).
115. **`molecules/LineasEditor.tsx`** (nuevo). Es solo disposición y **no** usa `useFieldArray` (eso lo pone el consumidor):
   - props `columnas: { key, label, width, align? }[]`, `filas`, `renderCelda(fila, columna)`, `onAgregar`, `onQuitar(index)`, `agregarLabel` ("Agregar línea"), `disabled` y `totales?: ReactNode`;
   - una fila de encabezados en `label`, y las celdas ocultan la etiqueta del campo (`aria-label` desde la columna);
   - papelera `IconButton` de 36 px alineada al centro del campo, con `aria-label="Quitar línea N"`;
   - "Agregar línea" como botón de texto debajo;
   - totales a la derecha bajo un divisor;
   - `Collapse` por fila;
   - en `xs`, cada línea es un bloque con etiquetas visibles y la papelera arriba a la derecha.
   - Hecho cuando: compila y una demo local con dos líneas no tiene cajas anidadas.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): la etiqueta de cada campo queda oculta a la vista en `sm+` (sigue siendo su nombre accesible), en vez de un `aria-label` aparte. `renderCelda` recibe además el índice. La demo con dos líneas va en `/estandares` (144).
116. **`organisms/AppDialog.tsx` + `molecules/ConfirmDialog.tsx`**:
   - una sola superficie: quitar `bgcolor: 'background.paper'` del pie (líneas ~262 y ~279);
   - encabezado, cuerpo y pie separados por `dialogDivider` (siempre en el pie y en el encabezado; los divisores por scroll se conservan como refuerzo);
   - padding de 24 (16 en `xs`);
   - tamaño nuevo `lg` (1120 px, pantalla completa por debajo de `md`);
   - `error` pasa **arriba del contenido**, con la prop nueva `onRetry?` ("Reintentar" en la `Alert`);
   - "Cancelar" como botón de texto en `text.secondary` (ya lo es);
   - transición propia: fundido + `translateY(8px)` → 0 con `MOTION.lenta` y `MOTION.salida`, y `Slide` sin cambio en pantalla completa;
   - `ConfirmDialog` con la misma superficie y padding.

   Absorbe la tarea 83.
   - Hecho cuando: en oscuro, el modal de «Nuevo producto» se ve en un solo tono, con los campos más oscuros que la superficie y el pie sin franja propia.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): la transición quedó en el theme (`MuiDialog`: `keyframes` de 8 px + `Fade`, 280/180 ms; sin animación en pantalla completa), así también la toma `ConfirmDialog`. Con scroll, una sombra interior de 1 px bajo el encabezado refuerza el divisor. `ConfirmDialog` no se cierra mientras `loading`.
117. **Regla modal o página (DS-4)**: con DS-4 respondida, anotar en `spec.md` § «Patrones › Formulario» la lista final de formularios por tamaño (`sm`/`md`/`lg`), revisando `rg "size=\"(xs|sm|md)\"" src/components/organisms`. Es solo documental; la aplicación va en 150–151.
   - Hecho cuando: cada `AppDialog` del código tiene un tamaño asignado en la lista.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): lista en `spec.md` § «Patrones › Formulario». `ProveedorForm` queda en `md` como excepción (asistente por pasos).
118. **Ficha: `molecules/FichaHeader.tsx` + `molecules/FichaSeccion.tsx`**:
   - la vuelta pasa de `secondary` a `text.secondary` con ícono `fontSize="small"`;
   - nombre `h5` (`component="h1"`) y `meta` en `body2`/`caption`;
   - `FichaSeccion` como superficie de nivel 0 (radio 8, borde `divider`, título `h6`, acción a la derecha);
   - 48 px entre secciones.

   Absorbe la tarea 79.
   - Hecho cuando: las fichas existentes muestran el encabezado sin latón y sin cambios de props.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): los 48 px entre secciones los pone el contenedor de la ficha; se aplican en la migración de fichas (154).
119. **`molecules/KpiCard.tsx` + `molecules/CarteraResumenCards.tsx` + `organisms/DocumentosCarteraTable.tsx`**:
   - `KpiCard`:
     - título `subtitle2`, cifra `h5` y `tone` con ícono (absorbe la tarea 81);
     - Skeleton con `sx={{ typography: 'h5' }}`;
     - variante seleccionable nueva (`selected`, `onClick`, `aria-pressed`), con el borde de 2 px en `text.primary` cuando está seleccionada.
   - `CarteraResumenCards` se apoya en esa variante.
   - `DocumentosCarteraTable` recibe `ocultarFiltroEstados` y, si el filtro lo controlan las tarjetas, no muestra sus propios chips de estado.
   - Hecho cuando: en la ficha de cliente y en `/cobros`, Vencidas/Por vencer/Pendientes/Pagadas aparecen una sola vez, y al tocar una tarjeta la tabla se filtra.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): `DocumentosCarteraTable` con `ocultarFiltroEstados` en `/cobros` y en la ficha de cliente; «Ver anuladas» sigue como chip hasta la migración de listados (148).
120. **`molecules/DocumentoUpload.tsx` + `molecules/DocumentosRequeridos.tsx`**:
   - cada documento cargado es una fila (ícono del tipo, nombre, fecha en `caption`, "Ver" como botón de texto, `⋮` con "Reemplazar" y "Eliminar" vía `ConfirmDialog`), sin caja punteada;
   - la zona para soltar archivos solo aparece si no hay archivo;
   - en `DocumentosRequeridos`, la lista va sin cajas anidadas y con el estado como `EstadoChip` (`warning` si falta);
   - `disabled` y `loading` sin cambio.
   - Hecho cuando: la ficha de cliente y la de proveedor muestran los documentos sin cajas anidadas ni papelera roja visible.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): `DocumentoItem` no trae fecha: la línea secundaria muestra el tamaño del archivo. El estado solo se muestra cuando falta («Falta», `warning`): el documento cargado no lleva chip (principio 2).
121. **`molecules/ChartCard.tsx`, `ChartLegendTable.tsx`, `ListaResumen.tsx` y `CadenaTrazabilidad.tsx`**:
   - radio 8, borde `divider`, título `h6` sans y montos tabulares;
   - en `CadenaTrazabilidad`, `'& svg': { fontSize: 20 }` pasa a `fontSize="small"`;
   - `ListaResumen` con filas de 56 px y `rowDivider`.

   Absorbe la tarea 82.
   - Hecho cuando: el dashboard y `/facturas/[id]` se ven con superficies del sistema.
   - **Hecho 2026-10-30** (rama `feat/ds-patrones`): los íconos de `FacturaTrazabilidadLineas` pasan `fontSize="small"`.

### Fase 4d — Carga, feedback y fallbacks

122. **`src/components/atoms/Skeletons.tsx`** (nuevo):
   - `SkeletonTabla` (barra con búsqueda de 340 + segmentado, encabezado de 40, filas de 56), `SkeletonFicha`, `SkeletonKpis`, `SkeletonGrafico` y `SkeletonFormulario` (etiqueta + campo de 40 y secciones);
   - con pulso y medidas de `ESPACIO`.

   Rehacer `atoms/PageLoader.tsx` con ellos (misma API `variant` + `children`): el texto visible «Cargando…» pasa a una región `role="status"` visualmente oculta, y el registro en `useNavigationPending` se conserva. `organisms/DashboardSkeletons.tsx` y `CarteraSeccionSkeleton` reusan los primitivos.
   - Hecho cuando: cada variante de `PageLoader` coincide en medidas con su plantilla real (encabezado de tabla de 40 y filas de 56).
123. **Auditar los 23 `loading.tsx`** (`rg --files -g 'loading.tsx' src/app`): cada uno usa la variante de su plantilla (listado → `table`; `[id]` → `ficha`, con `children` si la ficha tiene secciones con `Suspense`; `(dashboard)` → `dashboard`; `(auth)` → el suyo). En las pantallas con `Suspense` por sección, el `fallback` es el skeleton de esa sección y no un `PageLoader`.
   - Hecho cuando: la tabla de los 23 archivos con su variante queda anotada en esta tarea y ninguno muestra un spinner.
124. **Resaltado de ítem afectado**:
   - `lib/useResaltado.ts` (nuevo): `resaltar(id)` → `idResaltado` durante `TIEMPOS.RESALTADO_MS`;
   - prop `highlightId` en `AppDataGrid` (`getRowClassName` + `puerto-highlight`) y en `ListaResumen`;
   - tras crear, la fila nueva se muestra en la página actual si está en ella, y si no, no se fuerza la navegación.
   - Hecho cuando: en `/estandares`, «simular alta» resalta la fila 2 s y, con movimiento reducido, solo cambia el fondo sin animar.
125. **Operaciones largas → `useGlobalLoader`**. Auditar las acciones de más de 1 s que bloquean: PDF de contrato (`GenerarContratoDialog`), PDF y compartir de cotización (`CompartirCotizacionDialog`, `EnlacePublicoCotizacion`), cierre o pérdida de lote (`useLoteAcciones`) y las importaciones, si existen. Las que hoy solo muestran `Button loading` y bloquean más de 1 s pasan a `useGlobalLoader().run(tarea, 'Generando contrato…')`. `lib/useGlobalLoader.tsx` toma `TIEMPOS.LOADER_RETARDO_MS` y `LOADER_MINIMO_MS` en lugar de sus constantes locales.
   - Hecho cuando: la lista de acciones auditadas, con su decisión, queda anotada en esta tarea.
126. **`src/components/molecules/Fallback.tsx`** (nuevo):
   - `tipo` (`vacio` \| `sin-resultados` \| `error` \| `sin-permiso` \| `no-encontrado`), con ícono por defecto según el tipo (`Outlined`);
   - el ícono va en un círculo de 44 px sobre `background.subtle`;
   - `titulo`, `texto` (≤ 75ch), `accion` y `compact`.

   `EmptyState` y `ErrorState` pasan a envolverlo (mismas props; `ErrorState` agrega «Tus datos están a salvo» y «Reintentar»).
   - Hecho cuando: los consumidores actuales de `EmptyState`/`ErrorState` compilan sin cambios.
127. **Overlays de `AppDataGrid`**:
   - `noRowsOverlay`: `Fallback vacio` con la acción de `emptyState`;
   - `noResultsOverlay`: `Fallback sin-resultados` («Sin resultados para «…»» o «Ningún registro con estos filtros») + «Limpiar filtros», que limpia la búsqueda y llama `onClearFilters`;
   - error: `Fallback error` con `onRetry`;
   - la paginación se oculta en los tres.
   - Hecho cuando: en `/estandares` se ven los tres estados sin «0–0 de 0».
128. **`src/components/organisms/RouteError.tsx`** (nuevo, `'use client'`): `mensaje`, `reset` y `digest?` (si existe, lo muestra en `caption` como «Código: …»). Los 21 `error.tsx` pasan a `<RouteError mensaje="No se pudieron cargar los clientes." reset={reset} digest={error.digest} />`.
   - Hecho cuando: `rg -l "ErrorState" src/app --glob 'error.tsx'` queda vacío y cada `error.tsx` tiene 3–10 líneas.
129. **404 y sin permiso**:
   - `src/app/not-found.tsx` global (no existe) y `src/app/(protected)/not-found.tsx`, ambos con `Fallback no-encontrado` + «Volver al inicio»;
   - los 7 `not-found.tsx` de ficha pasan a `Fallback no-encontrado` con su acción (texto actual conservado);
   - sin permiso: leer `node_modules/next/dist/docs/` sobre `forbidden()`/`forbidden.tsx`. Si es estable sin flag, usarlo en las rutas solo admin (`requireAdmin`); si no, `Fallback sin-permiso` desde la página;
   - `c/[token]/not-found.tsx` y `CotizacionNoDisponible` pasan a `Fallback` conservando el WhatsApp.
   - Hecho cuando: una URL inexistente dentro y fuera de la app muestra el fallback dentro del shell y fuera de él, respectivamente, y la decisión sobre `forbidden` queda anotada aquí.
130. **Dato faltante**: `lib/format.ts` agrega `conGuion(v: string | number | null | undefined, fmt?)` → «—» si está vacío. Las columnas helper de `appDataGridColumns` lo usan, y `formatFecha`/`formatHace` ya devuelven «—».
   - Hecho cuando: `colMonto`, `colKg`, `colTasa` y `colFecha` muestran «—» con `null`.

### Fase 4e — Marca y decorativo heredado de 3b

131. **`src/components/atoms/FileteLaton.tsx`** (nuevo; era la 70):
   - `variant: 'rule' | 'sweep'`, `height` (2 por defecto), `width` y `track`;
   - color `brand.brass`;
   - `sweep` con `puerto-sweep` y duración de `MOTION`/constante exportada, quieto con `prefers-reduced-motion` (cierra el pendiente (c)).
   - Hecho cuando: compila; se muestra en 142.
132. **`atoms/NavigationProgress.tsx`** (era la 71): `PeneroSweep height={3}` → `FileteLaton variant="sweep" height={3}` en el **borde superior** de la ventana (`position: fixed; top: 0`, por encima de la barra superior y del drawer). El retardo pasa a `TIEMPOS.NAV_RETARDO_MS`, y el registro de fuentes no cambia.
   - Hecho cuando: navegar entre secciones muestra la línea de latón arriba, sin mover el layout.
133. **`organisms/BrandLoader.tsx`** (era la 72):
   - isotipo + «Altamar Sea Food» en `h3` + `FileteLaton sweep` de 3 px y mensaje en `body2`;
   - fondo `scrim` sobre la página, o `background.default` a pantalla completa;
   - sin el vaivén `penero-bob`;
   - conserva el retardo, el mínimo y el contador (desde `TIEMPOS`, en `useGlobalLoader`), `role="status"` y la versión quieta.
   - Hecho cuando: «Entrando» (login) y «Cerrando sesión» muestran el loader nuevo.
134. **`atoms/BrandMark.tsx` + `src/lib/marca/isotipo.ts` + `src/app/icon.svg`** (era la 73): isotipo provisional Puerto (P-UI4) con proa en `brand.midnight` (o `brand.onMidnight` sobre medianoche) y filete `brand.brass`. La variante `full` lleva «Altamar» en Fraunces 600, y `size`/`orientation` no cambian. `icon.svg` se regenera con los hex claros de `marca.ts`.
   - Hecho cuando: el menú, el loader, el login y la pestaña del navegador no muestran franjas ocre ni rojas.
135. **`templates/AuthLayout.tsx` y `templates/DocumentoPublicoLayout.tsx`** (era la 74): panel `brand.midnight` con texto `onMidnight`/`onMidnightMuted`, logo y `FileteLaton rule` en lugar de `PeneroStripes`; en la página pública, el filete va bajo el encabezado.
   - Hecho cuando: `/login`, `/recuperar`, `/actualizar-password` y `/c/[token]` (vigente y respaldo) no usan franjas.
136. **`templates/AppShell.tsx`** (era la 77):
   - sidebar `brand.midnight` en ambos esquemas;
   - nombre en Fraunces y `FileteLaton rule` de 2 px bajo el logo;
   - el ítem activo lleva fondo `brand.navy`, un **punto de latón de 6 px** en lugar de `ActiveStripes` (líneas ~177–200) y texto `onMidnight`; los inactivos van en `onMidnightMuted` y, en hover, `navy` al 60 %;
   - el riel `sm` y el drawer `xs` llevan el mismo tratamiento;
   - barra superior `background.paper` con borde `divider`;
   - contenido con márgenes de 16/24/**64** (`lg+`) y 48 px entre bloques (`ESPACIO`);
   - foco visible sobre medianoche.
   - Hecho cuando: `rg "brand\\.(ochre|red|trim)" src/components/templates/AppShell.tsx` queda vacío y los tres breakpoints se ven bien.
137. **`molecules/CreditoResumen.tsx`** (era la 75, **revisada**):
   - pasa a superficie de nivel 0 (`background.paper`, borde `divider`, radio 8) en lugar del bloque `brand.hull`, porque la Fase 4 no admite bloques de color ni latón fuera de lo permitido;
   - la cifra disponible en `h5`;
   - la barra de uso va en `text.primary` sobre `background.subtle`, y pasa a `error.main` + ícono `ErrorOutlineOutlined` + texto «Límite superado» al superar el límite;
   - textos en `text.secondary`.
   - Hecho cuando: la ficha de cliente muestra el bloque sin `brand.*` y con el estado de exceso comunicado por texto.
138. **PDF y correo con la marca nueva** (era la 76; tarea agregada en `21-cotizaciones` y `09-cuentas-por-cobrar`):
   - `lib/pdf/fuentes.ts` y `lib/pdf/fuentes/LEEME.md`: Fraunces 600 e Instrument Sans 400/600 en TTF estáticos (OFL), con Helvetica de respaldo;
   - `lib/pdf/marca.tsx`: filete de latón en lugar de franjas;
   - `lib/cotizaciones/pdf/CotizacionPdf.tsx`: `MARCA_CLARO.hull` → `MARCA_CLARO.midnight`;
   - `lib/cartera/recordatorios/plantillas.ts`: colores del correo desde las claves Puerto.
   - Hecho cuando: `npx tsx scripts/probar-cotizaciones.ts --pdf` genera el PDF con la marca nueva y la vista previa de `RecordatorioDialog` no lleva franjas.
139. **Gráficos** (era la 85, P-UI9): `lib/dashboard/chartColors.ts` toma `categorias` de `palette.chart`, quita la referencia a `brand.*` y revisa que `usd`/`kg`/`positivo` no coincidan en tono. En `organisms/BarLineChart.tsx`, el `labelStyle` `fontSize: 12` pasa a `theme.typography.caption`.
   - Hecho cuando: las series del dashboard se distinguen en claro y oscuro.
140. **Retirar Peñero** (era la 88; al final de 4e, con 105 hecha):
   - borrar `atoms/PeneroStripes.tsx`;
   - borrar las claves `hull`, `hullDeep`, `onHull`, `onHullMuted`, `ochre`, `red` y `trim` de `BrandPalette` (`theme.ts`) y de `MarcaPaleta` (`marca.ts`);
   - borrar los keyframes `penero-*` de `globals.css`;
   - borrar el comentario «Barlow» de `KpiCard`.
   - Hecho cuando: `rg -i "penero|hull|ochre|brand\\.red|brand\\.trim|barlow" src` no encuentra nada.

### Fase 4f — Catálogo vivo `/estandares`

141. **Estructura**: partir `src/app/(protected)/estandares/estandares-screen.tsx` (~700 líneas) en `estandares/secciones/` (`Fundamentos.tsx`, `Primitivos.tsx`, `Patrones.tsx`, `CargaFeedback.tsx`, `Fallbacks.tsx`, y lo que quede de `Dashboard`) más un índice con anclas. Agregar «Ambos modos» (claro y oscuro lado a lado), aplicando `data-mui-color-scheme` a un contenedor. Antes, verificar que las variables de MUI se resuelven por ese atributo anidado; si no, usar el toggle global y anotarlo. La ruta sigue solo para desarrollo y admin.
   - Hecho cuando: la página carga con el índice y el contenido actual sin perder nada.
142. **Fundamentos**: superficies por nivel (con el modal de muestra en oscuro), color y jerarquía (incluido «dónde va el latón»), tipografía (escala + `label` y `sectionTitle`), espaciado, radios, elevación, movimiento (demo de cada animación permitida, con el aviso de movimiento reducido) y `FileteLaton`.
   - Hecho cuando: cada tabla de `spec.md` § «Design system» tiene su muestra.
143. **Primitivos en todos sus estados** (default, hover, foco, deshabilitado, cargando, error, vacío, según aplique): botones (principal, secundario, texto, destructivo, `SubmitButton`), campos (texto, `NumberField` con adorno, `PhoneField`, `RifCiField`, `Select`, `Autocomplete`, `DateField`, con error y ayuda), `SegmentedControl` (con contadores), `EstadoChip` (los 4 tonos), `FilterMenuButton`, `RowActionsMenu` y toast (éxito con «Ver», error, con «Deshacer»).
   - Hecho cuando: la matriz se ve en ambos modos.
144. **Patrones**: listado completo como el artboard 2 (con `estados`, `FilterMenuButton`, `colPrincipal`, montos, `⋮`), formulario en modal como el artboard 3 (`FormSection`, `FormGrid` con `full`, `FormSubgroup`, `LineasEditor` con totales, `SubmitButton`, error con «Reintentar»), los tamaños `xs`/`sm`/`md`/`lg` y la ficha (`FichaHeader`, `FichaSeccion`, KPI seleccionables, documentos).
   - Hecho cuando: los tres artboards se reconocen en la página.
145. **Carga, feedback y fallbacks** (artboard 4): simuladores de navegación, `PageLoader` en cada variante (montado dentro de un contenedor, sin encender la barra global, o anotado si no se puede), skeleton de sección, acción en curso, éxito (cierra, resalta y toast), error, operación larga (`useGlobalLoader`) y los cinco `Fallback` más «—».
   - Hecho cuando: cada fila de las tablas «Carga y feedback» y «Fallbacks» tiene su demo.
146. **Catálogo en la spec**: actualizar en `spec.md` la tabla «Componentes compartidos» con lo construido en 4b–4e (quitar «(Fase 4)» de lo ya hecho y marcar `PeneroStripes`/`PeneroSweep` como retirados) y la tabla «Unificación» de 94 con su estado.
   - Hecho cuando: la spec describe lo que hay en el código.

### Fase 4g — Migración pantalla por pantalla y verificación

Cada tarea de 147 a 157 toca solo los archivos que nombra. Si dos tareas necesitan el mismo archivo compartido, la segunda espera. Al cerrar cada una, revisar sus pantallas en claro/oscuro y a 375/1440 px.

147. **Listados de maestros**:
   - archivos: `ClientesTable`/`clientes-screen`, `ProveedoresTable`/`proveedores-screen` y `ProductosTable`/`catalogos-screen`;
   - los chips-filtro con contador pasan a `estados` (`SegmentedControl` con contadores, `?estado=` sin cambio);
   - los chips «Activo», «Controla stock» y «Crudo» salen de las filas: el tipo va como texto en su columna y «Controla stock» como columna de texto «Sí/No», o se elimina si el filtro lo cubre;
   - identificadores con `colPrincipal` (código o RIF bajo el nombre).

   Corrige la desalineación de Catálogos.
   - Hecho cuando: los tres listados siguen el artboard 2 y no muestran chips de estados normales.
148. **Listados de operaciones**:
   - archivos: `ComprasTable`, `ProcesamientosTable`, `LotesTable`/`inventario-screen`, `InventarioProductosTable`, `PedidosTable` (`ToggleButtonGroup` → `estados`) y `NotasCreditoTable` (ídem);
   - filtros extra con `FilterMenuButton`;
   - montos con `colMonto`.
   - Hecho cuando: ninguno de estos archivos importa `ToggleButtonGroup` ni usa `Chip` como filtro.
149. **Listados de administración**:
   - archivos: `DocumentosCarteraTable` en `/cobros`, `ContratosTable`, `CotizacionesTable`, `GastosTable`, `GastosRecurrentesTable`, `EmpleadosTable` y `/usuarios`;
   - mismo tratamiento que 147–148.
   - Hecho cuando: igual que 148.
150. **Formularios cortos y medios**:
   - archivos: `ClienteForm` + `ClienteFormFields`, `ProveedorForm` + `ProveedorIdentificacionFields` + `MetodosPagoFieldArray` + `RepresentantesLegalesFieldArray`, `ProductoForm`, `ConfigNegocioForm`, `EmpleadoForm`, `GastoForm`, `GastoRecurrenteForm`, `CategoriaGastoForm`, `PerfilForm`, `CrearUsuarioForm`, `BloqueoDialog`, `PerdidaLoteDialog`, `AnularGastoDialog`, `AnularCotizacionDialog`, `ResponderCotizacionDialog`, `CambiarIvaFacturaDialog`, `CorregirLineaFacturaDialog`, `TasaManualDialog`, `RegistrarPagoDialog` y `PagoProveedorDialog`;
   - van con `FormSection` + `FormGrid` (sin huérfanos: «Teléfono de contacto» y «Notas» en `full`) + `FormSubgroup`, `SubmitButton` con verbo y tamaño según 117;
   - «Tipo de persona», «Contado/Crédito» y «USD/Bs» → `SegmentedControl`.
   - Hecho cuando: ningún archivo de la lista importa `ToggleButtonGroup` y el espaciado de «Nuevo producto» mide 16/24/40.
151. **Formularios largos con líneas**:
   - archivos: `CompraForm` + `CompraItemsFieldArray`, `EditarCompraDialog`, `PedidoForm` + `PedidoItemsFieldArray`, `EntregaPedidoDialog`, `CotizacionForm` + `CotizacionItemsFieldArray`, `ProcesamientoForm` + `SalidasProcesoFieldArray`, `NotaCreditoForm` y `ConvertirPedidoDialog`;
   - las líneas van en `LineasEditor` (sin caja anidada, papelera alineada, «Agregar línea» debajo, totales a la derecha);
   - `AppDialog size="lg"` según DS-4;
   - la tasa como `FormSubgroup` dentro de `TasaSelector`, sin estilo de sección.

   Cambia la UI de formularios de `04`, `05`, `07`, `13`, `16`, `19` y `21` sin tocar su lógica.
   - Hecho cuando: «Nueva compra» se ve como el artboard 3 y el título de sección no choca con la primera etiqueta.
152. **Fechas**: los 19 `type="date"` de 14 archivos (`rg -n 'type="date"' src`) pasan a `DateField`, incluidos los filtros de `/tasas` (ancho mínimo de 160 px). La validación `zod` sigue recibiendo `YYYY-MM-DD`.
   - Hecho cuando: `rg 'type="date"' src` queda vacío. Si 150 y 151 ya tocaron esos archivos, esta tarea va después de ellas en el mismo archivo.
153. **Opciones excluyentes restantes**: `TasaSelector` (BCV/Paralela/Manual) y `FlujoCajaChart` pasan a `SegmentedControl`, junto con todo `ToggleButtonGroup` que quede fuera de 147–151 y 155.
   - Hecho cuando: `rg -l "ToggleButtonGroup" src` solo encuentra `atoms/SegmentedControl.tsx`.
154. **Fichas**:
   - archivos: `cliente-ficha` (KPI de cartera como filtro con `ocultarFiltroEstados`, documentos con 120, `CreditoResumen` con 137), `proveedor-ficha`, `compra-ficha`, `factura-ficha`, `lote-ficha`, la ficha de empleado y la de cotización;
   - todas con `FichaSeccion`, 48 px entre bloques y sin chips de estados normales.
   - Hecho cuando: ninguna ficha duplica los indicadores ni muestra papeleras rojas sueltas.
155. **`/tasas`** (`tasas-screen.tsx`, `TasaChip`, `TasaIndicador`; tarea agregada en `08-tasas`):
   - tarjetas con `formatTasaCorta` (2 decimales) en `h5`, y el valor de 6 decimales en el tooltip y en el detalle (DS-6);
   - filtros con `DateField` y `SegmentedControl`;
   - la tabla llena el ancho y su encabezado no se corta.
   - Hecho cuando: no hay cifras de 6 decimales en tipografía display.
156. **Dashboard** (`(dashboard)`, `KpisDiaRow`, paneles y `organisms/*Chart*`): `KpiCard` con `tone` + ícono, `ChartCard` con estados de `Fallback`, `ListaResumen` y skeletons de sección (122).
   - Hecho cuando: el dashboard no tiene tamaños sueltos y distingue los estados sin depender del color.
157. **Feedback después de la acción** en las acciones de alta y edición de los listados (`use*Acciones.tsx` y los formularios de 150–151):
   - toast con el verbo + «Ver» donde exista ficha;
   - `resaltar(id)` en la tabla de origen;
   - «Deshacer» solo donde exista la acción inversa sin efectos secundarios (propuesta: activar/desactivar producto, empleado y categoría), anotando la lista final aquí (DS-3).
   - Hecho cuando: registrar un cliente, una compra y un producto cierra el modal, resalta la fila y muestra el toast.
158. **Barridos** (absorbe las tareas 86 y 90). Resultado esperado: vacío, salvo las excepciones anotadas.
   - hex fuera de `src/theme/`, `src/app/icon.svg` y los PDF;
   - `Barlow` y `penero`;
   - `brand.(hull|ochre|red|trim)`;
   - `fontSize` suelto (el comando de la tarea 86);
   - clases de color de Tailwind;
   - `type="date"`;
   - `ToggleButtonGroup` fuera de `SegmentedControl`;
   - `variant="soft"` fuera de `EstadoChip`/`LoteChip`/`TasaChip`;
   - `color="secondary"`;
   - `bgcolor: 'background.paper'` dentro de `AppDialog` y de lo elevado;
   - `brand.brass` fuera de `FileteLaton`, `AppShell`, `NotificationProvider` y `BrandLoader`;
   - milisegundos sueltos en `sx`/`setTimeout` de UI;
   - `mostrarActivo` y props deprecadas sin consumidores (retirarlas).
   - Hecho cuando: cada barrido queda anotado en el checklist con su resultado.
159. **Contraste AA** con herramienta (absorbe la 89), en claro y oscuro. Pares:
   - los de la tarea 89;
   - `inputBorder` sobre `background.field` y sobre `elevated` (≥ 3:1);
   - foco `focusRing` sobre `paper` y `#D4B27A` sobre `elevated`;
   - texto del segmentado seleccionado y no seleccionado sobre su fondo;
   - `onSoft` sobre `soft` de los 4 tonos;
   - el punto de cada chip (≥ 3:1);
   - texto, check y acción del toast;
   - `highlight` sin bajar el contraste del texto de la fila.
   - Hecho cuando: todos los pares quedan anotados en el checklist con su razón, con texto ≥ 4.5:1 y no textual ≥ 3:1, o con el token ajustado.
160. **Revisión visual** (absorbe la 91): todas las pantallas de la lista de la tarea 91, en claro y oscuro y a 375/768/1024/1440 px, contra los artboards 1–4 del lienzo «Design system Altamar». Incluye los diálogos principales, el loader global, la barra de navegación, los toasts y los fallbacks.
   - Hecho cuando: cada pantalla queda marcada en el checklist, con las diferencias corregidas o anotadas con motivo.
161. **Cierre** (absorbe la 92): `spec.md` al día (tareas 146, 117 y DS-1–DS-8 con su estado final), y después `npm run lint`, `npx tsc --noEmit` y `npm run build`.
   - Hecho cuando: los tres comandos pasan.

## Componentes agregados después de la primera pasada
- _(los módulos 01-05 anotan aquí cualquier componente genérico nuevo que creen, con fecha y motivo, y lo agregan también a la tabla de `spec.md`)_
- **2026-10-07 (estándar de formularios)**: `molecules/FormSection` (nuevo), `atoms/PhoneField` (nuevo), `NumberField` y `RifCiField` reconstruidos sobre `react-number-format`. Reglas de `size="small"` y división por `FormSection` en `spec.md` § "Estructura visual". Todos agregados a la tabla de `spec.md`.
- **2026-10-06 (03-proveedores)**: `lib/validationMessages.ts` (cierra tarea 22), `lib/actionState.ts`, `lib/documentoStore.ts`, `lib/bancosVe.ts`, generalización de `DocumentoUpload` (adaptador `DocumentoStore`) y de `RepresentantesLegalesFieldArray` (tipado genérico + `Collapse`, cierra tarea 26), y `CopyableText` / `StatusChips` en `molecules`. Todos agregados a la tabla de `spec.md`.
- **2026-10-07 (10-refactor-visual-clientes)**: `molecules/FichaHeader` (nuevo) y `lib/navigationOrigin.ts` (nuevo, para la vuelta de `FichaHeader`); `AppDataGrid` con `normalizeSearch` + `getSearchValues` (búsqueda en modo cliente resuelta por el propio componente, igual en grilla y tarjetas) y Enter en una celda para abrir la fila (`onCellKeyDown`, cierra el pendiente (b)); exporta `normalizarBusqueda` / `normalizarBusquedaSinSeparadores`, y `appDataGridColumns` exporta `ACTIONS_FIELD`; `StatusChips` en `soft` 22 px con `mostrarActivo`; `DocumentoUpload` con `disabled` y `Button loading` (cierra el pendiente (d)); `BloqueoDialog` sobre `AppDialog xs`; `EmptyState` con `compact`. Todos agregados a la tabla de `spec.md`.
- **Tarea agregada 2026-10-22 (21-cotizaciones, planificada; tarea 11 ejecutada el 2026-10-22 en `feat/cotizaciones`; también `lib/cartera/recordatorios/plantillas.ts` toma de ahí casco, ocre y rojo; componentes registrados en la tabla de `spec.md` el 2026-10-22, Fase E de 21)**: el PDF de cotizaciones necesita la marca fuera de MUI. Se extraen los hex de `palette.brand` del modo claro a `src/theme/marca.ts` y la geometría del isotipo a `src/lib/marca/isotipo.ts`; `theme.ts` y `atoms/BrandMark` pasan a leerlos sin cambio visual (tarea 11 de `21-cotizaciones`). Se agregan `lib/pdf/marca.tsx` + `lib/pdf/fuentes.ts` (encabezado de marca y Barlow para react-pdf) y `templates/DocumentoPublicoLayout` (página pública sin `AppShell`), que se registrarán en la tabla de `spec.md` en la Fase E de 21. Cuando llegue el logo real, se reemplaza también en `src/lib/marca/isotipo.ts`.
- **2026-10-07 (11-refactor-visual-proveedores)**: `AppDialog` con prop `footer?: ReactNode` (pie custom para diálogos con navegación propia, ej. el Stepper de `ProveedorForm`: Anterior / Siguiente / "Guardar y continuar" / Finalizar; sin `footer` el pie estándar no cambia — `ClienteForm` intacto); `molecules/DocumentosRequeridos` con prop `disabled` (propaga a cada `DocumentoUpload` mientras el form dueño guarda). Ambos anotados en la tabla de `spec.md`.

## Nota de implementación (2026-10-06)

- Persistencia del modo en cookie: `src/lib/themeStorage.ts` implementa un `StorageManager` de MUI que escribe la cookie `mui-mode` además de `localStorage`; `layout.tsx` la lee y aplica `data-mui-color-scheme` en `<html>` antes del render. El `InitColorSchemeScript` cubre el primer load del cliente. No se usó Server Action para setear la cookie (diferido, ver checklist).
- `useNotify` es un re-export en `src/lib/useNotify.ts` que apunta a `components/organisms/NotificationProvider.tsx` (fuente única del hook + proveedor).
- `useConfirm` vive en `src/lib/useConfirm.tsx` (proveedor + hook) y usa `components/molecules/ConfirmDialog.tsx`.
- `NotificationProvider` usa un `useReducer` con cola para mostrar notificaciones en serie (patrón recomendado por MUI), evitando superponer Snackbars.
