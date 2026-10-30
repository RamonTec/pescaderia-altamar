# Checklist — 00-estandares-ui

## Modo oscuro/claro
- [x] `theme.ts` usa `colorSchemes` (light/dark), no `palette.mode` fijo.
- [x] Cambiar el toggle alterna todo (fondo, texto, componentes MUI) sin parchar colores en componentes individuales.
- [x] Recargar la página con preferencia "oscuro" no muestra un flash en claro antes de aplicar el tema.
- [x] Contraste verificado (no solo "se ve bien") en ambos esquemas para texto normal y botones.

## Responsive
- [x] `AppShell` en viewport móvil (<600px) oculta el drawer permanente y lo reemplaza por uno temporal con botón de menú.
- [ ] Ninguna pantalla existente requiere scroll horizontal involuntario en móvil (tablas usan `columnVisibilityModel`, no se desbordan). _(Clientes, proveedores y catálogos: `mobileCard` de `AppDataGrid` cubre `xs` (10, 11 y 12-refactor-visual-catalogos, 2026-10-07). Falta el resto de pantallas.)_
- [x] Formularios con varios campos se apilan en una columna en móvil.

## Loaders y estados
- [x] Cada ruta principal tiene su `loading.tsx` usando `PageLoader` (no pantalla blanca durante la navegación). _(Verificado 2026-10-07, Fase 2a: `(protected)/loading.tsx` cubre como respaldo inicio, perfil, usuarios, inventario y cualquier ruta nueva sin `loading.tsx` propio; las demás tienen el suyo con `PageLoader`.)_
- [ ] Ninguna tabla queda vacía sin `EmptyState` cuando no hay datos. _(Clientes, 10-refactor-visual-clientes, 2026-10-07: listado con "Aún no hay clientes" + "Nuevo cliente", filtro vacío con "Ver todos" y sin resultados con "Limpiar búsqueda"; facturas y pedidos de la ficha con `EmptyState compact`. Proveedores, 11-refactor-visual-proveedores, 2026-10-07: listado con "Aún no hay proveedores" + "Nuevo proveedor", filtro vacío ("No hay proveedores bloqueados") con "Ver todos", "Limpiar búsqueda" de `AppDataGrid`, e historial de compras con `EmptyState compact` "Aún no hay compras". Catálogos, 12-refactor-visual-catalogos, 2026-10-07: "Aún no hay productos" + "Nuevo producto" (solo admin), filtro vacío "No hay productos activos" con "Ver todos", "Limpiar búsqueda" de `AppDataGrid`. Falta el resto de pantallas.)_
- [ ] Ningún `catch` de carga de datos deja la pantalla rota sin `ErrorState`. _(Clientes, 10-refactor-visual-clientes, 2026-10-07: la ficha carga en el servidor y `clientes/[id]/error.tsx` muestra `ErrorState` + "Reintentar" (`retry`). Proveedores, 11-refactor-visual-proveedores, 2026-10-07: ídem, `proveedores/[id]/error.tsx` nuevo y carga 100% en servidor (`Promise.all`), sin secciones vacías. Falta el resto de pantallas.)_
- [ ] Ningún botón de acción se queda "sin feedback" mientras procesa (loader interno + disabled). _(Clientes, 10-refactor-visual-clientes, 2026-10-07: `Button loading` en `ClienteForm`, `BloqueoDialog`, avisos de la ficha y `DocumentoUpload`; `⋮` con `pending` por fila. Proveedores, 11-refactor-visual-proveedores, 2026-10-07: `Button loading` en `ProveedorForm` (Stepper), `BloqueoDialog`, avisos de la ficha y `DocumentosRequeridos disabled`; `⋮` con `pending` por fila vía `useProveedorAcciones`; fuera el patrón prohibido `startIcon={<CircularProgress/>}`. Catálogos, 12-refactor-visual-catalogos, 2026-10-07: `Button loading` en `ProductoForm` y `ConfigNegocioForm`; `useForm({ disabled })` en ambos; `⋮` con `pending` por fila vía `useProductoAcciones`; sin `CircularProgress` manual en `catalogos/**`. Falta el resto de pantallas.)_

## Notificaciones y confirmaciones
- [x] No queda ningún `window.alert` o `window.confirm` en el código.
- [ ] Toda escritura a base de datos muestra un toast de éxito o error.
- [ ] Toda acción destructiva pasa por `ConfirmDialog`.

## Formularios y formato
- [x] `react-hook-form` + `zod` instalados y usados en al menos un formulario de referencia (el que se construya primero en `01-auth` o `02-clientes`).
- [x] `NumberField` se usa para todo campo de dinero o peso, no `<input type="number">` plano.
- [x] `formatUsd`/`formatBs`/`formatKg`/`formatTasa` son las únicas funciones de formato de estos valores en todo el código (sin `toFixed()` repetido).

## Formularios — estilo y distribución (2026-10-07)
- [x] `FormSection` existe y todo encabezado de sección de formulario lo usa (sin `Typography h6` sueltos armando secciones). _(Hecho: `molecules/FormSection` (título + ayuda + divisor 1 px excepto primera, `dense`); migrados `ClienteFormFields`, `ClienteForm` ("Documentos") y `ConfigNegocioForm` (encabezados manuales → `FormSection`). `RepresentantesLegalesFieldArray` y `ProveedorForm` usan sus propios encabezados por ahora, consistentes en `h6`.)_
- [x] Inputs de formularios en `size="small"`; ningún formulario con inputs `medium`. _(Hecho: barrido en los 14 consumidores de `NumberField` y todos los forms de organisms/molecules — `ClienteFormFields`, `ProveedorIdentificacionFields`, `RepresentantesLegalesFieldArray`, `ProductoForm`, `ConfigNegocioForm`, `ProcesamientoForm`, `CompraForm` (raíz y `compras/`), `BloqueoDialog`, `PerdidaLoteDialog`, `RecordatorioDialog`, `TasaManualDialog`, `TasaSelector`, `RegistrarPagoDialog`, `PagoProveedorDialog`, `PerfilForm`, `LoginForm`, `RecuperarForm`, `CrearUsuarioForm`, `ActualizarPasswordForm`. Verificado con script: cero `TextField`/`NumberField` con `fullWidth` y sin `size` en `organisms`/`molecules`.)_
- [x] `NumberField` reconstruido sobre `NumericFormat`: escribir letras no aparece ni se guarda (bloqueo en vivo, sin descarte silencioso en blur). _(Hecho: `NumericFormat` con `thousandSeparator="."` + `decimalSeparator=","` (es-VE), `decimalScale={decimals}`, `allowNegative={false}` por defecto (nueva prop), misma interfaz `value: number|null`/`onChange(number|null)` — los 14 consumidores compilan sin cambios de lógica. `parseInput`/`display` artesanales eliminados.)_
- [x] `PhoneField` con máscara `####-#######` es el único input de teléfono de la app. _(Hecho: `atoms/PhoneField` sobre `PatternFormat`, normaliza `+58`/`58`/`0058` (export `normalizarTelefono`); migrados `ClienteFormFields`, `RepresentantesLegalesFieldArray` y `ProveedorIdentificacionFields` (los dos teléfonos).)_
- [x] `RifCiField` con máscara completa; todo campo de RIF/cédula lo usa. _(Hecho: reconstruido sobre `NumberFormatBase` con `format`/`removeFormatting` propios (la letra `A` del string-format de PatternFormat no admite letras — documentado en el componente): letra `V|E|J|G`, guion automático, hasta 10 dígitos + verificador `-\d`; pega formateados (`v-12345678`) y crudos; bloquea el resto en vivo. Casos verificados con script node. Consumidores: `ClienteFormFields`, `RepresentantesLegalesFieldArray`, `ProveedorIdentificacionFields`.)_
- [x] `/estandares` muestra el estándar nuevo (secciones, inputs small, máscaras) revisable en claro/oscuro y 375 px. _(Hecho: sección "Formularios" al final de la página con `FormSection` demo, `RifCiField`, `PhoneField`, `NumberField` y la nota "prueba escribir letras: no aparecen". Revisión visual claro/oscuro/375 px pendiente del usuario.)_

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
- [ ] Toda acción asíncrona usa `Button loading`; formularios y diálogos bloqueados mientras guardan; doble envío imposible. _(Base lista; migración en Fase 2b. Referencia verificada en `ClienteForm`: `Button loading`, `useForm({ disabled })`, `submittingRef` contra doble envío, `AppDialog pending`. Clientes completo el 2026-10-07 (10-refactor-visual-clientes): `BloqueoDialog` en `AppDialog` con `submittingRef`, `DocumentoUpload disabled`, `useClienteAcciones` ignora una segunda acción sobre el mismo cliente. Proveedores completo el 2026-10-07 (11-refactor-visual-proveedores): `ProveedorForm` en `AppDialog md` con `Button loading` en todo el pie del Stepper, `useForm({ disabled })`, `submittingRef` leída solo en el handler, `DocumentosRequeridos disabled`, `useProveedorAcciones` con guard de doble envío por fila. Catálogos completo el 2026-10-07 (12-refactor-visual-catalogos): `ProductoForm` en `AppDialog sm` con `Button loading`, `useForm({ disabled })`, `submittingRef` (leída solo en el handler, patrón `ClienteForm`), `ConfigNegocioForm` con `Button loading` + `useForm({ disabled })`, `useProductoAcciones` con guard por fila. Doble clic en navegador pendiente del usuario. Falta el resto de pantallas.)_
- [ ] Todas las tablas usan `AppDataGrid`: textos en español, 25 filas por defecto, paginación en servidor para registros que crecen, página en la URL, tarjetas en `xs`. _(Base lista; migración en Fase 2b. `AppDataGrid` verificado: `esES` en el theme, 25/50/100, `mode` client/server, `?pagina=`, `mobileCard`. 2026-10-07 (clientes, 10-refactor-visual-clientes): `ClientesTable` y las tablas de facturas y pedidos de la ficha ya usan `AppDataGrid` (modo cliente, `?pagina=`, `?estado=`, `mobileCard`). Proveedores, 11-refactor-visual-proveedores, 2026-10-07: `ProveedoresTable` (modo cliente, `?pagina=`, `?estado=` en chips, `normalizeSearch` sin separadores, `mobileCard` con saldo) e historial de compras embebido en la ficha (`searchable={false}`, `pageParam="pcompras"`). Catálogos, 12-refactor-visual-catalogos, 2026-10-07: `ProductosTable` (modo cliente, `?pagina=`, `?estado=` en chips Activos/Todos, `normalizeSearch` sin separadores, `getSearchValues` con el crudo origen, `mobileCard`, sin columna de acciones ni botón vacío sin admin). Falta el resto.)_
- [ ] Todos los diálogos usan `AppDialog`: tres tamaños, pantalla completa en `xs`, cierre protegido con cambios sin guardar o acción en curso. _(Base lista; migración en Fase 2b. `AppDialog` verificado: xs/sm/md, `fullScreen` + `Slide` en `xs`, `pending` bloquea cierre, `dirty` pide "¿Descartar cambios?". Solo `ClienteForm` migrado. 2026-10-07 (clientes, 10-refactor-visual-clientes): `BloqueoDialog` migrado a `AppDialog xs` (también lo usa proveedores). Proveedores, 11-refactor-visual-proveedores, 2026-10-07: `ProveedorForm` migrado a `AppDialog md` con el pie del Stepper por la prop nueva `footer` (Stepper de 3 pasos conservado, pantalla completa + `Slide` en `xs`). Catálogos, 12-refactor-visual-catalogos, 2026-10-07: `ProductoForm` migrado a `AppDialog sm` (fuera el `Dialog` a mano con `useMediaQuery` propio; `pending`/`dirty`/`error` del `AppDialog`). Falta el resto.)_
- [ ] _(Reemplazado el 2026-10-22 por la Fase 3, Puerto: se verifica en "Tokens y theme" de la Fase 3.)_ Tipografía según la escala de `spec.md`: Barlow / Barlow Condensed, cifras tabulares en montos, sin tamaños sueltos ni MAYÚSCULAS. _(Base lista; migración en Fase 2b. Escala aplicada en `theme.ts`, Geist Mono retirado de `layout.tsx`, sin `uppercase`/`overline` en `src/`. Quedan: `MONO` con `var(--font-geist-mono)` en `CompraForm`, `PedidoForm`, `RegistrarPagoDialog`, `PagoProveedorDialog` (archivos con cambios de 08-tasas) y tamaños sueltos en íconos (`cliente-ficha.tsx` 16, `ErrorState`/`RecuperarForm` 40). 2026-10-07 (clientes, 10-refactor-visual-clientes): `cliente-ficha.tsx` sin tamaños sueltos (título `h5` en `FichaHeader`, ícono de vuelta `fontSize="small"`) y `CreditoResumen` con `h5` en la cifra. Proveedores, 11-refactor-visual-proveedores, 2026-10-07: `proveedor-ficha.tsx` sin tamaños sueltos (título `h5` en `FichaHeader`, saldo como cifra `h5` con cifras tabulares). Quedan `ErrorState`/`RecuperarForm`.)_
- [x] _(Peñero. En la Fase 3 las franjas se retiran; ver "Decorativo y marca".)_ Las franjas de la borda aparecen solo en los cuatro lugares definidos; sin sombras ni degradados decorativos. _(2026-10-07: corregido el quinto uso en `AppDataGrid` (tarjetas `xs`), que ahora usa un `LinearProgress` neutro; ver (h). Sin degradados; la única sombra explícita es la del listado flotante de `Autocomplete`, permitida. El isotipo de `BrandMark` y la página `/estandares` no cuentan como uso decorativo.)_
- [ ] Íconos `Outlined` en todo el sistema. _(Base lista; migración en Fase 2b. `AppShell`, menús y componentes base ya en `Outlined`; quedan 17 imports sin sufijo en pantallas existentes. 2026-10-07 (clientes, 10-refactor-visual-clientes): archivos de clientes y `RepresentantesLegalesFieldArray` sin imports sin sufijo. Proveedores, 11-refactor-visual-proveedores, 2026-10-07: todo `proveedores/**`, `ProveedoresTable`, `ProveedorForm`, `MetodosPagoFieldArray` sin imports sin sufijo (verificado con grep: sin `AddIcon`/`MoreVertIcon`/`ArrowBackIcon`/`LinkIcon`). Catálogos, 12-refactor-visual-catalogos, 2026-10-07: `catalogos-screen.tsx` con `AddOutlined` y `ProductosTable`/`ProductoForm` sin imports sin sufijo. Falta el resto.)_
- [ ] Revisión en 375 / 768 / 1024 / 1440 px y claro/oscuro de todas las pantallas (tarea 45). _(Fase 2c; falta verificación visual del usuario.)_
- [x] Página `/_estandares` disponible en desarrollo con todos los componentes base y sus estados. _(Verificado en código 2026-10-07. Desvío documentado en la tarea 39: la ruta es `/estandares`, porque una carpeta con `_` es privada en el App Router. Solo en desarrollo y solo admin (`notFound()` si no). Muestra marca, tipografía, loader, barra, botones, chips, `AppDataGrid` en sus estados y `AppDialog` xs/sm/md. Revisarla en claro/oscuro y a 375 px queda para el usuario.)_

## Fase 3 — Rediseño Puerto (2026-10-22)

### Decisiones
- [x] P-UI1 a P-UI10 respondidas por el cliente, o ejecutadas con la propuesta y marcadas así en la tabla de `spec.md` (tarea 58). _(2026-10-22: las diez aprobadas por el cliente tal como se propusieron.)_
- [x] Cifras tabulares (`tnum`) verificadas en Instrument Sans y Fraunces, con el resultado anotado en la tarea 59. _(2026-10-22: Instrument Sans sí declara tnum en GSUB con glifos .tf de 600 unidades; Fraunces no declara tnum y se usa para display sin requerir tercera familia.)_

### Tokens y theme
- [x] `theme.ts` claro y oscuro con la paleta Puerto de `spec.md` (`primary`, `secondary`, `success`, `warning`, `error`, `info`, fondos, texto, `divider`); en oscuro, el botón principal es latón con texto `#241A0B`.
- [x] Tokens nuevos `background.subtle`, `soft`/`onSoft`, `palette.chart` y borde de input presentes como variables CSS en ambos esquemas, sin `any`.
- [x] `brand` con claves Puerto (`midnight`, `navy`, `onMidnight`, `onMidnightMuted`, `brass`, `brassText`); hex de marca solo en `src/theme/marca.ts`. _(Claves Peñero conservadas por compatibilidad temporal hasta tarea 88.)_
- [x] `layout.tsx` carga Fraunces e Instrument Sans con `next/font` y las variables `--font-display`/`--font-body`; sin Barlow en `src/`.
- [x] Escala tipográfica del theme igual a la tabla de `spec.md` (`h3`–`h6`, `subtitle1/2`, `body1/2`, `caption`, `button`); sentence case, sin mayúsculas.
- [x] Radios por jerarquía: 4 en chips, ítems de menú y tooltip; 6 en botones, inputs, `Fab`, KPI y tablas; 8 en superficies; diálogo según P-UI3. Bordes de 1 px y cero sombras en reposo.
- [x] Chips `soft` en claro: Pagada `#ABC7F1`/`#0B1B33`, Por vencer `#F8EEDD`/`#7E4705`, Vencida `#F8E5E3`/`#8E1F18`; en oscuro, legibles. Ningún estado depende solo del color. _(EstadoCarteraChip.pendiente pasado a warning.)_
- [ ] `fontSize="xlarge"` (40 px) disponible; cero `fontSize` numéricos sueltos en la UI (tarea 86). _(fontSize="xlarge" disponible en MuiSvgIcon; el barrido de fontSize sueltos en UI se completa en la tarea 86, Fase 3c.)_
- [ ] Sin alias `--font-geist-mono` ni keyframes `penero-*` en `globals.css`. _(Alias --font-geist-mono eliminado y keyframes puerto-* creados; keyframes penero-* conservados temporalmente hasta tareas 72/88 para PeneroStripes y BrandLoader. Desde el 2026-10-29 los retira la tarea 140 de la Fase 4.)_

> **Reemplazadas el 2026-10-29 por la Fase 4**: las secciones «Decorativo y marca», «Componentes base» y «Accesibilidad y verificación» de la Fase 3 corresponden a las Fases 3b–3d, que no se implementaron. Se conservan como historial y **no se marcan**: se verifican en la sección «Fase 4» de este checklist. El motivo es que el usuario no quedó conforme con el acabado de la Fase 3a y pidió un design system (ver `tasks.md`, tabla de la Fase 3b).

### Decorativo y marca _(reemplazada el 2026-10-29 por la Fase 4)_
- [ ] `FileteLaton` es el único decorativo y aparece solo en: filete del sidebar, punto del ítem activo, login, documento público, barra de navegación y loader global.
- [ ] `NavigationProgress` (2 px de latón) y `BrandLoader` (filete en barrido, sin vaivén) conservan el retardo, el mínimo, `role="status"` y la versión quieta con `prefers-reduced-motion`; duraciones como constantes (cierra el pendiente (c)).
- [ ] `BrandMark`, `src/lib/marca/isotipo.ts` y `src/app/icon.svg` con el isotipo provisional Puerto (el logo real sigue en el pendiente (g)).
- [ ] `PeneroStripes.tsx` borrado; `rg -i 'penero|hull|ochre|brand\.red|brand\.trim' src` vacío.
- [ ] PDF de cotización y correo de recordatorio con la marca y las fuentes nuevas (tarea agregada en 21 y 09); el PDF de contratos no cambia (fuera de alcance).

### Componentes base _(reemplazada el 2026-10-29 por la Fase 4)_
- [ ] `AppShell`: sidebar medianoche, nombre en Fraunces, filete de 2 px, ítem activo marino con punto de latón, igual en `md+`, riel `sm` y temporal `xs`; foco visible sobre medianoche.
- [ ] `PageHeader` (`h4` Fraunces), `FichaHeader` (`h5`), `FormSection` (`h6` sans), `AppDialog`/`ConfirmDialog`, `AppDataGrid` (encabezado `subtle` en `subtitle2`, radio 6, tarjetas `xs`), `KpiCard` (con ícono por `tone`), `ChartCard`, `ChartLegendTable`, `ListaResumen`, `CadenaTrazabilidad` y `CreditoResumen` con el acabado Puerto y sin cambiar sus props públicas.
- [ ] Gráficos con `palette.chart`; cada serie con ≥ 3:1 contra `background.paper`, y positivo/negativo no solo por color.
- [ ] `/estandares` muestra paleta, escala, filete, chips, KPI, radios y botones de Puerto en claro y oscuro.

### Accesibilidad y verificación _(reemplazada el 2026-10-29 por la Fase 4)_
- [ ] Contraste AA verificado con herramienta en claro y oscuro (tarea 89): pares anotados aquí con su razón; texto ≥ 4.5:1, texto grande y no textual ≥ 3:1. Latón decorativo y `#ABC7F1` nunca como texto sobre claro.
- [ ] Barridos de la tarea 90 vacíos (hex sueltos, Barlow, penero, claves `brand` viejas, `fontSize` sueltos, color de Tailwind), anotados aquí.
- [ ] Revisión visual de todas las pantallas de la tarea 91 en claro y oscuro y en 375/768/1024/1440 px, contra el artboard "B · Puerto". Diferencias corregidas o anotadas con motivo.
- [ ] Tabla de componentes de `spec.md` al día (`FileteLaton`; `PeneroStripes`/`PeneroSweep` retirados).
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores, corridos tras cada tarea y al cierre.

## Fase 4 — Design system (2026-10-29)

### Decisiones e inventario
- [x] DS-1 a DS-8 respondidas por el usuario, o ejecutadas con la propuesta y marcadas así en la tabla de `spec.md` (tarea 93). _(2026-10-29: las ocho aprobadas tal como se propusieron.)_
- [x] Tabla «Unificación» de `spec.md` completa: cada componente con su destino y la tarea que lo resuelve (tarea 94). _(2026-10-29: completada en spec.md con todos los componentes de src/components)._

### Fundamentos (4a)
- [x] `src/theme/tokens.ts` existe (movimiento, tiempos, espaciado, sombras) y `theme.transitions` lo usa. Ningún componente de la Fase 4 escribe ms, sombras ni hex sueltos (tarea 95).
- [x] Tokens de superficie en ambos esquemas como variables CSS: `background.elevated`, `background.field`, `rowDivider`, `dialogDivider`, `scrim`, `focusRing`, `highlight`, `outlineBorder`, `segmented.*`, `neutral` y `dot`. Valores DS-8 comentados (tarea 96).
- [x] En oscuro no hay capa de elevación de MUI: modal (encabezado, cuerpo y pie) y menús en `#1A2A45`, campos en `#0F1C31` con borde `#5E7194`. Mecanismo documentado en `theme.ts` y `spec.md` (tarea 97).
- [x] Latón solo en foco, acción principal en oscuro, decorativo de marca y acción del toast. Pestañas, segmentado, switch, checkbox, radio, enlaces y botones de texto en color de texto (tarea 99).
- [x] Variantes tipográficas `label` y `sectionTitle` disponibles y tipadas (tarea 100).
- [x] Tabla del theme: encabezado de 40 px a todo el ancho, celdas centradas, flecha de orden sin círculo (tarea 101).
- [x] `prefers-reduced-motion` deja todo quieto (regla global + componentes). Skeleton con pulso (tarea 102).

### Primitivos (4b)
- [x] `SegmentedControl` con contador, teclado y selección distinguible sin depender solo del color.
- [x] `EstadoChip` (4 tonos con punto) es la base de `StatusChips`, `EstadoCarteraChip`, `CotizacionEstadoChip` y `SenalFacturaChip`/`NivelSenalChip`. «Activo» ya no se muestra.
- [x] Etiquetas de campo según DS-1 (fijas arriba, o variante B anotada), sin cambios en los consumidores. Los adornos no desalinean la etiqueta.
- [x] `DateField` en `dd/mm/aaaa` con valor ISO; `LocalizationProvider` global.
- [x] `SubmitButton` conserva el ancho, muestra el verbo en curso e ignora el doble clic.
- [x] Toast nuevo (aspecto del lienzo, `action`, `role` correcto), compatible con las llamadas existentes.
- [x] `FilterMenuButton` y `RowActionsMenu` (32 px, destructivas dentro del menú) operables con teclado.

### Patrones (4c)
- [x] `AppDataGrid`: búsqueda de 340 px, `estados`, filas de 56 px, columnas que llenan el ancho, `colPrincipal`, paginación oculta en vacío.
- [x] `FormSection` (`sectionTitle` + divisor, 16/40) sin títulos encimados; `FormGrid` sin huérfanos; `FormSubgroup` para subgrupos.
- [x] `LineasEditor`: encabezados de columna, sin caja anidada, papelera de 36 px alineada, «Agregar línea» debajo, totales a la derecha.
- [x] `AppDialog` en una sola superficie, padding de 24, `lg`, error arriba del formulario con «Reintentar», transición fundido + 8 px.
- [x] Regla modal o página (DS-4) con la lista de formularios por tamaño en `spec.md`.
- [x] `FichaHeader`/`FichaSeccion` sin latón; `KpiCard` seleccionable; cartera sin indicadores duplicados; documentos sin cajas anidadas ni papelera roja suelta.

_4c hecha el 2026-10-30 (`feat/ds-patrones`, tareas 111–121): lint y tsc en verde. La revisión visual en claro y oscuro queda para la tarea 160 y para el PR, porque las pantallas piden sesión; la tabla con `estados`, el formulario con `FormGrid` y `LineasEditor` se ven en `/estandares` al hacer la 4f (143–144). Los 40 px entre secciones de formulario y los 48 px entre secciones de ficha se aplican al migrar los contenedores (150, 151 y 154)._
### Carga, feedback y fallbacks (4d)
- [x] Una sola señal por nivel; loader global con 150 ms de retardo y 400 ms de mínimo (constantes de `tokens.ts`).
- [x] `atoms/Skeletons` alimenta `PageLoader`, `DashboardSkeletons` y los `Suspense` de sección. Los 23 `loading.tsx` auditados (tabla en la tarea 123).
- [ ] Éxito: el modal cierra, el ítem se resalta 2 s y aparece el toast con el verbo + «Ver». «Deshacer» solo en reversibles (lista en la tarea 157). _Pendiente: las piezas están (`useResaltado`, `highlightId`, toast con acción de la 4b); su uso en cada alta y edición es la tarea 157._
- [x] Error de acción: el modal sigue abierto con los datos intactos y la alerta arriba con «Reintentar». _(En `AppDialog` desde la 4c; cada formulario pasa `onRetry` al migrar, 150–151.)_
- [x] Operaciones largas auditadas y en `useGlobalLoader` (lista en la tarea 125).
- [x] `Fallback` único; `EmptyState`/`ErrorState` como envoltorios; 21 `error.tsx` con `RouteError`; `not-found.tsx` global y de `(protected)`; decisión sobre `forbidden` anotada; «—» en celdas vacías.

_4d hecha el 2026-10-30 (`feat/ds-carga`, tareas 122–130): lint, tsc y build en verde. La revisión visual queda para el PR y para la 160 (las pantallas piden sesión)._

### Marca y decorativo (4e)
- [x] `FileteLaton` es el único decorativo: filete del sidebar, punto del ítem activo, login, documento público, barra de navegación (3 px, arriba) y loader global. Duraciones como constantes (cierra el pendiente (c)).
- [x] `BrandLoader` sin vaivén; `NavigationProgress` y `BrandLoader` conservan el retardo, el mínimo, `role="status"` y la versión quieta.
- [x] `BrandMark`, `isotipo.ts` e `icon.svg` con el isotipo provisional Puerto (el logo real sigue en el pendiente (g)).
- [x] `AppShell` sin `ActiveStripes`, con márgenes 16/24/64 y 48 px entre bloques. `CreditoResumen` como superficie normal con el exceso comunicado por texto.
- [x] PDF de cotización y correo de recordatorio con la marca y las fuentes nuevas (tarea agregada en 21 y 09); el PDF de contratos no cambia. _Las fuentes nuevas quedan registradas en código, pero faltan los TTF en `src/lib/pdf/fuentes/` (ver tarea 138): hasta entonces, Helvetica._
- [x] `PeneroStripes.tsx` borrado; `rg -i "penero|hull|ochre|brand\.red|brand\.trim|barlow" src` vacío.

_4e hecha el 2026-10-30 (`feat/ds-marca`, tareas 131–140): lint, tsc y build en verde. Revisión visual pendiente para el PR y la 160 (las pantallas piden sesión)._

### Catálogo vivo (4f)
- [ ] `/estandares` partido en secciones (Fundamentos, Primitivos, Patrones, Carga y feedback, Fallbacks), con índice y vista en ambos modos.
- [ ] Cada primitivo en todos sus estados y cada patrón de los artboards 2–4 presente en el catálogo.
- [ ] Tabla «Componentes compartidos» de `spec.md` al día (tarea 146).

### Migración y verificación (4g)
- [ ] Listados (tareas 147–149) con el patrón único de filtros y sin chips de estados normales.
- [ ] Formularios (tareas 150–151) con `FormSection`/`FormGrid`/`LineasEditor`/`SubmitButton` y tamaño de modal según DS-4.
- [ ] Sin `type="date"` (tarea 152) ni `ToggleButtonGroup` fuera de `SegmentedControl` (tarea 153).
- [ ] Fichas (tarea 154), `/tasas` con 2 decimales en las tarjetas (tarea 155) y dashboard (tarea 156) migrados.
- [ ] Feedback después de la acción aplicado (tarea 157).
- [ ] Barridos de la tarea 158 anotados aquí con su resultado.
- [ ] Contraste AA de la tarea 159: pares anotados aquí con su razón.
- [ ] Revisión visual de la tarea 160: cada pantalla marcada en claro/oscuro y en 375/768/1024/1440 px contra los artboards 1–4.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores, corridos tras cada tarea y al cierre (tarea 161).

## Pendientes / deuda técnica
- [ ] Persistencia del modo via cookie: la cookie `mui-mode` se escribe desde el cliente (en `themeStorage.ts`); el `layout.tsx` la lee y fija `data-mui-color-scheme` en `<html>`. No se usa Server Action — el primer render server-side no conoce la preferencia y depende de `InitColorSchemeScript` (igual que el flujo recomendado por MUI). Diferido: no hay Server Action dedicada para setear la cookie antes del primer render.
- [ ] Los ítems no marcados de "Loaders y estados" y "Notificaciones y confirmaciones" (por pantalla) se completan en los módulos 01-05 al construir sus pantallas reales; los componentes base ya existen y `layout.tsx` ya envuelve con `NotificationProvider`/`ConfirmProvider`.
- [ ] `@mui/material-nextjs` NO se instaló: se mantuvo el `ThemeRegistry` custom (CacheProvider + useServerInsertedHTML) y se usó `InitColorSchemeScript` de `@mui/material` directamente, que ya trae la integración necesaria. Documentado en `tasks.md` tarea 1.

### Pendientes de la Fase 2a (2026-10-07)
- [ ] (a) Volver desde una ficha a una tabla en modo servidor con la caché del router (la página vive en `?pagina=` escrita con `history.replaceState`): probarlo en la primera tabla que se migre a servidor (Fase 2b).
- [ ] (b) Filas clicables de `AppDataGrid` (`getRowHref`) solo responden al mouse: `onRowClick` no se dispara con Enter. Decidir en la Fase 2b (enlace en la primera celda, manejar `onCellKeyDown` u otra solución). _(Resuelto el 2026-10-07 en 10-refactor-visual-clientes: `onCellKeyDown` navega con Enter solo si `event.target === event.currentTarget` (el foco está en la propia celda, no en un control dentro de ella ni en el menú `⋮`, cuyo portal también burbujea al árbol de la celda) y la columna no es `ACTIONS_FIELD` ni `type: 'actions'`. Las flechas siguen siendo de la grilla; en `xs` las tarjetas ya eran `Link`. Implementado; falta la prueba con teclado en navegador del usuario, ver `10-refactor-visual-clientes/checklist.md`.)_
- [x] (c) _(Cerrado el 2026-10-30, tareas 131–133: `FILETE_SWEEP_MS`, sin `penero-bob`, `TIEMPOS.NAV_RETARDO_MS`.)_ Duraciones escritas a mano en animaciones en bucle: `PeneroSweep` 1400 ms, `BrandLoader` 2400 ms (`penero-bob`) y el retardo de 100 ms de `NavigationProgress`. Pasarlas a constantes o anotar la excepción en `spec.md`.
- [x] (d) `DocumentoUpload` sigue habilitado mientras `ClienteForm` guarda (no recibe `disabled`). _(Resuelto el 2026-10-07 en 10-refactor-visual-clientes: prop `disabled` (subir, reemplazar, eliminar y soltar; "Ver" sigue activo) y `ClienteForm` la pasa con `isPending`. Verificado en código.)_
- [ ] (e) Capas que ya venían mal (anteriores a la Fase 2): `ClienteForm` llama directo a `representanteLegalRepository` desde el cliente, y `authService` (`getUsuarioActual`) consulta `perfiles` sin repositorio. _(Proveedores, 11-refactor-visual-proveedores, 2026-10-07: el caso análogo quedó resuelto en proveedores — `ProveedorForm` ya no consulta repos desde el navegador; representantes y documentos llegan por props desde la ficha/listado, que los trae del servidor. `ClienteForm` sigue pendiente; el patrón para cerrarlo está en `useProveedorAcciones`/`datosEdicion`.)_
- [ ] (f) Retirar `AppShellNestingContext` y la rama sin `usuario` de `AppShell` cuando `cobros/page.tsx` y `pedidos/page.tsx` dejen de envolverse en `<AppShell>`, y quitar el alias `--font-geist-mono` de `globals.css` cuando los archivos de 08-tasas (`CompraForm`, `PedidoForm`, `RegistrarPagoDialog`, `PagoProveedorDialog`) dejen de usarlo.
- [ ] (g) Logo real: reemplazar dentro de `BrandMark`, regenerar `src/app/icon.svg`, generar `apple-icon.png`, borrar `src/app/favicon.ico` y los SVG de ejemplo de `public/`.
- [x] (h) (verificador) `AppDataGrid` usa `PeneroSweep` como barra de carga de las tarjetas en `xs`, un quinto lugar para las franjas que la spec no permite. Cambiarlo por un `LinearProgress` neutro o anotar la excepción en `spec.md`. _(Resuelto el 2026-10-07: `LinearProgress`.)_
