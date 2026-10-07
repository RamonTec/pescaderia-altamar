# Checklist — 00-estandares-ui

## Modo oscuro/claro
- [x] `theme.ts` usa `colorSchemes` (light/dark), no `palette.mode` fijo.
- [x] Cambiar el toggle alterna todo (fondo, texto, componentes MUI) sin parchar colores en componentes individuales.
- [x] Recargar la página con preferencia "oscuro" no muestra un flash en claro antes de aplicar el tema.
- [x] Contraste verificado (no solo "se ve bien") en ambos esquemas para texto normal y botones.

## Responsive
- [x] `AppShell` en viewport móvil (<600px) oculta el drawer permanente y lo reemplaza por uno temporal con botón de menú.
- [ ] Ninguna pantalla existente requiere scroll horizontal involuntario en móvil (tablas usan `columnVisibilityModel`, no se desbordan).
- [x] Formularios con varios campos se apilan en una columna en móvil.

## Loaders y estados
- [x] Cada ruta principal tiene su `loading.tsx` usando `PageLoader` (no pantalla blanca durante la navegación). _(Verificado 2026-10-07, Fase 2a: `(protected)/loading.tsx` cubre como respaldo inicio, perfil, usuarios, inventario y cualquier ruta nueva sin `loading.tsx` propio; las demás tienen el suyo con `PageLoader`.)_
- [ ] Ninguna tabla queda vacía sin `EmptyState` cuando no hay datos. _(Clientes, 10-refactor-visual-clientes, 2026-10-07: listado con "Aún no hay clientes" + "Nuevo cliente", filtro vacío con "Ver todos" y sin resultados con "Limpiar búsqueda"; facturas y pedidos de la ficha con `EmptyState compact`. Falta el resto de pantallas.)_
- [ ] Ningún `catch` de carga de datos deja la pantalla rota sin `ErrorState`. _(Clientes, 10-refactor-visual-clientes, 2026-10-07: la ficha carga en el servidor y `clientes/[id]/error.tsx` muestra `ErrorState` + "Reintentar" (`retry`). Falta el resto de pantallas.)_
- [ ] Ningún botón de acción se queda "sin feedback" mientras procesa (loader interno + disabled). _(Clientes, 10-refactor-visual-clientes, 2026-10-07: `Button loading` en `ClienteForm`, `BloqueoDialog`, avisos de la ficha y `DocumentoUpload`; `⋮` con `pending` por fila. Falta el resto de pantallas.)_

## Notificaciones y confirmaciones
- [x] No queda ningún `window.alert` o `window.confirm` en el código.
- [ ] Toda escritura a base de datos muestra un toast de éxito o error.
- [ ] Toda acción destructiva pasa por `ConfirmDialog`.

## Formularios y formato
- [x] `react-hook-form` + `zod` instalados y usados en al menos un formulario de referencia (el que se construya primero en `01-auth` o `02-clientes`).
- [x] `NumberField` se usa para todo campo de dinero o peso, no `<input type="number">` plano.
- [x] `formatUsd`/`formatBs`/`formatKg`/`formatTasa` son las únicas funciones de formato de estos valores en todo el código (sin `toFixed()` repetido).

## Validación de formularios
- [ ] `clientes/actions.ts` corre `clienteFormSchema.safeParse(input)` antes de escribir (hoy NO lo hace — ver tarea 23 de `tasks.md`).
- [ ] Cada módulo nuevo (`03-proveedores` en adelante) sigue el patrón `<entidad>Validation.ts` y valida también en su Server Action, desde el primer commit.
- [ ] `src/lib/validationMessages.ts` existe solo si ya hubo un segundo módulo repitiendo un mensaje — si no hay repetición todavía, este ítem no aplica (marcar como N/A, no como pendiente).

## Transiciones
- [ ] Alternar modo claro/oscuro se ve como una transición corta, no un corte brusco.
- [x] Ninguna transición custom (`sx`) usa `transition: 'all'`. _(Verificado 2026-10-07 con grep en `src/`: todas las transiciones usan `transitions.create([...propiedades])` explícitas; no hay `create()` sin argumentos, que equivale a `all`.)_
- [ ] Filas que se agregan/quitan en formularios dinámicos (ej. representantes legales) no aparecen/desaparecen de golpe.

## General
- [x] La tabla de "Componentes compartidos" en `spec.md` está al día con lo que realmente existe en `src/components`.
- [x] `npm run lint` y `npx tsc --noEmit` sin errores.

## Fase 2 — Acabado visual (2026-10-07)
- [ ] `BrandMark` con el logo real de Altamar (o el provisional documentado como pendiente) y favicon/íconos de la app generados. _(Pendiente del logo real. Verificado 2026-10-07: `atoms/BrandMark.tsx` provisional documentado y `src/app/icon.svg` generado; faltan el logo real, `apple-icon.png`, y borrar `src/app/favicon.ico` (el de Next) y los SVG de `public/`. Ver pendiente (g).)_
- [ ] Loader global con logo: aparece solo si tarda > 150 ms, dura ≥ 400 ms, anunciado a lectores de pantalla, versión sin movimiento. _(Implementado; falta verificación visual del usuario. En código: `SHOW_DELAY_MS` 150 / `MIN_VISIBLE_MS` 400, contador de llamadas, `role="status"` + `aria-live="polite"`, `prefers-reduced-motion` en `BrandLoader`/`PeneroSweep`; login y cierre de sesión liberan el loader si la action falla.)_
- [x] `AppShell` en `(protected)/layout.tsx`: el menú no se vuelve a montar al navegar; sesión y rol vienen del servidor. _(Verificado en código 2026-10-07: el layout resuelve `getUsuarioActual()` (con `cache`) y pasa `usuario` por props; sin `useEffect` de sesión en `AppShell`. Compat temporal: `cobros/page.tsx` y `pedidos/page.tsx` (cambios de 08-tasas) siguen envolviéndose en `<AppShell>`, que en ese caso solo devuelve `children`; ver pendiente (f). Comportamiento en navegador: tarea 46.)_
- [x] Barra de progreso de navegación con las franjas; skeleton de la página dentro del shell. _(Verificado en código 2026-10-07: `NavigationProgress` (3 px, `PeneroSweep`) en el borde inferior de la barra superior, activada por `NavLinkStatus`/`useLinkStatus` y por `PageLoader`; todos los `loading.tsx` de `(protected)` quedan dentro del layout con el shell. Comportamiento en navegador: tarea 46.)_
- [ ] Toda acción asíncrona usa `Button loading`; formularios y diálogos bloqueados mientras guardan; doble envío imposible. _(Base lista; migración en Fase 2b. Referencia verificada en `ClienteForm`: `Button loading`, `useForm({ disabled })`, `submittingRef` contra doble envío, `AppDialog pending`. Falta `DocumentoUpload`, ver pendiente (d). Clientes completo el 2026-10-07 (10-refactor-visual-clientes): `BloqueoDialog` en `AppDialog` con `submittingRef`, `DocumentoUpload disabled`, `useClienteAcciones` ignora una segunda acción sobre el mismo cliente; doble clic en navegador pendiente del usuario. Falta el resto de pantallas.)_
- [ ] Todas las tablas usan `AppDataGrid`: textos en español, 25 filas por defecto, paginación en servidor para registros que crecen, página en la URL, tarjetas en `xs`. _(Base lista; migración en Fase 2b. `AppDataGrid` verificado: `esES` en el theme, 25/50/100, `mode` client/server, `?pagina=`, `mobileCard`; ninguna tabla existente lo usa todavía. 2026-10-07 (clientes, 10-refactor-visual-clientes): `ClientesTable` y las tablas de facturas y pedidos de la ficha ya usan `AppDataGrid` (modo cliente, `?pagina=`, `?estado=`, `mobileCard`). Falta el resto.)_
- [ ] Todos los diálogos usan `AppDialog`: tres tamaños, pantalla completa en `xs`, cierre protegido con cambios sin guardar o acción en curso. _(Base lista; migración en Fase 2b. `AppDialog` verificado: xs/sm/md, `fullScreen` + `Slide` en `xs`, `pending` bloquea cierre, `dirty` pide "¿Descartar cambios?". Solo `ClienteForm` migrado. 2026-10-07 (clientes, 10-refactor-visual-clientes): `BloqueoDialog` migrado a `AppDialog xs` (también lo usa proveedores). Falta el resto.)_
- [ ] Tipografía según la escala de `spec.md`: Barlow / Barlow Condensed, cifras tabulares en montos, sin tamaños sueltos ni MAYÚSCULAS. _(Base lista; migración en Fase 2b. Escala aplicada en `theme.ts`, Geist Mono retirado de `layout.tsx`, sin `uppercase`/`overline` en `src/`. Quedan: `MONO` con `var(--font-geist-mono)` en `CompraForm`, `PedidoForm`, `RegistrarPagoDialog`, `PagoProveedorDialog` (archivos con cambios de 08-tasas) y tamaños sueltos en íconos (`cliente-ficha.tsx` 16, `ErrorState`/`RecuperarForm` 40). 2026-10-07 (clientes, 10-refactor-visual-clientes): `cliente-ficha.tsx` sin tamaños sueltos (título `h5` en `FichaHeader`, ícono de vuelta `fontSize="small"`) y `CreditoResumen` con `h5` en la cifra. Quedan `ErrorState`/`RecuperarForm`.)_
- [x] Las franjas de la borda aparecen solo en los cuatro lugares definidos; sin sombras ni degradados decorativos. _(2026-10-07: corregido el quinto uso en `AppDataGrid` (tarjetas `xs`), que ahora usa un `LinearProgress` neutro; ver (h). Sin degradados; la única sombra explícita es la del listado flotante de `Autocomplete`, permitida. El isotipo de `BrandMark` y la página `/estandares` no cuentan como uso decorativo.)_
- [ ] Íconos `Outlined` en todo el sistema. _(Base lista; migración en Fase 2b. `AppShell`, menús y componentes base ya en `Outlined`; quedan 17 imports sin sufijo en pantallas existentes. 2026-10-07 (clientes, 10-refactor-visual-clientes): archivos de clientes y `RepresentantesLegalesFieldArray` sin imports sin sufijo.)_
- [ ] Revisión en 375 / 768 / 1024 / 1440 px y claro/oscuro de todas las pantallas (tarea 45). _(Fase 2c; falta verificación visual del usuario.)_
- [x] Página `/_estandares` disponible en desarrollo con todos los componentes base y sus estados. _(Verificado en código 2026-10-07. Desvío documentado en la tarea 39: la ruta es `/estandares`, porque una carpeta con `_` es privada en el App Router. Solo en desarrollo y solo admin (`notFound()` si no). Muestra marca, tipografía, loader, barra, botones, chips, `AppDataGrid` en sus estados y `AppDialog` xs/sm/md. Revisarla en claro/oscuro y a 375 px queda para el usuario.)_

## Pendientes / deuda técnica
- [ ] Persistencia del modo via cookie: la cookie `mui-mode` se escribe desde el cliente (en `themeStorage.ts`); el `layout.tsx` la lee y fija `data-mui-color-scheme` en `<html>`. No se usa Server Action — el primer render server-side no conoce la preferencia y depende de `InitColorSchemeScript` (igual que el flujo recomendado por MUI). Diferido: no hay Server Action dedicada para setear la cookie antes del primer render.
- [ ] Los ítems no marcados de "Loaders y estados" y "Notificaciones y confirmaciones" (por pantalla) se completan en los módulos 01-05 al construir sus pantallas reales; los componentes base ya existen y `layout.tsx` ya envuelve con `NotificationProvider`/`ConfirmProvider`.
- [ ] `@mui/material-nextjs` NO se instaló: se mantuvo el `ThemeRegistry` custom (CacheProvider + useServerInsertedHTML) y se usó `InitColorSchemeScript` de `@mui/material` directamente, que ya trae la integración necesaria. Documentado en `tasks.md` tarea 1.

### Pendientes de la Fase 2a (2026-10-07)
- [ ] (a) Volver desde una ficha a una tabla en modo servidor con la caché del router (la página vive en `?pagina=` escrita con `history.replaceState`): probarlo en la primera tabla que se migre a servidor (Fase 2b).
- [ ] (b) Filas clicables de `AppDataGrid` (`getRowHref`) solo responden al mouse: `onRowClick` no se dispara con Enter. Decidir en la Fase 2b (enlace en la primera celda, manejar `onCellKeyDown` u otra solución). _(Resuelto el 2026-10-07 en 10-refactor-visual-clientes: `onCellKeyDown` navega con Enter solo si `event.target === event.currentTarget` (el foco está en la propia celda, no en un control dentro de ella ni en el menú `⋮`, cuyo portal también burbujea al árbol de la celda) y la columna no es `ACTIONS_FIELD` ni `type: 'actions'`. Las flechas siguen siendo de la grilla; en `xs` las tarjetas ya eran `Link`. Implementado; falta la prueba con teclado en navegador del usuario, ver `10-refactor-visual-clientes/checklist.md`.)_
- [ ] (c) Duraciones escritas a mano en animaciones en bucle: `PeneroSweep` 1400 ms, `BrandLoader` 2400 ms (`penero-bob`) y el retardo de 100 ms de `NavigationProgress`. Pasarlas a constantes o anotar la excepción en `spec.md`.
- [x] (d) `DocumentoUpload` sigue habilitado mientras `ClienteForm` guarda (no recibe `disabled`). _(Resuelto el 2026-10-07 en 10-refactor-visual-clientes: prop `disabled` (subir, reemplazar, eliminar y soltar; "Ver" sigue activo) y `ClienteForm` la pasa con `isPending`. Verificado en código.)_
- [ ] (e) Capas que ya venían mal (anteriores a la Fase 2): `ClienteForm` llama directo a `representanteLegalRepository` desde el cliente, y `authService` (`getUsuarioActual`) consulta `perfiles` sin repositorio.
- [ ] (f) Retirar `AppShellNestingContext` y la rama sin `usuario` de `AppShell` cuando `cobros/page.tsx` y `pedidos/page.tsx` dejen de envolverse en `<AppShell>`, y quitar el alias `--font-geist-mono` de `globals.css` cuando los archivos de 08-tasas (`CompraForm`, `PedidoForm`, `RegistrarPagoDialog`, `PagoProveedorDialog`) dejen de usarlo.
- [ ] (g) Logo real: reemplazar dentro de `BrandMark`, regenerar `src/app/icon.svg`, generar `apple-icon.png`, borrar `src/app/favicon.ico` y los SVG de ejemplo de `public/`.
- [x] (h) (verificador) `AppDataGrid` usa `PeneroSweep` como barra de carga de las tarjetas en `xs`, un quinto lugar para las franjas que la spec no permite. Cambiarlo por un `LinearProgress` neutro o anotar la excepción en `spec.md`. _(Resuelto el 2026-10-07: `LinearProgress`.)_
