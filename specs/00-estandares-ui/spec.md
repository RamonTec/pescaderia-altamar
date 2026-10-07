# 00 — Estándares de UI/UX

## Por qué existe este módulo

Cada módulo (`01` a `05`) construye pantallas. Sin un estándar escrito, cada agente que ejecute una tarea de UI vuelve a decidir "¿cómo hago el loader?", "¿este botón usa Tailwind o `sx` de MUI?", "¿qué tamaño de fuente lleva un título de página?" — eso cuesta tokens (re-derivar la misma decisión) y produce pantallas inconsistentes entre módulos.

**Regla de oro para cualquier agente ejecutor**: antes de escribir una pantalla o componente nuevo, revisar la tabla de "Componentes compartidos" de este documento. Si ya existe algo que resuelve el caso, se reusa. Si no existe pero el patrón es genérico (aplica a más de un módulo), se crea aquí, en `components/atoms` o `components/molecules`, no dentro de la carpeta del módulo que lo necesitó primero.

Este módulo se ejecuta **antes de `01-auth`** (el login ya debe usar estos estándares) y sus componentes se siguen ampliando según lo que vayan necesitando los módulos siguientes — no es "hacer todo el design system de una vez", es dejar la base + las reglas para no reinventar en cada pantalla.

## Decisión de capas: Tailwind vs MUI

- **MUI** es dueño de: color, tipografía, elevación/sombras, radios, espaciado dentro de un componente (`sx`). Ya está así en `/SPEC.md` §3 y en `theme.ts`.
- **Tailwind** es dueño de: layout entre componentes (`flex`, `grid`, `gap`, márgenes entre bloques, anchos responsivos). **Nunca clases de color de Tailwind** (`text-red-500`, `bg-white`, etc.) — eso rompe el modo oscuro porque Tailwind no conoce los color schemes de MUI. Esto ya estaba implícito en `/SPEC.md` §3 ("Tailwind v4 (layout/spacing; preflight desactivado)"); aquí se hace explícito y obligatorio.
- Si una pantalla necesita un color que no es ninguno de los `palette` de MUI, se agrega como token nuevo al theme (ver abajo), no como valor hardcodeado ni clase de Tailwind.

## Identidad visual "Peñero" (aprobada el 2026-10-06)

**Muestra visual aprobada por el usuario el 2026-10-07**: [Estándares visuales Altamar](https://claude.ai/artifact/3WKKVWcmPJVK7MnaKEPDyo) (lienzo privado del usuario). Tiene sistema base, loaders, shell con la tabla de Clientes y el indicador de facturas, modal en curso, y el teléfono con tarjetas y diálogo a pantalla completa, cada uno en claro y oscuro. Es la referencia visual de la Fase 2: si esta spec y la muestra difieren, se consulta al usuario.

Marca: **Altamar Sea Food**. La dirección se inspira en el peñero, la lancha de pesca artesanal venezolana: casco azul petróleo, borda pintada con franjas ocre, blanca y roja, y neutros fríos de hielo y acero de cava. Los tokens viven en `src/theme/theme.ts` (`palette.*` y `palette.brand.*`); **ninguna pantalla usa hex sueltos**.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `primary` (casco) | `#0E4A5C` | `#7CC3D6` | acciones principales, selección, enlaces |
| `secondary` (borda roja) | `#B8402E` | `#E58A74` | acento puntual; nunca compite con `primary` en la misma vista |
| `brand.ochre` | `#E8B931` | `#D9A92A` | **solo franjas decorativas, nunca texto ni fondo de texto** |
| `background.default` (hielo) | `#F3F6F6` | `#0F2229` | fondo de la app |
| `background.paper` | `#FFFFFF` | `#15303A` | superficies: tablas, tarjetas, diálogos, inputs |
| `text.primary` / `text.secondary` | `#13262C` / `#4A5D63` | `#E4EDEF` / `#9DB3B9` | |

**Un solo gesto memorable: la borda.** Las franjas ocre, blanca y roja (`atoms/PeneroStripes`) son el **único** elemento decorativo del sistema, y aparecen solo en cuatro lugares: el loader global, la barra de progreso de navegación, el marcador del ítem activo del menú y el panel de login. Todo lo demás es sobrio: superficies planas sobre hielo, bordes de 1 px (`divider`) y cero sombras en elementos en reposo. **No se agregan** degradados, sombras decorativas, tarjetas "flotantes" ni íconos de colores.

Jerarquía de superficies y radios (la forma comunica qué es cada cosa):

| Elemento | Radio | Elevación | Borde |
|---|---|---|---|
| Chip / etiqueta de estado (etiqueta de cava) | 4 | 0 | según estado |
| Input, botón | 6 | 0 | input: `divider` |
| Tarjeta, tabla, sección de ficha | 8 | 0 | 1 px `divider` |
| Diálogo, menú, popover, tooltip (lo que flota) | 12 (diálogo) / 8 (menú) | sombra del theme | — |

Íconos: un solo set, **`@mui/icons-material` en variante `Outlined`** (`ReceiptLongOutlined`, etc.). No se mezclan variantes rellenas y delineadas. El tamaño por defecto es 20 px en tablas y menús, y 24 px en la navegación.

## Modo oscuro / claro

Implementado: `colorSchemes` light/dark en `theme.ts`, `ColorModeToggle` (claro/oscuro/sistema) en la barra superior, persistencia en la cookie `mui-mode` + `InitColorSchemeScript`. Regla vigente: toda pantalla nueva se revisa en ambos esquemas antes de cerrar su checklist. Tailwind no maneja color (ver la sección anterior).

## Tipografía

Familias (reemplaza "Geist Sans", vigente hasta el 2026-10-06):

| Familia | Variable | Rol |
|---|---|---|
| **Barlow Condensed** 500/600 | `--font-display` | títulos (`h4`–`h6`) y cifras protagonistas (KPI, total de una factura). Condensada como la rotulación de las lanchas: carácter sin ocupar ancho. |
| **Barlow** 400/500/600 | `--font-body` | todo el texto de interfaz: formularios, tablas, menús, botones |
| Cifras tabulares | `font-variant-numeric: tabular-nums` | montos, kg y tasas en tablas, para que alineen por columna. **Verificar** si Barlow trae cifras tabulares (`tnum`). Si las trae, **se retira Geist Mono** y los montos usan Barlow tabular, para no mezclar familias. Si no, Geist Mono queda solo para montos/kg/tasas en columnas. |

Escala (no se usan tamaños sueltos; si falta uno, se agrega primero a esta tabla):

| Variant | Tamaño / interlínea | Peso | Uso |
|---|---|---|---|
| `h4` | 34 px / 1.1 (28 px en `xs`) | Condensed 600 | título de página, uno por pantalla, en `PageHeader` |
| `h5` | 26 px / 1.15 | Condensed 600 | cifra protagonista, título de ficha |
| `h6` | 20,8 px / 1.2 | Condensed 600 | título de sección, tarjeta y diálogo |
| `subtitle1` | 16 px / 1.5 | 500 | nombre principal en una fila o lista |
| `body1` | 16 px / 1.5 | 400 | texto corrido (alertas, descripciones) |
| `body2` | 14 px / 1.43 | 400 | tablas, formularios, menús |
| `caption` | 12,5 px / 1.4 | 400 | ayudas, fechas secundarias, RIF bajo el nombre |
| `button` | 14,5 px | 500 | sentence case, sin mayúsculas forzadas |

Reglas de texto:
- **Sentence case** en todo: títulos, botones, columnas. No se usan etiquetas en MAYÚSCULAS ni `overline`.
- Párrafos de ≤ 75 caracteres de ancho (`maxWidth: '75ch'`) en alertas, estados vacíos y descripciones.
- Montos: `formatUsd`/`formatBs` + cifras tabulares + alineados a la derecha en tablas. El símbolo nunca se separa del número en dos líneas.
- Copy: los botones dicen lo que hacen ("Guardar cliente", "Registrar abono"), y el toast repite el mismo verbo ("Cliente guardado", "Abono registrado"). Los errores dicen qué pasó y cómo resolverlo, sin disculpas.

## Responsive

Breakpoints de MUI por defecto (`xs <600, sm <900, md <1200, lg <1536`). Anchos obligatorios de revisión: **375, 768, 1024 y 1440 px**.

- **Shell persistente**: `AppShell` vive en `src/app/(protected)/layout.tsx`, **no** dentro de cada `page.tsx` como hoy (14 páginas lo envuelven por su cuenta). Hoy cada navegación desmonta el menú, el `loading.tsx` reemplaza la pantalla entera (menú incluido, de ahí el parpadeo) y la sesión y el rol se vuelven a pedir desde el navegador en cada página. Con el shell en el layout, el menú queda fijo, solo cambia el contenido, y la sesión y el rol llegan del servidor una sola vez.
- Navegación: `md+` menú lateral permanente de 248 px; `sm` menú lateral colapsado a riel de íconos de 72 px con tooltip; `xs` menú temporal (botón de menú en la barra superior).
- **Acción principal en móvil**: en `xs` el botón primario del `PageHeader` ("Nueva venta", "Nuevo cliente") pasa a ser un `Fab` fijo abajo a la derecha (respetando `env(safe-area-inset-bottom)`); el resto de las acciones van a un menú `⋮` en el encabezado.
- Contenido: ancho máximo de 1440 px, márgenes laterales de 16 px (`xs`), 24 px (`sm`–`md`) y 32 px (`lg+`). Espaciado vertical entre bloques: 24 px (`xs`) y 32 px (`md+`).
- Áreas táctiles de ≥ 44 × 44 px en `xs` (`IconButton` `size="medium"`, filas de lista de ≥ 56 px).
- Formularios: 1 columna en `xs`, 2 en `sm+`, nunca más de 2 columnas de inputs de texto.
- Tablas: ver "Tablas y paginación" (tarjetas en `xs`).
- Diálogos: ver "Modales" (pantalla completa en `xs`).

## Loaders y estados de carga

Regla: **nunca una pantalla en blanco, nunca un spinner genérico centrado.** Cinco niveles, de mayor a menor alcance:

| Nivel | Cuándo | Componente | Comportamiento |
|---|---|---|---|
| 1. **Global con logo** | carga inicial de la app tras el login, cerrar sesión y operaciones que bloquean toda la pantalla (generar el PDF de un contrato, reinicios de datos) | `organisms/BrandLoader` (pantalla completa) + `useGlobalLoader()` (`show(mensaje?)` / `hide()`, contador para llamadas anidadas) | Logo de Altamar centrado; debajo, las franjas de la borda recorren de izquierda a derecha como progreso indeterminado. **Aparece a los 150 ms** (si la operación termina antes, no parpadea) y, una vez visible, **dura al menos 400 ms**. Mensaje opcional en `body2` ("Generando contrato"). `role="status"` + `aria-live="polite"`. Con `prefers-reduced-motion`: logo estático y franjas quietas. |
| 2. **Navegación** | cambio de ruta | `atoms/NavigationProgress` (barra de 3 px con las franjas, arriba del área de contenido) + `loading.tsx` de la ruta | La barra se activa con `useLinkStatus` en los ítems del menú y con los `loading.tsx`; el menú y la barra superior no se mueven. |
| 3. **Contenido de la página** | primera carga de los datos de la pantalla | `PageLoader` (`table`, `form`, `ficha`) dentro del shell | Skeleton con la forma de la pantalla real; `Fade` (`duration.short`) al llegar el contenido. |
| 4. **Refresco de datos** | filtrar, paginar en servidor o recargar una tabla montada | `AppDataGrid` `loading` con `slotProps.loadingOverlay.variant: 'skeleton'` (o `'linear-progress'` si ya hay filas) | La estructura de la tabla nunca desaparece. |
| 5. **Acción puntual** | guardar, confirmar, enviar | `Button` con la prop nativa **`loading`** de MUI | Ver "Botones y acciones en curso". |

Logo: **el repo todavía no tiene el logo de Altamar** (`public/` solo trae los íconos de Next). Mientras llega, `atoms/BrandMark` dibuja un isotipo provisional en SVG (proa de peñero + franjas de la borda, usando los tokens `brand.*`) con la misma interfaz (`size`, `variant: 'full' | 'isotipo'`). Cuando llegue el archivo (SVG, idealmente con versión monocroma), se reemplaza **solo dentro de `BrandMark`**, y se generan `favicon` e íconos de la app con él.

## Botones y acciones en curso

- **Toda acción asíncrona usa `loading` de MUI** (`<Button loading={isPending}>`): el botón se deshabilita solo y muestra el indicador en el lugar del texto (`loadingPosition="start"` si tiene ícono). Se reemplazan los `startIcon={isPending ? <CircularProgress …/> : null}` actuales.
- **Mientras una acción está en curso, se bloquea todo lo que podría competir con ella**: en un formulario o diálogo, `useForm({ disabled: isPending })` deshabilita todos los campos, el botón secundario ("Cancelar") queda `disabled`, y el diálogo no se cierra con Esc ni haciendo clic fuera. En una fila de tabla, el menú `⋮` de esa fila queda deshabilitado con su indicador; las demás filas siguen operables.
- **Doble envío imposible**: además del `disabled`, el handler ignora llamadas mientras `isPending` (dos clics rápidos antes del re-render).
- Consultas de solo lectura (búsqueda, filtros) **no** bloquean botones: muestran el nivel 4 de carga y cancelan la consulta anterior (debounce de 300 ms + `AbortController`).
- Jerarquía por vista: **un solo** botón `contained` (la acción principal); los secundarios `outlined` o `text`; los destructivos `color="error"` y siempre con `ConfirmDialog`. En diálogos: secundario a la izquierda, primario a la derecha.
- Tamaños: `medium` por defecto; `small` solo dentro de tablas y tarjetas densas; en `xs` los botones primarios de formularios ocupan el ancho completo.

## Tablas y paginación

Todas las tablas usan **`organisms/AppDataGrid`**, un envoltorio de `DataGrid` con los defaults del sistema. Hoy las 8 tablas repiten su configuración, y el tamaño de página varía entre 10 y 25.

- **Idioma**: `esES` de `@mui/x-data-grid/locales` aplicado **en el theme**, para todas las tablas ("Filas por página", "1–25 de 132", etc.).
- **Anatomía**: barra superior (búsqueda rápida a la izquierda, filtros como chips, acciones de tabla a la derecha) → encabezado de 44 px sobre hielo, peso 600, `text.secondary`, sin separadores de columna → filas de 52 px con divisor de 1 px → pie de paginación.
- **Columnas**: texto alineado a la izquierda; **montos, kg y tasas a la derecha, con cifras tabulares**; fechas con `formatFecha`; estados con chips de 22 px; la columna de acciones es la última, con menú `⋮` (nunca más de un ícono suelto por fila). Si la fila abre una ficha, toda la fila es clicable (`cursor: pointer`, fondo `action.hover` con `transitions.create('background-color')`) y el menú detiene la propagación.
- **Paginación**:

  | Tipo de tabla | Modo | Ejemplos |
  |---|---|---|
  | Catálogos que crecen poco | **cliente** (`paginationMode="client"`) | clientes, proveedores, productos |
  | Registros que crecen con el tiempo | **servidor** (`paginationMode="server"`, `rowCount` + `.range()` y `count: 'exact'` de Supabase, orden y filtros también en servidor) | compras, facturas, pedidos, notas de crédito, movimientos, lotes, historial de tasas, recordatorios |

  Tamaño por defecto **25**, opciones `[25, 50, 100]`. El tamaño elegido se recuerda por tabla en `localStorage` (con `try/catch`). La página actual vive en la URL (`?pagina=2`), así que volver atrás desde una ficha regresa a la misma página. En `xs` se oculta el selector de tamaño y queda "‹ 1–25 de 132 ›".
- **Móvil (`xs`)**: si la tabla define `mobileCard`, `AppDataGrid` muestra **tarjetas en lista** en vez de la grilla: línea principal (`subtitle1`), secundaria (`caption`), estado (chip) a la derecha y monto alineado. Misma paginación, misma búsqueda y el mismo menú `⋮`. Las tablas que no lo definen ocultan sus columnas secundarias (`columnVisibilityModel`). Ninguna tabla genera scroll horizontal de la página.
- **Estados**: `noRowsOverlay` → `EmptyState` con su acción ("Aún no hay compras" + "Registrar compra"); `noResultsOverlay` → "Sin resultados para «…»" + "Limpiar búsqueda"; error → `ErrorState` dentro del área de la tabla.
- Altura: la tabla crece con su contenido hasta la página (25 filas); no hay scroll interno salvo en tablas embebidas en diálogos.

## Modales

Todos los diálogos usan **`organisms/AppDialog`** (o `ConfirmDialog` para confirmar). Hoy hay 12 diálogos armados a mano con anchos y estructuras distintas.

| Tamaño | Ancho | Para |
|---|---|---|
| `xs` | 400 px | confirmaciones, bloqueo con motivo, un solo campo |
| `sm` | 600 px | formularios de una entidad simple (producto, abono, nota de crédito) |
| `md` | 900 px | formularios con secciones o pasos (cliente, proveedor, compra, venta) |

- **Anatomía**: encabezado (título `h6` = la acción, "Registrar abono"; subtítulo opcional en `body2` con el contexto, "Factura 0123 · Restaurante El Muelle"; botón cerrar `IconButton` con `aria-label="Cerrar"`) → contenido con scroll propio y divisores arriba y abajo solo cuando hay scroll → pie fijo (secundario a la izquierda, primario a la derecha).
- **`xs`**: los `sm`/`md` pasan a **pantalla completa** con entrada `Slide` desde abajo, el pie fijo respeta el área segura, y el botón primario ocupa el ancho. Los `xs` (confirmaciones) siguen centrados.
- **Comportamiento**: foco al primer campo al abrir y de vuelta al disparador al cerrar. Con cambios sin guardar (`isDirty`), cerrar (X, Esc, clic fuera) pide confirmación ("¿Descartar cambios?"). Mientras hay una acción en curso, no se puede cerrar (ver "Botones y acciones en curso"). Los errores del servidor aparecen como `Alert` arriba del pie, además del error en cada campo.
- **Nunca** un diálogo abre otro diálogo de formulario; la única excepción es `ConfirmDialog`. Si un flujo necesita más pantalla, va como pasos (`Stepper`) dentro del mismo `AppDialog md`.
- Transición: `Fade` (por defecto) en escritorio; `Slide` arriba en pantalla completa. Duraciones del theme.

## Estados vacíos y de error

- `components/molecules/EmptyState.tsx`: ícono + mensaje + (opcional) botón de acción ("Aún no hay clientes" + botón "Nuevo cliente"). Se usa en toda tabla/lista vacía — nunca una tabla vacía sin mensaje.
- `components/molecules/ErrorState.tsx`: mensaje de error legible + botón "Reintentar" cuando aplique. Se usa en los `error.tsx` de Next.js (App Router) de cada ruta y en catches de fetch de datos dentro de un componente.

## Feedback de acciones (toasts)

- `components/organisms/NotificationProvider.tsx` (o `lib/notify/` con un hook `useNotify()`): envuelve un `Snackbar` de MUI, expone `notify.success(msg)`, `notify.error(msg)`, `notify.info(msg)`. **Nunca `window.alert`/`window.confirm`** en ningún módulo.
- Toda acción que escribe en la base de datos (crear, editar, eliminar/desactivar, registrar pago, generar contrato) termina en un `notify.success` o `notify.error` — es la única forma en que el usuario sabe que algo pasó, dado que no hay recarga completa de página (Server Actions + revalidación).

## Confirmaciones

- `components/molecules/ConfirmDialog.tsx`: diálogo genérico (título, mensaje, botón de confirmar con color `error` si es destructivo, botón cancelar) controlado por un hook `useConfirm()` que retorna una promesa — evita que cada módulo escriba su propio diálogo de "¿Estás seguro?".
- Toda acción destructiva o difícil de revertir (desactivar cliente, anular factura, anular contrato, eliminar item de un formulario con datos ya ingresados) pasa por `ConfirmDialog`.

## Formularios y validación

- Librería: `react-hook-form` + `zod` (resolver `@hookform/resolvers/zod`) — **ya instaladas y en uso** (`02-clientes` las trae desde `ClienteForm.tsx`). Lo que sigue formaliza el patrón ya usado ahí para que `03-proveedores` y el resto lo repitan igual, sin inventar una convención distinta.
- **Un archivo de validación por entidad**: `src/lib/<entidad>Validation.ts` (patrón ya establecido por `src/lib/clienteValidation.ts`) — exporta las regex compartidas que aplican (`RIF_CI_REGEX`, `CEDULA_REGEX`, reusar las de `clienteValidation.ts` en vez de redeclararlas), el esquema `zod` (`<entidad>FormSchema`) y su tipo inferido (`<Entidad>FormValues`). No se crea una carpeta `schemas/` aparte; se sigue el nombre plano ya usado.
- **Mensajes de error**: se escriben inline en el propio esquema (como ya hace `clienteValidation.ts`: `z.string().min(1, 'Nombre requerido')`), en español, cortos y accionables. Si el mismo mensaje literal se repite en 2 o más entidades (ej. "Formato inválido (V-/E-/J- + números)", "Email inválido"), se extrae a un `src/lib/validationMessages.ts` compartido en ese momento — no antes, para no crear una capa de indirección para mensajes que nunca se repiten.
- **Momento de validación**: `mode: 'onSubmit'` (ya es lo que usa `ClienteForm.tsx`) — no marcar errores mientras el usuario llena el formulario por primera vez; `react-hook-form` ya revalida en `onChange` por defecto una vez que hubo un primer submit fallido, sin configuración adicional.
- **Validación cruzada** (ej. "un cliente persona jurídica requiere al menos un representante legal", ya implementado con `.superRefine()` en `clienteFormSchema`; o "peso de salida ≤ peso de entrada" en `04-inventario`, "fecha de entrega no anterior a hoy" en `05-ventas`): siempre con `.refine()`/`.superRefine()` dentro del esquema `zod`, nunca como `if` suelto en el componente de formulario.
- **Gap detectado a corregir — validar también en la Server Action**: hoy `clientes/actions.ts` hace `JSON.parse(raw)` pero **no** vuelve a correr `clienteFormSchema` sobre esos datos antes de escribir en la base — la validación vive solo en el cliente. Esto es una tarea pendiente de `02-clientes` (agregar `clienteFormSchema.safeParse(input)` al inicio de cada action, devolver el error estructurado si falla) y la regla a seguir desde `03-proveedores` en adelante **desde el primer commit**, no como arreglo posterior: toda Server Action que reciba datos de un formulario corre `<entidad>FormSchema.safeParse(input)` antes de tocar el repositorio.
- **Validación async** (ej. verificar que un `rif_ci` no esté duplicado): no se dispara en cada tecla; se verifica en la Server Action al enviar, y si falla, se mapea el error al campo correspondiente con `setError('rifCi', { message })` de react-hook-form — el usuario lo ve igual que un error de validación normal, aunque vino del servidor. (Todavía no implementado en `02-clientes`; queda como mejora, no bloquea el MVP.)
- **Campo requerido**: el label lleva asterisco (`label="Nombre *"`), no se depende solo del atributo HTML `required` (poco visible y no estiliza con el error).
- Campos numéricos de dinero con 2 decimales visibles y de peso (kg) con 3 decimales, usando el helper compartido `components/atoms/NumberField.tsx` (ya existe) en vez de `<input type="number">` plano.
- Botón de submit: deshabilitado si el formulario tiene errores o está enviando; muestra `CircularProgress` mientras envía (ver sección Loaders).

## Transiciones y micro-interacciones

No se agrega ninguna librería de animación de terceros (Framer Motion, GSAP, etc.) — se logra un acabado fino con lo que ya trae MUI (`Fade`, `Grow`, `Collapse`, `Slide`) más `theme.transitions` para transiciones CSS simples. Cero dependencias nuevas, cero costo de bundle.

| Situación | Componente/técnica |
|---|---|
| Modal/diálogo que aparece | `Dialog` de MUI ya trae `Fade`/`Grow` por defecto — no tocar |
| Fila que se agrega/elimina (ej. items de un formulario dinámico, `useFieldArray`) | Envolver en `Collapse` (`in={visible}`) en vez de que la fila aparezca/desaparezca de golpe |
| Paso de `Skeleton` (loader) a contenido real ya cargado | `Fade` con `timeout: 200` al montar el contenido — evita el "parpadeo" de un bloque a otro |
| Snackbar de notificación | `Slide` (ya es el default de `Snackbar` de MUI, no cambiar) |
| Hover de botones/filas de tabla clickeables | CSS transition puntual vía `sx={{ transition: theme.transitions.create(['background-color', 'box-shadow']) }}` — **nunca** `transition: 'all'` (anima propiedades de más y cuesta performance) |
| Cambio de modo claro/oscuro | Transición corta de `background-color`/`color` aplicada globalmente (en `CssBaseline`/`body`) para que el cambio no sea un corte brusco |
| Navegación entre rutas | No se agrega transición de página (Next.js App Router no la da sin librería adicional) — ya queda cubierto por `loading.tsx`/`PageLoader`, que es su propio tipo de transición de contenido |

- Duración/easing: usar siempre los tokens del theme — `theme.transitions.duration.short` (~200ms) para micro-interacciones (hover, fade de skeleton a contenido) y `.standard` (~300ms) para cambios de contenido más grandes (aparecer/desaparecer una sección completa). Nunca un valor en milisegundos escrito a mano y repetido en cada componente.
- Accesibilidad: respetar `prefers-reduced-motion: reduce` — MUI ya lo hace para sus propios componentes (`Fade`, `Grow`, etc.); para transiciones `sx` custom, envolver con `@media (prefers-reduced-motion: reduce) { transition: none }` si en la práctica resultan molestas para alguien con ese ajuste activado.

## Formato de números (dinero, peso, tasas)

- `src/lib/format.ts` (nuevo, compartido por todos los módulos): `formatUsd(n)` → `$1,234.56`, `formatBs(n)` → `Bs. 45.123,45` (separador de miles `.`, decimal `,`, convención venezolana), `formatKg(n)` → `12,345 kg` (3 decimales), `formatTasa(n)` → `36,500000`. Todo módulo que muestre estos valores usa estas funciones — no `toFixed()` suelto ni formateo manual repetido.

## Componentes compartidos (catálogo — revisar antes de crear uno nuevo)

| Componente | Carpeta | Para qué |
|---|---|---|
| `ColorModeToggle` | `atoms` | Cambiar claro/oscuro/sistema |
| `NumberField` | `atoms` | Input numérico con formato USD/Bs/kg |
| `PageLoader` | `atoms` | Skeleton de carga de página completa (`table`/`form`/`ficha`); mientras está montado enciende `NavigationProgress`. `children`: skeleton extra debajo (ej. `CarteraSeccionSkeleton` en la ficha de cliente, 09) |
| `PageHeader` | `molecules` | Título `h4` + subtítulo + acciones. `primaryAction` (contained en `sm+`, `Fab` en `xs`) y `secondaryActions` (outlined en `sm+`, menú `⋮` en `xs`); `children` sigue funcionando |
| `EmptyState` | `molecules` | Lista/tabla vacía; `compact` para secciones de ficha (menos aire, título `subtitle1`) |
| `ErrorState` | `molecules` | Error al cargar datos |
| `ConfirmDialog` | `molecules` | Confirmación de acción destructiva |
| `AppShell` | `templates` | Shell persistente en `(protected)/layout.tsx`: menú 248 px (`md+`) / riel 72 px (`sm`) / temporal (`xs`), barra superior con `topBarStart`, cuenta y modo; usuario y rol por props desde el servidor |
| `NotificationProvider` | `organisms` | Toasts de éxito/error, vía `useNotify()` |
| `DocumentoUpload` | `molecules` | Subir/ver/reemplazar documentos vía adaptador `DocumentoStore` (drag&drop, validación, compresión, reemplazo real); `disabled` bloquea subir, reemplazar, eliminar y soltar (no "Ver") mientras el formulario dueño guarda; el botón usa `loading` |
| `DocumentosRequeridos` | `molecules` | Documentos exigidos por un proveedor según su tipo de persona (cédula, RIF, acta, cédulas de representantes), con ✓/⚠ según los presentes; `disabled` propaga a cada `DocumentoUpload` mientras el form dueño guarda (11-refactor-visual-proveedores) |
| `RepresentantesLegalesFieldArray` | `molecules` | Lista editable de representantes legales (tipado genérico, filas con `Collapse`) |
| `CopyableText` | `molecules` | Texto + botón copiar al portapapeles + toast |
| `StatusChips` | `molecules` | Chips `soft` de 22 px: Activo (solo con `mostrarActivo`, en listados) / Inactivo, Bloqueado (tooltip con el motivo, convive con Activo) y Doc. incompleta (tooltip con faltantes). Sin chips que mostrar no renderiza nada |
| `PeneroStripes` | `atoms` | Franjas de la borda: único elemento decorativo (ver "Identidad visual") |
| `BrandMark` | `atoms` | Logo de Altamar (`variant: full / isotipo`, `size`, `orientation`); isotipo provisional en SVG hasta tener el archivo real (ícono de la app en `src/app/icon.svg`) |
| `NavigationProgress` | `atoms` | Barra de 3 px con las franjas; `NavigationProgressProvider` + `NavLinkStatus` (`useLinkStatus` dentro de cada `Link`) + `useNavigationPending(activo)` |
| `BrandLoader` + `useGlobalLoader` | `organisms` / `lib` | Loader global con logo: `show(msg, { untilNavigation })` devuelve `release`, `hide()`, `run(tarea, msg)`; 150 ms de retardo, 400 ms mínimo, contador |
| `AppDataGrid` | `organisms` | Toda tabla: toolbar (búsqueda, filtros, acciones), `mode` cliente/servidor (`rowCount` + `onQueryChange`), `?pagina=` en la URL (`paginaDesdeParam` para `page.tsx`), tamaño recordado por `tableId`, `mobileCard` en `xs`, `hideOnMobile`, `getRowHref` (clic o Enter en una celda; recuerda el origen para `FichaHeader`), estados vacío/sin resultados/error/cargando. Búsqueda en modo cliente: `normalizeSearch` (por defecto `normalizarBusqueda`, sin acentos y minúsculas; `normalizarBusquedaSinSeparadores` quita además espacios, puntos y guiones) y `getSearchValues(row)` (por defecto, el valor crudo de cada columna); cada palabra debe aparecer en algún valor, igual en grilla y tarjetas |
| `AppDialog` | `organisms` | Todo diálogo de formulario: `size` xs/sm/md, `title`/`subtitle`, `primaryAction`, `pending`, `dirty`, `error`, `onSubmit` (el diálogo es un `<form>`), `footer` (pie custom que reemplaza el estándar, ej. navegación de Stepper; 11-refactor-visual-proveedores); pantalla completa + `Slide` en `xs`, cierre protegido, foco al primer campo. Referencia: `ClienteForm` |
| `colMonto` / `colKg` / `colTasa` / `colFecha` / `colEstado` / `colAcciones` + `EstadoChip` | `organisms/appDataGridColumns` | Columnas estándar de `AppDataGrid` (formato de `lib/format.ts`, montos a la derecha, chip `soft`, menú `⋮`) |
| `RowActionsMenu` | `molecules` | Menú `⋮` de una fila o tarjeta, con estado `pending` y opciones destructivas |
| `FichaHeader` | `molecules` | Encabezado de ficha: vuelta (`backHref`, `backLabel`; `router.back()` si se vino de ese listado, para conservar `?pagina=` y filtros), nombre `h5` (`component="h1"`), `meta` (documento, tipo, chips), `primaryAction` (`outlined` en `sm+`, primera opción del `⋮` en `xs`), `menuActions` (`RowAction[]`, en `RowActionsMenu`) y `pending` (10-refactor-visual-clientes) |
| `BloqueoDialog` | `organisms` | Bloqueo con motivo obligatorio (clientes y proveedores): `AppDialog xs`, primario `color="error"` con `loading`, `pending` y `dirty` (motivo escrito) protegen el cierre, guarda contra doble envío; error del motivo en el campo, otros en el `Alert` |
| `PeneroSweep` | `atoms` (en `PeneroStripes.tsx`) | Franjas barriendo (progreso indeterminado) para `NavigationProgress` y `BrandLoader` |
| `TasaChip` | `molecules` | Chip de una tasa referencial: valor, fuente, fecha valor y aviso de "arrastrada" (08-tasas) |
| `TasaSelector` | `organisms` | Selector de tasa de una operación (08-tasas): referencial por fecha (BCV/paralela, Server Action con debounce) o manual con desviación en vivo; escribe `tasa_origen`/`tasa_fuente`/`tasa` en el form dueño (`FormProvider`); `pedirConfirmacionTasaManual` centraliza el ConfirmDialog del umbral |
| `EstadoCarteraChip` (+ `COLOR_ESTADO_CARTERA`) | `atoms` | Estado de cobro/pago de un documento de cartera: Vencida/Por vencer/Pendiente/Pagada/Anulada, chip `soft` 22 px (09-cuentas-por-cobrar; ficha de cliente, `/cobros`, futuro CxP) |
| `CarteraIndicador` | `molecules` | Ícono `ReceiptLongOutlined` + badge coloreado por el peor estado de un `ResumenCartera`; tooltip con conteos, montos (si el resumen los trae) y último recordatorio; accesible por teclado y táctil sin abrir la fila (09; listado de clientes, futuro proveedores) |
| `CarteraResumenCards` (+ `CarteraSeccionSkeleton`) | `molecules` | Cuatro tarjetas Vencidas/Por vencer/Pendientes/Pagadas con cantidad y monto (si hay `montos_usd`); con `onSeleccionar` filtran la tabla (09; ficha de cliente, `/cobros`) |
| `DiasCreditoField` | `molecules` | Días de crédito de una venta: `NumberField` entero, atajos 7/15/30, "Vence el …" en vivo y aviso si difiere de lo habitual del cliente (09; POS y entrega de pedido) |
| `DocumentosCarteraTable` | `organisms` | Tabla genérica de `DocumentoCartera` sobre `AppDataGrid`: número, contraparte opcional, vencimiento con "vence en / vencida hace", montos solo con `mostrarMontos`, estado; orden por gravedad, chips por estado + "Ver anuladas", `renderAcciones` (menú `⋮`), filtro controlado o inicial (09; ficha de cliente, `/cobros`, futuro CxP) |
| `RecordatorioDialog` | `organisms` | Recordatorio de cobro (admin): facturas con casillas y total en vivo, canal con disponibilidad y motivo, vista previa editable (correo en `iframe sandbox`), aviso de 24 h, WhatsApp abierto en el mismo clic y correo con `loading` (09; ficha de cliente, `/cobros`) |
| `HistorialRecordatorios` | `organisms` | Historial de recordatorios (fecha, canal, destinatario, quién, estado; error y "Reintentar" en correos fallidos) (09; ficha de cliente) |
| `TasaIndicador` | `molecules` | Chip compacto de la barra superior con las vigentes de hoy (BCV/paralela USD, EUR en `sm+`), tooltip con fecha valor/origen, ícono de advertencia si arrastrada, clic → `/tasas` (08-tasas) |

Además de los anteriores: `lib/navigationOrigin.ts` (`recordarOrigen` / `consumirOrigen`: de qué listado se abrió una ficha, para `FichaHeader`), `lib/useConfirm.tsx` (`ConfirmProvider` + `useConfirm`), `lib/useNotify.ts` (re-export del hook), `lib/themeStorage.ts` (`StorageManager` de MUI que persiste el modo en cookie + localStorage), `lib/validationMessages.ts` (mensajes de validación compartidos), `lib/actionState.ts` (`ActionState` + `toActionError`), `lib/documentoStore.ts` (`DocumentoStore` para `DocumentoUpload`), `lib/bancosVe.ts` (catálogo de bancos y utilidades de cuenta), `lib/useGlobalLoader.tsx` (`GlobalLoaderProvider` en el layout raíz + `useGlobalLoader`), variante de theme `Chip variant="soft"` (estados) y la página de muestra `/estandares` (solo desarrollo y admin). Dominio de cartera (09): `lib/cartera/` (puro: `estado.ts`, `resumen.ts`, `recordatorios/plantillas.ts`, `recordatorios/telefono.ts`, canales Strategy en `recordatorios/canales/`).

Cada módulo que cree un componente genérico nuevo (no específico de su dominio) debe agregarlo a esta tabla como parte de su propia tarea, para que el siguiente módulo lo encuentre.

## Accesibilidad (mínimo viable)

- Contraste AA (4.5:1 texto normal, 3:1 texto grande) verificado en ambos esquemas de color al definir la paleta oscura.
- Todo `IconButton` sin texto visible lleva `aria-label`.
- Ningún `:focus` se remueve vía CSS; si se reemplaza el estilo default de foco, debe seguir siendo visible.
- Formularios: `<label>` asociado a su input (MUI `TextField` ya lo hace si se usa `label`, no se debe omitir por diseño).

## Fuera de alcance (MVP)
- Internacionalización (todo queda en español, moneda USD/Bs fijas).
- Modo de alto contraste separado del modo oscuro estándar.
- Animaciones elaboradas (parallax, scroll-triggered, animaciones de página complejas) o cualquier librería de animación de terceros — las transiciones básicas ya quedan cubiertas en la sección "Transiciones y micro-interacciones" arriba.
