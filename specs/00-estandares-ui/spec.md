# 00 — Estándares de UI/UX

## Por qué existe este módulo

Cada módulo (`01` a `05`) construye pantallas. Sin un estándar escrito, cada agente que ejecute una tarea de UI vuelve a decidir "¿cómo hago el loader?", "¿este botón usa Tailwind o `sx` de MUI?", "¿qué tamaño de fuente lleva un título de página?" — eso cuesta tokens (re-derivar la misma decisión) y produce pantallas inconsistentes entre módulos.

**Regla de oro para cualquier agente ejecutor**: antes de escribir una pantalla o componente nuevo, revisar la tabla de "Componentes compartidos" de este documento. Si ya existe algo que resuelve el caso, se reusa. Si no existe pero el patrón es genérico (aplica a más de un módulo), se crea aquí, en `components/atoms` o `components/molecules`, no dentro de la carpeta del módulo que lo necesitó primero.

Este módulo se ejecuta **antes de `01-auth`** (el login ya debe usar estos estándares) y sus componentes se siguen ampliando según lo que vayan necesitando los módulos siguientes — no es "hacer todo el design system de una vez", es dejar la base + las reglas para no reinventar en cada pantalla.

## Decisión de capas: Tailwind vs MUI

- **MUI** es dueño de: color, tipografía, elevación/sombras, radios, espaciado dentro de un componente (`sx`). Ya está así en `/SPEC.md` §3 y en `theme.ts`.
- **Tailwind** es dueño de: layout entre componentes (`flex`, `grid`, `gap`, márgenes entre bloques, anchos responsivos). **Nunca clases de color de Tailwind** (`text-red-500`, `bg-white`, etc.) — eso rompe el modo oscuro porque Tailwind no conoce los color schemes de MUI. Esto ya estaba implícito en `/SPEC.md` §3 ("Tailwind v4 (layout/spacing; preflight desactivado)"); aquí se hace explícito y obligatorio.
- Si una pantalla necesita un color que no es ninguno de los `palette` de MUI, se agrega como token nuevo al theme (ver abajo), no como valor hardcodeado ni clase de Tailwind.

## Modo oscuro / claro

Estado actual: `src/theme/theme.ts` tiene `cssVariables: true` (correcto, es lo que permite cambiar de esquema sin re-renderizar todo) pero `palette.mode: 'light'` fijo — no hay modo oscuro todavía.

Estándar a implementar:

1. `theme.ts` pasa de `palette: {...}` a `colorSchemes: { light: {...}, dark: {...} }` (API de MUI v7 para cssVariables). Paleta oscura: no son los mismos colores a menor opacidad — ajustar `background.default`/`background.paper` a grises oscuros reales (`#121212`/`#1e1e1e` como base) y verificar contraste de `primary`/`secondary` sobre ese fondo (AA mínimo, ver sección de accesibilidad).
2. Persistencia de preferencia: cookie (no solo `localStorage`) para que el servidor pueda renderizar el `<html>` con el esquema correcto desde el primer byte y evitar parpadeo (flash of wrong theme). Usar `InitColorSchemeScript` de `@mui/material-nextjs` si se agrega esa dependencia, o un script inline equivalente si se prefiere mantener el `ThemeRegistry` custom actual.
3. Toggle: componente `components/atoms/ColorModeToggle.tsx` (ícono sol/luna), ubicado en el `AppBar` de `AppShell.tsx`. Tres estados: `light`, `dark`, `system` (por defecto `system`).
4. Tailwind no necesita variante `dark:` porque no maneja color (ver sección anterior) — si en el futuro se decide que Tailwind sí maneje algún color de layout (ej. un borde sutil), se define el custom variant en `globals.css` apuntando al atributo que use MUI (`data-mui-color-scheme`), nunca `prefers-color-scheme` directo, para que ambos sistemas queden sincronizados con el mismo toggle.

## Tipografía

Fuente ya definida: Geist Sans (texto) / Geist Mono (números/código) — mantener, no cambiar sin pedirlo el usuario.

| Uso | Variant MUI | Cuándo |
|---|---|---|
| Título de página (ej. "Clientes", "Inventario") | `h4` | Uno solo por página, dentro de un `PageHeader` (ver componentes compartidos) |
| Título de sección dentro de una página | `h6` | Encabezado de card/tabla |
| Texto de tabla / formulario | `body2` | Default de DataGrid y form labels |
| Texto secundario / ayuda | `caption` + `color="text.secondary"` | Hints bajo un campo, timestamps |
| Números monetarios y de peso | `body2` con `fontFamily: 'var(--font-geist-mono)'` | Para que las cifras alineen visualmente en columnas (tabular figures) |

No usar tamaños de fuente arbitrarios (`fontSize: 13`) — siempre un `variant` de la escala o, si hace falta algo intermedio, se agrega una nueva entrada a esta tabla primero, no se improvisa en el componente.

## Responsive

Breakpoints: los de MUI por defecto (`xs <600, sm <900, md <1200, lg <1536, xl ≥1536`) — no se definen breakpoints propios.

- **`AppShell.tsx` actual no es responsive** (el `Drawer` es `variant="permanent"` con ancho fijo 240px, se monta encima del contenido en pantallas chicas). Estándar: `Drawer` pasa a `variant="temporary"` por debajo de `md`, con un botón de menú (`IconButton` + `MenuIcon`) en el `AppBar` que lo abre/cierra; en `md` y superior sigue `permanent` como está.
- Tablas (`DataGrid`): en `xs`/`sm`, ocultar columnas secundarias (usar `columnVisibilityModel` de DataGrid) en vez de forzar scroll horizontal como único recurso — definir por tabla cuáles columnas son "esenciales" vs "secundarias" al construirla.
- Formularios con varios campos en fila (`Grid` de MUI): una columna en `xs`, dos en `sm+`, nunca más de 2 columnas de inputs de texto (3+ se sienten apretados incluso en desktop).

## Loaders y estados de carga

Regla: **nunca una pantalla en blanco mientras carga**. Tres niveles:

1. **Carga de página completa** (navegación entre rutas): `app/<ruta>/loading.tsx` de Next.js, renderiza `components/atoms/PageLoader.tsx` (un `Skeleton` del layout de esa pantalla, no un spinner centrado genérico — un skeleton de tabla si la página es una tabla, de formulario si es un formulario).
2. **Carga de datos dentro de un componente ya montado** (ej. refrescar una tabla): `Skeleton` de MUI sobre las filas, o el prop `loading` nativo de `DataGrid`. Nunca ocultar la tabla completa y mostrar un spinner solo — mantener la estructura visible.
3. **Acción puntual** (guardar un formulario, confirmar un diálogo): `CircularProgress` tamaño 16-20px **dentro** del botón que disparó la acción (reemplaza el texto del botón o va al lado), botón `disabled` mientras dura. Nunca bloquear toda la pantalla con un overlay para una sola acción salvo que la acción afecte a toda la pantalla (ej. generar un PDF de contrato).

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
| `PageLoader` | `atoms` | Skeleton de carga de página completa |
| `PageHeader` | `molecules` | Título `h4` + acciones de la página (ej. botón "Nuevo") |
| `EmptyState` | `molecules` | Lista/tabla vacía |
| `ErrorState` | `molecules` | Error al cargar datos |
| `ConfirmDialog` | `molecules` | Confirmación de acción destructiva |
| `AppShell` | `templates` | Ya existe — se actualiza para responsive (ver arriba) |
| `NotificationProvider` | `organisms` | Toasts de éxito/error, vía `useNotify()` |

Además de los anteriores: `lib/useConfirm.tsx` (`ConfirmProvider` + `useConfirm`), `lib/useNotify.ts` (re-export del hook), `lib/themeStorage.ts` (`StorageManager` de MUI que persiste el modo en cookie + localStorage).

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
