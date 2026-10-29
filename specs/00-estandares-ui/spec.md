# 00 — Estándares de UI/UX

## Por qué existe este módulo

Cada módulo (`01` a `05`) construye pantallas. Sin un estándar escrito, cada agente que ejecute una tarea de UI vuelve a decidir "¿cómo hago el loader?", "¿este botón usa Tailwind o `sx` de MUI?", "¿qué tamaño de fuente lleva un título de página?" — eso cuesta tokens (re-derivar la misma decisión) y produce pantallas inconsistentes entre módulos.

**Regla de oro para cualquier agente ejecutor**: antes de escribir una pantalla o componente nuevo, revisar la tabla de "Componentes compartidos" de este documento. Si ya existe algo que resuelve el caso, se reusa. Si no existe pero el patrón es genérico (aplica a más de un módulo), se crea aquí, en `components/atoms` o `components/molecules`, no dentro de la carpeta del módulo que lo necesitó primero.

Este módulo se ejecuta **antes de `01-auth`** (el login ya debe usar estos estándares) y sus componentes se siguen ampliando según lo que vayan necesitando los módulos siguientes — no es "hacer todo el design system de una vez", es dejar la base + las reglas para no reinventar en cada pantalla.

## Decisión de capas: Tailwind vs MUI

- **MUI** es dueño de: color, tipografía, elevación/sombras, radios, espaciado dentro de un componente (`sx`). Ya está así en `/SPEC.md` §3 y en `theme.ts`.
- **Tailwind** es dueño de: layout entre componentes (`flex`, `grid`, `gap`, márgenes entre bloques, anchos responsivos). **Nunca clases de color de Tailwind** (`text-red-500`, `bg-white`, etc.) — eso rompe el modo oscuro porque Tailwind no conoce los color schemes de MUI. Esto ya estaba implícito en `/SPEC.md` §3 ("Tailwind v4 (layout/spacing; preflight desactivado)"); aquí se hace explícito y obligatorio.
- Si una pantalla necesita un color que no es ninguno de los `palette` de MUI, se agrega como token nuevo al theme (ver abajo), no como valor hardcodeado ni clase de Tailwind.

## Design system (Fase 4, 2026-10-29)

**Por qué**: la Fase 3a dejó la paleta y las fuentes de Puerto, pero el usuario no quedó conforme con el acabado. La auditoría con capturas del 2026-10-29 encontró problemas en tres frentes:
- **Superficies**: el modal se ve en tres tonos en oscuro y los campos parecen huecos.
- **Señales**: hay latón en todas partes, chips en cada fila y tres patrones de filtro distintos.
- **Ritmo**: espaciado desparejo en formularios, filas de tabla de 65 px, títulos encimados, fechas `mm/dd/yyyy` y ninguna regla para el feedback después de una acción.

La Fase 4 fija un design system con fundamentos, primitivos, patrones, carga, feedback y fallbacks, y `/estandares` pasa a ser su catálogo vivo. **Reemplaza a las Fases 3b, 3c y 3d**, que no se implementaron (ver `tasks.md`).

**Referencia visual aprobada**: lienzo [Design system Altamar](https://claude.ai/artifact/74KKN8v4UZG8SKRncD3MZS) (privado del usuario), con los artboards 1 Fundamentos, 2 Listado, 3 Formulario en modal y 4 Carga/feedback/fallbacks. Los valores de esta sección salen de ahí. Los que el lienzo no define van marcados *(DS-8)* y se aplican con la propuesta mientras el usuario no diga otra cosa.

**Qué se mantiene**:
- la paleta Puerto y las decisiones P-UI1 a P-UI10;
- la tipografía Fraunces + Instrument Sans y su escala (solo se agregan dos variantes);
- las capas Tailwind/MUI, los íconos `Outlined`, el sentence case y `lib/format.ts`.

**Precedencia**: esta sección **prevalece** sobre las siguientes cuando difieren. Las secciones viejas que la contradicen llevan una nota «Fase 4».

**Dónde viven los tokens**:
- `src/theme/theme.ts`: color, superficies, tipografía y overrides de componentes.
- `src/theme/tokens.ts` (nuevo): movimiento, tiempos de carga, espaciado semántico y sombras por elevación.

Ningún componente escribe hex, milisegundos ni sombras sueltas.

### Principios

1. **Una sola señal por nivel**: si se cumple a la vez, se muestra la del nivel más alto (navegación, página, sección o acción). Nunca un spinner y un skeleton juntos.
2. **El color es para las excepciones**: vencida, bloqueado, error, aviso. Los valores normales ("Activo", "Controla stock", "Crudo") van como texto o se resuelven con el filtro.
3. **Una sola acción principal por vista** (`contained`). Las demás son neutras.
4. **El latón está restringido**: solo para foco, para la acción principal en oscuro, para el decorativo de marca (filete, punto del ítem activo, progreso de navegación, loader global) y para la acción del toast.
5. **Cada nivel tiene su superficie**: se pinta con su token, sin la capa automática de MUI.
6. **Se reusa un primitivo antes de componer uno nuevo.** Los duplicados del inventario se unifican (ver «Catálogo e inventario»).

### Superficies por nivel

| Nivel | Uso | Claro | Oscuro | Token |
|---|---|---|---|---|
| Fondo | página | `#F7F6F2` | `#0A1424` | `background.default` |
| Superficie (elevación 0) | tablas, secciones de ficha, tarjetas | `#FFFFFF`, borde `#E4E1D8` | `#121F35`, borde `#22314B` | `background.paper` + `divider` |
| Elevada (elevación 1 y 2) | modal, drawer temporal, menú, popover, listado de `Autocomplete` | `#FFFFFF` + sombra | `#1A2A45`, borde `#2C3B55` + sombra | `background.elevated` (nuevo) |
| Campo | `OutlinedInput`, `Select`, `Autocomplete` | `#FFFFFF`, borde `#A9A397` | `#0F1C31`, borde `#5E7194` (≥ 3:1) | `background.field` (nuevo) + `inputBorder` |
| Suave | encabezado de tabla, hover de fila, zonas suaves | `#F0EEE7` | `#17253D` | `background.subtle` |
| Track de segmentado | fondo del `SegmentedControl` | `#F0EEE7` | `#0F1C31` | `segmented.track` (nuevo) |
| Divisor de filas | entre filas de tabla y de lista | `#E4E1D8` | `#1D2B44` | `rowDivider` (nuevo) |
| Divisor en modal | encabezado/cuerpo/pie del modal, secciones dentro de lo elevado | `#E4E1D8` | `#2C3B55` | `dialogDivider` (nuevo) |
| Scrim | detrás del modal y del drawer temporal | `rgba(11,27,51,.55)` | `rgba(0,0,0,.6)` *(DS-8)* | `scrim` (nuevo) |

**Mecanismo**: en el esquema oscuro, MUI aclara cada `Paper` con una capa blanca según su elevación (`--Paper-overlay`, que sale de `overlays` del esquema). Por eso el `Dialog` (elevación 24) se ve más claro que su pie y sus campos. La Fase 4 **anula esa capa**: el `Paper` no lleva `background-image` y el esquema oscuro no define overlays. La superficie elevada se pinta explícitamente con `background.elevated`. La tarea 97 elige el mecanismo concreto según la versión instalada y lo documenta en `theme.ts`.

Regla del modal: el encabezado, el cuerpo y el pie usan **la misma superficie**, separados solo por un divisor `dialogDivider`. Ningún hijo de un modal pinta `background.paper` encima de lo elevado.

### Color y jerarquía

| Elemento | Claro | Oscuro |
|---|---|---|
| Acción principal (`contained`, una por vista) | `#0B1B33`, texto `#FFFFFF` | latón `#D4B27A`, texto `#241A0B` |
| Acción secundaria (`outlined`) | borde `#CFCAB9` (`outlineBorder`), texto `text.primary` | borde `#3A4B6A` *(DS-8)*, texto `text.primary` |
| Acción de texto ("Cancelar", "Agregar línea", "Ver") | `text.primary`; "Cancelar" en `text.secondary` | ídem |
| Destructiva | `error`, solo dentro de `ConfirmDialog` y como ítem del menú `⋮` | ídem |
| Selección: pestaña, segmentado, filtro, switch, checkbox, radio | `text.primary` y tokens de `segmented` | `text.primary` y tokens de `segmented` (**nunca latón**) |
| Enlace en texto | `text.primary`, subrayado | ídem |
| Foco visible | anillo de 3 px `rgba(201,166,107,.55)` (`focusRing`) | contorno de 2 px `#D4B27A`; en campos, borde `#D4B27A` |

`secondary` (latón de texto) **deja de usarse en pantalla**: los enlaces, la vuelta de `FichaHeader` y los botones de texto pasan al color de texto. El token se conserva para compatibilidad, y el latón de texto en el PDF y el correo sale de `brand.brassText`.

### Espaciado

La escala es de base 4: 4, 8, 12, 16, 20, 24, 32, 40, 48 y 64. El `spacing` de MUI **sigue en 8 px**, así que en `sx` esos valores se escriben 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6 y 8. `tokens.ts` exporta los usos semánticos para no repetir números:

| Uso | Valor |
|---|---|
| Márgenes de página | 16 (`xs`), 24 (`sm`–`md`), 64 (`lg+`) |
| Entre bloques de página (encabezado, barra de herramientas, tabla, secciones de ficha) | 48 (32 en `xs`) |
| Formulario: entre bloques campo + ayuda (vertical) | 24 |
| Formulario: entre columnas | 16 |
| Formulario: entre secciones | 40 |
| Formulario: del título de sección al contenido | 16 |
| Formulario: de la etiqueta al campo, y del campo a su ayuda | 6 |
| Padding del modal | 24 (16 en `xs`) |

### Radios y elevación

- **Radios**:
  - 4: chip, ítem de menú, tooltip.
  - 6: controles (botón, campo, opción del segmentado, `Fab`, tabla, tarjeta KPI).
  - 8: superficies, modales y el track del segmentado.
  - 0: a pantalla completa.
- **Elevación**: hay tres niveles, cada uno con sus sombras en `tokens.ts`.

| Nivel | Qué | Claro | Oscuro |
|---|---|---|---|
| 0 | reposo: borde de 1 px, sin sombra | — | — |
| 1 | menú, popover, listado de `Autocomplete`, toast | `0 12px 32px rgba(11,27,51,.14)` | `0 12px 32px rgba(0,0,0,.4)` *(DS-8)* |
| 2 | modal y drawer temporal, con scrim | `0 24px 56px rgba(11,27,51,.22)` | `0 24px 56px rgba(0,0,0,.5)` |

### Movimiento

| Token | Duración | Para |
|---|---|---|
| `rapida` | 120 ms | hover, presión, cambio de estado de un control |
| `media` | 200 ms | menús, toasts, acordeones, `Collapse` de filas |
| `lenta` | 280 ms entrada / 180 ms salida | modales y drawers |

- **Curvas**: entrada `cubic-bezier(.2,0,0,1)` y salida `cubic-bezier(.4,0,1,1)`. `theme.transitions` (`duration` y `easing`) se alimenta de `tokens.ts`, así que `transitions.create` ya las usa.
- **Animaciones permitidas**:
  - modal: fundido + 8 px hacia arriba;
  - menú y popover: fundido + escala de .96 a 1 desde el ancla;
  - toast: entra desde abajo y se va a los 5 s;
  - fila nueva o editada: fondo latón tenue (`highlight`: `#FBF4E6` en claro, `rgba(212,178,122,.12)` en oscuro *(DS-8)*) que se desvanece en 2 s;
  - botón: hover y presión en 120 ms;
  - skeleton: pulso (DS-7).
- **Nada rebota ni gira**, salvo el spinner.
- Con `prefers-reduced-motion: reduce`, todo queda quieto: hay una regla global en `globals.css` y los componentes MUI ya lo respetan.

### Tipografía (añadidos de la Fase 4)

La escala de § Tipografía no cambia. Se agregan dos variantes (con aumento de tipos):

| Variant | Tamaño / interlínea | Peso | Uso |
|---|---|---|---|
| `label` | 13 px / 1.4 | Instrument Sans 500 | etiqueta fija de campo (DS-1) y etiqueta de subgrupo |
| `sectionTitle` | 16 px / 1.4 | Instrument Sans 600 | encabezado de sección de formulario (reemplaza el `h6` de `FormSection`) |

`h6` sigue siendo el título del modal y de `ChartCard`. Las cifras grandes de tasas se muestran con 2 decimales (DS-6).

### Primitivos

Cada primitivo documenta en `/estandares` los estados que le aplican: default, hover, foco, deshabilitado, cargando, error y vacío, en claro y en oscuro.

| Primitivo | Archivo | Reglas |
|---|---|---|
| Botón | MUI `Button` + `atoms/SubmitButton` (nuevo) | La jerarquía es la de «Color y jerarquía». `size` `medium` (36 px) por defecto y `small` solo en tablas y tarjetas densas. `SubmitButton`: `pending` + `pendingLabel` ("Guardando…") muestra el spinner al inicio con el verbo en curso, **conserva su ancho** e ignora un segundo clic |
| Campo | `TextField`, `NumberField`, `PhoneField`, `RifCiField`, `Select`, `Autocomplete` | 40 px de alto. **Etiqueta fija arriba** (`label`, gap 6) en lugar de la flotante de MUI (DS-1). Se resuelve en el theme: la etiqueta siempre encogida, estática y sin muesca en el contorno, así que los consumidores no cambian. El requerido lleva asterisco y la ayuda o el error van en 12 px a 6 px bajo el campo. Un adorno (`$`, `kg`) ya no cambia la posición de la etiqueta |
| Fecha | `atoms/DateField` (nuevo, sobre `DatePicker` de `@mui/x-date-pickers`, ya instalado) | `value`/`onChange` en ISO `YYYY-MM-DD` \| `null`; muestra `dd/mm/aaaa`; ancho mínimo de 160 px; `LocalizationProvider` (dayjs `es`) global. **Prohibido `type="date"` nativo** |
| Segmentado | `atoms/SegmentedControl` (nuevo) | Componente único para filtros de estado y opciones excluyentes. Track con padding 3 y radio 8; opción de 32 px y radio 6. Opción seleccionada: en claro, fondo `#FFFFFF` + sombra `0 1px 2px rgba(11,27,51,.16), 0 0 0 1px rgba(11,27,51,.06)` y texto `#0B1B33` 600; en oscuro, fondo `#2A3B5C` (hover `#2F4268`) y texto `#FFFFFF` 600. Las no seleccionadas van en `text.secondary` 500. Contador opcional en 12 px secundario. Navegación con flechas y siempre una opción elegida. **Reemplaza a los chips-filtro y a todo `ToggleButtonGroup`** |
| Chip de estado | `atoms/EstadoChip` (nuevo; hoy vive en `appDataGridColumns`) | 22 px, radio 4, punto de 6 px y texto 12/600. Tonos `error`, `warning`, `success` y `neutral` (tabla de abajo). Los chips de dominio (`StatusChips`, `EstadoCarteraChip`, `CotizacionEstadoChip`, `SenalFacturaChip`/`NivelSenalChip`) se apoyan en él |
| Filtro adicional | `molecules/FilterMenuButton` (nuevo) | Botón-menú con el valor en la etiqueta ("Tipo: todos"), opción única o múltiple, "Limpiar". Para lo que no es estado |
| Menú de fila | `molecules/RowActionsMenu` | Disparador `⋮` de 32 px. Las opciones destructivas van dentro del menú en `error` y siempre con `ConfirmDialog`. **No hay papeleras rojas sueltas** en filas ni documentos |
| Toast | `NotificationProvider` + `useNotify` | Fondo `#0B1B33` (en oscuro, `brand.midnight` con borde `dialogDivider` *(DS-8)*), check `#ABC7F1` y acción en latón. Elevación 1, entra desde abajo y se va a los 5 s. La firma `notify.success(msg)` no cambia; se agrega `notify.success(msg, { action: { label, href \| onClick } })`. "Ver" va por defecto donde haya destino, y "Deshacer" solo en acciones reversibles (DS-3) |

**Chips de estado**:

| Tono | Estados | Claro: fondo / texto / punto | Oscuro: fondo / texto |
|---|---|---|---|
| `error` | Vencida, Bloqueado, Pérdida | `#F8E5E3` / `#8E1F18` / `#B3261E` | `#3D2228` / `#EE8A83` |
| `warning` | Por vencer, Pendiente, Doc. incompleta | `#F8EEDD` / `#7E4705` / `#A15C07` | tenue opaco *(DS-8)* / `#E9B460` |
| `success` | Pagada | `#ABC7F1` / `#0B1B33` / `#2F5E9E` | tenue opaco *(DS-8)* / `#ABC7F1` |
| `neutral` | Inactivo, Anulada, Borrador, Rechazada | `#EDEBE5` / `#4A5260` / `#8A909C` | `#22314B` / `#A3ADBD` |

Los estados normales (Activo, Controla stock, Crudo/Procesado, Enviada, Aceptada) **no llevan chip**: van como texto en su columna o se resuelven con el segmentado. Los fondos tenues de oscuro son opacos (el 16 % calculado sobre `background.paper`), para que no cambien sobre superficies distintas.

### Patrones

**Listado** (artboard 2):
- **Encabezado** (`PageHeader`): título en Fraunces (`h4`), subtítulo y la acción principal a la derecha.
- **Barra de herramientas**: búsqueda de 340 px (100 % en `xs`) + `SegmentedControl` de estado con contadores + filtros adicionales como `FilterMenuButton` + acciones de tabla a la derecha.
- **Encabezado de tabla**: `background.subtle` **a todo el ancho**, 40 px, 12/600 con 0.04em y flecha de orden simple, sin círculo.
- **Filas**: 56 px, todo centrado en vertical, con divisor `rowDivider`.
- **Columnas**:
  - **Siempre llenan el ancho**: al menos una columna de texto es flexible.
  - El identificador secundario (código, RIF) va en 12 px **bajo el nombre, en la misma celda** (`colPrincipal`).
  - Montos a la derecha con cifras tabulares, y el saldo > 0 en 600.
  - Dato faltante: "—".
- **Acciones de fila**: en `⋮` de 32 px.
- **Paginación**: se oculta en el estado vacío ("0–0 de 0" nunca se ve).

**Filtros**: hay **un solo patrón**:
- el estado (≤ 5 opciones excluyentes) va en `SegmentedControl` con contador;
- el resto de los filtros va en `FilterMenuButton`;
- el texto va en la búsqueda.

Los filtros viven en la URL (`?estado=`, como hoy). No se usan chips como filtro.

**Formulario** (artboard 3):
- **Secciones**: cada sección es un `FormSection` con encabezado `sectionTitle` y divisor inferior, a 16 px del contenido y con 40 px entre secciones. La ayuda de sección va en `body2` bajo el título, sin márgenes negativos.
- **Grilla**: los campos van en `FormGrid` (1 columna en `xs`, 2 en `sm+`, 24 vertical y 16 entre columnas). Un campo sin pareja (notas, teléfono suelto) ocupa el ancho completo (`full`), así no quedan huérfanos.
- **Subgrupos** ("Tasa", "Pago"): van como `FormSubgroup`, una etiqueta `label` y no un título de sección.
- **Líneas repetibles** (`LineasEditor`):
  - una fila de encabezados de columna (las celdas no repiten la etiqueta) y filas sin caja anidada;
  - papelera de 36 px alineada al campo;
  - "Agregar línea" como botón de texto **debajo** de las filas;
  - totales a la derecha, bajo un divisor;
  - `Collapse` al agregar y al quitar;
  - en `xs`, cada línea es un bloque con sus etiquetas.
- **Pie**: "Cancelar" (texto) + la acción principal. En pantalla completa (`xs`), el primario ocupa el ancho.
- **Modal o página** (DS-4, propuesta):

  | Formulario | Contenedor |
  |---|---|
  | 1 sección o ≤ 6 campos | `AppDialog sm` |
  | 2 secciones sin líneas repetibles | `AppDialog md` |
  | Con líneas repetibles o > 2 secciones (compra, pedido/POS, cotización, procesamiento, edición de compra, nota de crédito) | `AppDialog lg` (1120 px; pantalla completa por debajo de `md`) |

  Las páginas dedicadas (`/compras/nueva`) quedan fuera del MVP, salvo que DS-4 diga otra cosa.

**Ficha**:
- `FichaHeader`: vuelta en `text.secondary`, nombre `h5` y `meta`.
- **Secciones**: superficies de nivel 0 (`FichaSeccion`, radio 8) separadas por 48 px. Ningún bloque de color (`CreditoResumen` pasa a superficie normal).
- **Indicadores**: los KPI que filtran una tabla **son** el filtro. `CarteraResumenCards` se vuelve seleccionable y la tabla oculta sus propios chips de estado, así no se duplican.
- **Documentos**: van como lista de filas (ícono, nombre, "Ver", `⋮` con "Reemplazar" y "Eliminar"), sin cajas punteadas anidadas. La zona para soltar archivos aparece solo cuando no hay archivo.

### Carga y feedback

**Una sola señal por nivel**. El loader global aparece con un **retardo de 150 ms** y, una vez visible, dura **al menos 400 ms** (constantes en `tokens.ts`).

| Nivel | Señal | Componente |
|---|---|---|
| Navegación | filete de latón de 3 px en el borde superior, sin bloquear | `NavigationProgress` |
| Página | skeleton con la forma de la plantilla (tabla, ficha, dashboard o formulario), con pulso | `loading.tsx` → `PageLoader` (sobre `atoms/Skeletons`) |
| Sección | skeleton por bloque | `Suspense` + el skeleton de esa sección |
| Refresco de tabla | `loading` de `AppDataGrid` (la estructura no desaparece) | `AppDataGrid` |
| Acción en curso | botón con spinner y verbo en curso, ancho conservado; campos y cierre del modal bloqueados; doble clic ignorado | `SubmitButton` + `AppDialog pending` + `useForm({ disabled })` |
| Éxito | se cierra el modal, el ítem afectado se resalta 2 s y aparece un toast con el verbo ("Compra registrada") + "Ver" | `useNotify` + `highlightId` de `AppDataGrid` / `ListaResumen` |
| Error de la acción | el modal sigue abierto con los datos intactos, `Alert` **arriba del formulario** con "Reintentar" y errores de campo bajo cada campo | `AppDialog error` + `onRetry` |
| Operación larga (> 1 s y bloqueante: PDF, importación, cierre de lote) | overlay con mensaje y barra de latón | `BrandLoader` vía `useGlobalLoader().run` |

### Fallbacks

Hay un solo componente, `molecules/Fallback` (nuevo): ícono en un círculo de 44 px, título, texto (≤ 75ch) y acción. `EmptyState` y `ErrorState` pasan a ser envoltorios de compatibilidad.

| Tipo | Dónde se resuelve | Acción |
|---|---|---|
| Vacío | overlay `noRowsOverlay` de `AppDataGrid` o la sección que lo necesite | la acción principal ("Registrar compra") |
| Sin resultados | `noResultsOverlay` de `AppDataGrid` (búsqueda o filtros activos) | "Limpiar filtros" (búsqueda + segmentado + menús) |
| Error de carga de ruta | `error.tsx` de la ruta → `organisms/RouteError` | "Reintentar" + "Tus datos están a salvo" |
| Error de carga de una sección | `ChartCard error` o el componente de la sección | "Reintentar" |
| No encontrado (404) | `not-found.tsx` de la ficha, más uno global en `src/app/not-found.tsx` | volver al listado / al inicio |
| Sin permiso | `Fallback tipo="sin-permiso"`. Se usa `forbidden.tsx` solo si la versión de Next lo trae estable (verificar en `node_modules/next/dist/docs/`) | "Volver al inicio" |
| Dato faltante en celda | `appDataGridColumns` y `lib/format.ts` | "—" |

### Catálogo e inventario

- **Inventario**: hay ~150 componentes en `src/components`. La tarea 94 llena la tabla «Unificación» con cada duplicado y su destino. Duplicados ya detectados:

| Duplicado | Destino |
|---|---|
| Chips de filtro con contador (catálogos, proveedores, clientes, cartera) y `ToggleButtonGroup` de filtros (notas de crédito, pedidos, tasas) y de opciones (Contado/Crédito, USD/Bs, BCV/Paralela, Tipo de persona; 21 archivos) | `SegmentedControl` |
| `EstadoChip` de columnas, `StatusChips`, `EstadoCarteraChip`, `CotizacionEstadoChip`, `SenalFacturaChip`/`NivelSenalChip` | `EstadoChip` base |
| `CarteraResumenCards` y `KpiCard` | `KpiCard` con variante seleccionable |
| `EmptyState`, `ErrorState`, `CotizacionNoDisponible`, `PagePlaceholder` | `Fallback` |
| `PageLoader`, `DashboardSkeletons`, `CarteraSeccionSkeleton` | `atoms/Skeletons` |
| `CompraItemsFieldArray`, `PedidoItemsFieldArray`, `CotizacionItemsFieldArray`, `SalidasProcesoFieldArray` | `LineasEditor` (la lógica de cada dominio se queda en su archivo) |
| `FichaSeccion`, `ChartCard` y `Paper` sueltos como sección | `FichaSeccion` / `ChartCard` (sin `Paper` suelto) |

- **`/estandares` es el catálogo vivo**, con una sección por bloque (Fundamentos, Primitivos, Patrones, Carga y feedback, Fallbacks). Cada componente aparece en sus estados y en ambos modos lado a lado. Un componente compartido nuevo **no se da por hecho** hasta estar en el catálogo.

### Decisiones pendientes de la Fase 4

Se avanza con la propuesta mientras el usuario no responda, igual que en la Fase 3. Si cambia alguna, se toca solo el theme o el componente indicado.

| Id | Decisión | Propuesta | Estado |
|---|---|---|---|
| DS-1 | Etiquetas fijas arriba del campo en todos los formularios, en lugar de las flotantes de MUI | Sí, por theme (tarea 105) | pendiente |
| DS-2 | Normalizar las mayúsculas de los nombres al mostrarlos (el lienzo los muestra en formato título) | No normalizar: se muestran como se cargaron, salvo que el cliente decida otra cosa | pendiente |
| DS-3 | Acción del toast de éxito | "Ver" por defecto donde haya destino; "Deshacer" solo en acciones reversibles sin efectos secundarios | pendiente |
| DS-4 | Modal o página para formularios largos | La tabla de «Formulario»: `lg` para líneas repetibles o > 2 secciones, sin páginas nuevas en el MVP | pendiente |
| DS-5 | Montos USD en `en-US` (`$1,249.44`) junto a Bs en `es-VE` (`Bs. 0,00`) en la misma pantalla. Es la regla vigente de `lib/format.ts` | Se mantiene, no se cambia en la Fase 4 | pendiente de confirmar |
| DS-6 | Decimales visibles de las tasas | 2 en tarjetas y listados (`formatTasaCorta`); 6 en el detalle y en el tooltip (`formatTasa`) | pendiente |
| DS-7 | Animación del skeleton | Pulso (el `animation="pulse"` de MUI), no brillo | pendiente |
| DS-8 | Valores del esquema oscuro que el lienzo no define: scrim, sombra de la elevación 1, borde `outlined`, fondos tenues de `warning`/`success`, `highlight` y fondo del toast | Los marcados *(DS-8)* en esta sección | pendiente |

### Fuera de alcance (Fase 4)

- Páginas dedicadas para formularios largos (depende de DS-4).
- Cambiar el formato de montos (DS-5).
- El logo real (pendiente (g)) y el PDF de contratos.
- Cambiar el `spacing` base de MUI.
- Librerías de animación de terceros.

## Identidad visual "Puerto" (elegida por el cliente el 2026-10-22)

> **Reemplaza a "Peñero"** (ver "Historial" al final de esta sección). El usuario pidió explícitamente reabrir esa decisión: el cliente eligió "Puerto" para un acabado fresco, premium y confiable. Los tokens, las fuentes y el theme se implementaron en la **Fase 3a** de `tasks.md`. El resto (decorativo, componentes y revisión) lo absorbe la **Fase 4** (§ Design system), que reemplaza a las Fases 3b–3d. Hasta que termine la Fase 4, quedan restos de Peñero en el código (isotipo, ítem activo, `CreditoResumen`).

**Referencia visual**: lienzo [Rediseño Altamar](https://claude.ai/artifact/Lz4AcGuda8miEXmi4oiwtU), artboard **"B · Puerto"** (privado del usuario). Si esta spec y el artboard difieren, se consulta al usuario. Los valores marcados *(P-UIn)* no salen del artboard; el cliente los aprobó el 2026-10-22 (ver "Decisiones de la Fase 3").

Marca: **Altamar Sea Food**, colores de marca azul oscuro y blanco. Dirección: azul medianoche + blanco marfil, detalles en latón, títulos con serifa, datos en sans precisa, radios contenidos y líneas finas. Los tokens viven en `src/theme/theme.ts` (`palette.*`) y los hex de marca en `src/theme/marca.ts` (los lee también el PDF y el correo); **ninguna pantalla usa hex sueltos**.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `primary` | `#0B1B33` (medianoche), texto `#FFFFFF` | `#D4B27A` (latón), texto `#241A0B` | acción principal. En oscuro el botón principal es latón. *Fase 4*: la selección (pestaña, segmentado, switch) ya no usa `primary`; va en `text.primary` |
| `secondary` (latón texto) | `#7A5C2E` | `#D4B27A` | *Fase 4*: sin uso en pantalla (los enlaces van en color de texto); se conserva por compatibilidad |
| `success` | relleno `#ABC7F1`; texto/ícono `#2F5E9E` *(P-UI1)* | `#ABC7F1` | estados "pagada", positivo |
| `warning` | `#A15C07` | `#E9B460` | aviso, "por vencer" |
| `error` | `#B3261E` | `#EE8A83` | error, vencida, destructivo |
| `info` | `#44597A` *(P-UI6)* | `#9FB4D3` *(P-UI6)* | kg en gráficos, avisos informativos |
| `background.default` (marfil) | `#F7F6F2` | `#0A1424` | fondo de la app |
| `background.paper` | `#FFFFFF` | `#121F35` | superficies: tablas, tarjetas, diálogos, inputs |
| `background.subtle` (token nuevo) | `#F0EEE7` | `#17253D` *(P-UI10)* | encabezado de tabla, fila en hover, zonas suaves |
| `divider` | `#E4E1D8` | `#22314B` | separadores y bordes de superficie |
| borde de input | `#E4E1D8` si da 3:1; si no, `#A9A397` *(P-UI7)* | `#5E7194` (*Fase 4*; antes `#2C3B55`, casi invisible) | contorno de `OutlinedInput` |
| `text.primary` / `text.secondary` | `#0B1B33` / `#5B6474` | `#EEF0F4` / `#A3ADBD` | |
| `brand.midnight` / `brand.navy` | `#0B1B33` / `#1C2E4D` | `#0A1424` / `#1C2E4D` *(P-UI10)* | sidebar y panel de login / ítem activo, hover y selección en el sidebar |
| `brand.onMidnight` / `brand.onMidnightMuted` | `#F7F6F2` / `#A3ADBD` | `#EEF0F4` / `#A3ADBD` | texto sobre medianoche |
| `brand.brass` | `#C9A66B` | `#D4B27A` | **solo decorativo** (filete, punto del ítem activo, progreso): **nunca texto** |
| `brand.brassText` | `#7A5C2E` | `#D4B27A` | latón de texto fuera de MUI (PDF, correo); en pantalla se usa `secondary` |

`brand` pasa de las claves de Peñero (`hull`, `hullDeep`, `onHull`, `onHullMuted`, `ochre`, `red`, `trim`) a las de Puerto. Las claves viejas conviven solo durante la Fase 3 y se borran al final.

**Estados sin depender solo del color**: `success` ahora es azul, como `primary`. Todo estado se comunica con texto (etiqueta del chip) y, donde no haya texto, con ícono (`KpiCard` con `tone`, flechas de `/tasas`, `CarteraIndicador`). Un borde o un punto de color nunca es la única señal.

> *Fase 4*: los chips de estado pasan a `atoms/EstadoChip`, con punto de 6 px, tono `neutral` y fondos opacos en oscuro. Solo se usan para excepciones. Ver § Design system › Primitivos. La tabla siguiente queda como base de `soft`/`onSoft`.

**Chips de estado** (`Chip variant="soft"`, radio 4, 22 px). El theme agrega a cada color dos campos, `soft` (fondo) y `onSoft` (texto). Ya no se calcula con alfa:

| Rol | Claro: fondo / texto | Oscuro: fondo / texto |
|---|---|---|
| `success` (Pagada) | `#ABC7F1` / `#0B1B33` | `rgba(#ABC7F1, .16)` / `#ABC7F1` |
| `warning` | `#F8EEDD` / `#7E4705` | `rgba(#E9B460, .16)` / `#E9B460` |
| `error` (Vencida) | `#F8E5E3` / `#8E1F18` | `rgba(#EE8A83, .16)` / `#EE8A83` |
| `info`, `primary`, `secondary` | tenue del color / su tono oscuro *(aprobado 2026-10-22)* | tenue / su tono claro |

Estado "Pendiente" en ámbar, como en el artboard (decisión del cliente, 2026-10-22). El mapeo de cartera de `09` (`COLOR_ESTADO_CARTERA`) cambia en un solo punto: `pendiente` pasa de `info` a `warning`. `por_vencer` sigue en `warning`, así que los dos estados comparten color y se distinguen por la etiqueta, igual que ya hace `CarteraIndicador` (ámbar para pendientes y por vencer).

**Un solo gesto memorable: el latón.** El filete de latón (`atoms/FileteLaton`, reemplaza a `PeneroStripes`, *P-UI2*) es el **único** elemento decorativo. Aparece solo en:
- el filete de 2 px bajo el logo del sidebar;
- el punto del ítem activo del menú;
- el panel de login y el encabezado de `DocumentoPublicoLayout`;
- la barra de progreso de navegación;
- el loader global.

Todo lo demás es sobrio: superficies planas sobre marfil, bordes de 1 px y cero sombras en reposo. **No se agregan** degradados, sombras decorativas, tarjetas "flotantes" ni íconos de colores.

**Sidebar** (`AppShell`): fondo `brand.midnight` en ambos esquemas, nombre "Altamar" en Fraunces y filete de latón de 2 px bajo el logo. El ítem activo lleva fondo `brand.navy`, un punto de latón de 6 px a la izquierda y texto `brand.onMidnight`. Los ítems inactivos usan `brand.onMidnightMuted` y, en hover, `brand.navy` al 60 %. La barra superior es `background.paper` con borde inferior `divider`.

Jerarquía de superficies y radios (radios contenidos, líneas finas):

| Elemento | Radio | Elevación | Borde |
|---|---|---|---|
| Chip / etiqueta de estado, ítem de menú (sidebar y `Menu`), tooltip | 4 | 0 | según estado |
| Botón, input, `Fab`, tarjeta KPI, tabla (`DataGrid`, `Table`) | 6 | 0 | 1 px (input: borde de input) |
| Superficie / panel: `ChartCard`, sección de ficha, `CadenaTrazabilidad`, `Paper` genérico | 8 | 0 | 1 px `divider` |
| Diálogo | 8 *(P-UI3)*; 0 a pantalla completa | 2 (*Fase 4*: sombra de `tokens.ts` + scrim, superficie `background.elevated`) | oscuro: `#2C3B55` |
| Menú, popover, listado de `Autocomplete` (lo que flota) | 6 | 1 (*Fase 4*: sombra de `tokens.ts`, superficie `background.elevated`) | — |

### Historial: identidad "Peñero" (aprobada el 2026-10-06, reemplazada el 2026-10-22)

Se inspiraba en el peñero, la lancha artesanal: casco azul petróleo (`#0E4A5C`) y franjas de la borda ocre, blanca y roja (`atoms/PeneroStripes`, el único decorativo, en loader, barra de navegación, ítem activo y login). Usaba neutros "hielo" (`#F3F6F6`), tipografía Barlow / Barlow Condensed y radios 4/6/8/12 (diálogo 12). Su muestra fue [Estándares visuales Altamar](https://claude.ai/artifact/3WKKVWcmPJVK7MnaKEPDyo), del 2026-10-07. Siguen vigentes, porque no dependen de la identidad: las reglas de capas Tailwind/MUI, cero hex sueltos, cero sombras en reposo, íconos `Outlined`, sentence case y toda la anatomía de tablas, diálogos, loaders y formularios.

Íconos: un solo set, **`@mui/icons-material` en variante `Outlined`** (`ReceiptLongOutlined`, etc.). No se mezclan variantes rellenas y delineadas. El tamaño por defecto es 20 px en tablas y menús, y 24 px en la navegación.

## Modo oscuro / claro

Implementado: `colorSchemes` light/dark en `theme.ts`, `ColorModeToggle` (claro/oscuro/sistema) en la barra superior, persistencia en la cookie `mui-mode` + `InitColorSchemeScript`. Regla vigente: toda pantalla nueva se revisa en ambos esquemas antes de cerrar su checklist. Tailwind no maneja color (ver la sección anterior).

## Tipografía

Familias de la identidad "Puerto" (2026-10-22). Reemplazan a **Barlow / Barlow Condensed**, vigentes del 2026-10-06 al 2026-10-22, que se retiran del layout, del theme y del PDF:

| Familia | Variable | Rol |
|---|---|---|
| **Fraunces** 500/600 (serifa) | `--font-display` | 600: títulos (`h3`, `h4`, `h5` de ficha). 500: cifras destacadas (KPI, total de una factura, montos grandes) |
| **Instrument Sans** 400/500/600 | `--font-body` | todo el texto de interfaz: formularios, tablas, menús, botones, títulos de sección (`h6`) |
| Cifras tabulares | `font-variant-numeric: tabular-nums` | montos, kg y tasas en tablas y KPI. **Verificar** que Instrument Sans y Fraunces declaren `tnum` (mismo método que la tarea 30). Si alguna no lo trae, se consulta al usuario antes de sumar otra familia (P-UI8) |

Las variables CSS conservan su nombre (`--font-display`, `--font-body`), así `theme.ts` y Tailwind (`--font-sans`) no cambian de contrato. Respaldo: `Georgia, serif` para display y `system-ui, sans-serif` para cuerpo.

Escala (no se usan tamaños sueltos; si falta uno, se agrega primero a esta tabla). Sale de la muestra "B · Puerto"; `h5` no figura en ella y sale de P-UI5:

| Variant | Tamaño / interlínea | Familia y peso | Uso |
|---|---|---|---|
| `h3` | 52 px / 1.05 (42 px en `xs`) | Fraunces 600 | display: panel de login, `BrandLoader`, página pública |
| `h4` | 26 px / 1.2 (24 px en `xs`) | Fraunces 600 | título de página, uno por pantalla, en `PageHeader` |
| `h5` | 24 px / 1.2 | Fraunces 500, tabular | cifra destacada (KPI, saldo, total) y nombre en `FichaHeader` |
| `h6` | 18 px / 1.35 | Instrument Sans 600 | título de sección (`FormSection`), tarjeta (`ChartCard`) y diálogo (`AppDialog`) |
| `subtitle1` | 16 px / 1.5 | Instrument Sans 500 | nombre principal en una fila o lista |
| `subtitle2` (etiqueta) | 12 px / 1.4, `letter-spacing: 0.04em` | Instrument Sans 600 | encabezados de columna, título de `KpiCard`, rótulos cortos. **Sentence case**, sin mayúsculas |
| `body1` | 16 px / 1.55 | Instrument Sans 400 | texto corrido (alertas, descripciones) |
| `body2` | 14 px / 1.5 | Instrument Sans 400 | texto secundario, tablas, formularios, menús |
| `caption` | 12 px / 1.4 | Instrument Sans 400 | ayudas, fechas secundarias, RIF bajo el nombre |
| `button` | 14 px | Instrument Sans 500 | sentence case, sin mayúsculas forzadas |

Íconos fuera de la escala de MUI (`small` 20, `medium` 24, `large` 35): el theme agrega `fontSize="xlarge"` (40 px), que usan los íconos de estado vacío o error. Dentro de un texto, el ícono va con `fontSize="inherit"`. No se escribe `sx={{ fontSize: N }}` en íconos.

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
- Contenido: ancho máximo de 1440 px, márgenes laterales de 16 px (`xs`), 24 px (`sm`–`md`) y 64 px (`lg+`; *Fase 4*, antes 32). Espaciado vertical entre bloques: 32 px (`xs`) y 48 px (`sm+`) (*Fase 4*, antes 24/32).
- Áreas táctiles de ≥ 44 × 44 px en `xs` (`IconButton` `size="medium"`, filas de lista de ≥ 56 px).
- Formularios: 1 columna en `xs`, 2 en `sm+`, nunca más de 2 columnas de inputs de texto.
- Tablas: ver "Tablas y paginación" (tarjetas en `xs`).
- Diálogos: ver "Modales" (pantalla completa en `xs`).

## Loaders y estados de carga

> *Fase 4*: los niveles, los tiempos y el feedback posterior a la acción se rigen por § Design system › Carga y feedback. Cambios respecto de esta tabla:
> - la barra de navegación tiene 3 px y va en el borde superior;
> - la acción puntual usa `SubmitButton` (spinner + verbo en curso);
> - el skeleton sale de `atoms/Skeletons`;
> - se agregan el éxito (resaltado + toast) y el error (alerta arriba del formulario).

Regla: **nunca una pantalla en blanco, nunca un spinner genérico centrado.** Cinco niveles, de mayor a menor alcance:

| Nivel | Cuándo | Componente | Comportamiento |
|---|---|---|---|
| 1. **Global con logo** | carga inicial de la app tras el login, cerrar sesión y operaciones que bloquean toda la pantalla (generar el PDF de un contrato, reinicios de datos) | `organisms/BrandLoader` (pantalla completa) + `useGlobalLoader()` (`show(mensaje?)` / `hide()`, contador para llamadas anidadas) | Logo de Altamar centrado; debajo, un filete de latón de 2 px recorre de izquierda a derecha como progreso indeterminado (Puerto, 2026-10-22; antes: las franjas de la borda). **Aparece a los 150 ms** (si la operación termina antes, no parpadea) y, una vez visible, **dura al menos 400 ms**. Mensaje opcional en `body2` ("Generando contrato"). `role="status"` + `aria-live="polite"`. Con `prefers-reduced-motion`: logo estático y filete quieto. |
| 2. **Navegación** | cambio de ruta | `atoms/NavigationProgress` (barra de 2 px de latón, antes 3 px con las franjas, en el borde inferior de la barra superior) + `loading.tsx` de la ruta | La barra se activa con `useLinkStatus` en los ítems del menú y con los `loading.tsx`; el menú y la barra superior no se mueven. |
| 3. **Contenido de la página** | primera carga de los datos de la pantalla | `PageLoader` (`table`, `form`, `ficha`) dentro del shell | Skeleton con la forma de la pantalla real; `Fade` (`duration.short`) al llegar el contenido. |
| 4. **Refresco de datos** | filtrar, paginar en servidor o recargar una tabla montada | `AppDataGrid` `loading` con `slotProps.loadingOverlay.variant: 'skeleton'` (o `'linear-progress'` si ya hay filas) | La estructura de la tabla nunca desaparece. |
| 5. **Acción puntual** | guardar, confirmar, enviar | `Button` con la prop nativa **`loading`** de MUI | Ver "Botones y acciones en curso". |

Logo: **el repo todavía no tiene el logo de Altamar** (`public/` solo trae los íconos de Next). Mientras llega, `atoms/BrandMark` dibuja un isotipo provisional en SVG. En Peñero era la proa con las franjas de la borda; en Puerto, *P-UI4*, es una proa en `brand.midnight` (o `brand.onMidnight` sobre medianoche) con un filete de `brand.brass`, más el nombre "Altamar" en Fraunces 600 en la variante `full`. La interfaz es la misma (`size`, `variant: 'full' | 'isotipo'`). Cuando llegue el archivo (SVG, idealmente con versión monocroma), se reemplaza **solo dentro de `BrandMark`**, y se generan `favicon` e íconos de la app con él.

## Botones y acciones en curso

- *Fase 4*: el botón que envía un formulario es `atoms/SubmitButton` (`pending`, `pendingLabel`: spinner + "Guardando…", ancho conservado). Sigue apoyado en el `loading` de MUI. La jerarquía de color es la de § Design system › Color y jerarquía.
- **Toda acción asíncrona usa `loading` de MUI** (`<Button loading={isPending}>`): el botón se deshabilita solo y muestra el indicador en el lugar del texto (`loadingPosition="start"` si tiene ícono). Se reemplazan los `startIcon={isPending ? <CircularProgress …/> : null}` actuales.
- **Mientras una acción está en curso, se bloquea todo lo que podría competir con ella**: en un formulario o diálogo, `useForm({ disabled: isPending })` deshabilita todos los campos, el botón secundario ("Cancelar") queda `disabled`, y el diálogo no se cierra con Esc ni haciendo clic fuera. En una fila de tabla, el menú `⋮` de esa fila queda deshabilitado con su indicador; las demás filas siguen operables.
- **Doble envío imposible**: además del `disabled`, el handler ignora llamadas mientras `isPending` (dos clics rápidos antes del re-render).
- Consultas de solo lectura (búsqueda, filtros) **no** bloquean botones: muestran el nivel 4 de carga y cancelan la consulta anterior (debounce de 300 ms + `AbortController`).
- Jerarquía por vista: **un solo** botón `contained` (la acción principal); los secundarios `outlined` o `text`; los destructivos `color="error"` y siempre con `ConfirmDialog`. En diálogos: secundario a la izquierda, primario a la derecha.
- Tamaños: `medium` por defecto; `small` solo dentro de tablas y tarjetas densas; en `xs` los botones primarios de formularios ocupan el ancho completo.

## Tablas y paginación

Todas las tablas usan **`organisms/AppDataGrid`**, un envoltorio de `DataGrid` con los defaults del sistema. Hoy las 8 tablas repiten su configuración, y el tamaño de página varía entre 10 y 25.

- **Idioma**: `esES` de `@mui/x-data-grid/locales` aplicado **en el theme**, para todas las tablas ("Filas por página", "1–25 de 132", etc.).
- **Anatomía** (*Fase 4*, reemplaza la anterior; detalle en § Design system › Patrones › Listado):
  - barra superior: búsqueda de 340 px, `SegmentedControl` de estado con contadores, `FilterMenuButton` para los demás filtros y acciones a la derecha;
  - encabezado de 40 px sobre `background.subtle` a todo el ancho, en `subtitle2`, sin separadores de columna y con flecha de orden simple;
  - filas de 56 px centradas en vertical, con divisor `rowDivider`;
  - pie de paginación, oculto si la tabla está vacía.
  - Las columnas llenan el ancho, y el identificador secundario va bajo el nombre (`colPrincipal`).
  - *Antes*: chips como filtro, encabezado de 44 px y filas de 52 px.
- **Columnas**: texto alineado a la izquierda; **montos, kg y tasas a la derecha, con cifras tabulares**; fechas con `formatFecha`; estados con chips de 22 px; la columna de acciones es la última, con menú `⋮` (nunca más de un ícono suelto por fila). Si la fila abre una ficha, toda la fila es clicable (`cursor: pointer`, fondo `background.subtle` en Puerto, antes `action.hover`, con `transitions.create('background-color')`) y el menú detiene la propagación.
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
| `md` | 900 px | formularios con dos secciones o con pasos (cliente, proveedor) |
| `lg` (*Fase 4*, DS-4) | 1120 px; pantalla completa por debajo de `md` | formularios con líneas repetibles o con más de dos secciones (compra, pedido/POS, cotización, procesamiento, edición de compra, nota de crédito) |

- **Anatomía**: encabezado (título `h6` = la acción, "Registrar abono"; subtítulo opcional en `body2` con el contexto, "Factura 0123 · Restaurante El Muelle"; botón cerrar `IconButton` con `aria-label="Cerrar"`) → contenido con scroll propio y divisores arriba y abajo solo cuando hay scroll → pie fijo (secundario a la izquierda, primario a la derecha).
- *Fase 4*:
  - una sola superficie `background.elevated` para encabezado, cuerpo y pie, separados por `dialogDivider`, con padding de 24;
  - "Cancelar" como botón de texto;
  - el error del servidor va como `Alert` **arriba del formulario**, con "Reintentar" cuando aplique, en lugar de arriba del pie;
  - la entrada es un fundido + 8 px hacia arriba (280 ms; salida en 180 ms).
- **`xs`**: los `sm`/`md` pasan a **pantalla completa** con entrada `Slide` desde abajo, el pie fijo respeta el área segura, y el botón primario ocupa el ancho. Los `xs` (confirmaciones) siguen centrados.
- **Comportamiento**: foco al primer campo al abrir y de vuelta al disparador al cerrar. Con cambios sin guardar (`isDirty`), cerrar (X, Esc, clic fuera) pide confirmación ("¿Descartar cambios?"). Mientras hay una acción en curso, no se puede cerrar (ver "Botones y acciones en curso"). Los errores del servidor aparecen como `Alert` arriba del pie, además del error en cada campo.
- **Nunca** un diálogo abre otro diálogo de formulario; la única excepción es `ConfirmDialog`. Si un flujo necesita más pantalla, va como pasos (`Stepper`) dentro del mismo `AppDialog md`.
- Transición: `Fade` (por defecto) en escritorio; `Slide` arriba en pantalla completa. Duraciones del theme.

## Estados vacíos y de error

> *Fase 4*: los dos componentes pasan a ser envoltorios de `molecules/Fallback`, y los `error.tsx` usan `organisms/RouteError`. Qué tipo de fallback se resuelve en `error.tsx`/`not-found.tsx` y cuál en componentes se define en § Design system › Fallbacks.

- `components/molecules/EmptyState.tsx`: ícono + mensaje + (opcional) botón de acción ("Aún no hay clientes" + botón "Nuevo cliente"). Se usa en toda tabla/lista vacía — nunca una tabla vacía sin mensaje.
- `components/molecules/ErrorState.tsx`: mensaje de error legible + botón "Reintentar" cuando aplique. Se usa en los `error.tsx` de Next.js (App Router) de cada ruta y en catches de fetch de datos dentro de un componente.

## Feedback de acciones (toasts)

- `components/organisms/NotificationProvider.tsx` (o `lib/notify/` con un hook `useNotify()`): envuelve un `Snackbar` de MUI, expone `notify.success(msg)`, `notify.error(msg)`, `notify.info(msg)`. **Nunca `window.alert`/`window.confirm`** en ningún módulo.
- *Fase 4*: el toast tiene el aspecto de § Design system › Primitivos y acepta `{ action }` ("Ver" o "Deshacer", DS-3). El éxito se acompaña del resaltado de 2 s del ítem afectado. Un error dentro de un modal no usa toast: va como `Alert` arriba del formulario.
- Toda acción que escribe en la base de datos (crear, editar, eliminar/desactivar, registrar pago, generar contrato) termina en un `notify.success` o `notify.error` — es la única forma en que el usuario sabe que algo pasó, dado que no hay recarga completa de página (Server Actions + revalidación).

## Confirmaciones

- `components/molecules/ConfirmDialog.tsx`: diálogo genérico (título, mensaje, botón de confirmar con color `error` si es destructivo, botón cancelar) controlado por un hook `useConfirm()` que retorna una promesa — evita que cada módulo escriba su propio diálogo de "¿Estás seguro?".
- Toda acción destructiva o difícil de revertir (desactivar cliente, anular factura, anular contrato, eliminar item de un formulario con datos ya ingresados) pasa por `ConfirmDialog`.

## Formularios y validación

### Estructura visual (aprobado el 2026-10-07)

> *Fase 4*: reemplaza las medidas de esta subsección:
> - `FormSection` usa `sectionTitle` (16/600) con divisor inferior, 16 px hasta el contenido y 40 px entre secciones;
> - los campos van en `FormGrid` (24 vertical, 16 entre columnas, `full` para los campos sin pareja);
> - los subgrupos van en `FormSubgroup`;
> - las líneas repetibles van en `LineasEditor`;
> - la etiqueta es fija arriba del campo (DS-1);
> - las fechas usan `DateField`;
> - las opciones excluyentes usan `SegmentedControl`.
>
> `size="small"` (40 px), las máscaras y la validación no cambian. Detalle en § Design system › Patrones › Formulario.

**Divisiones de sección** — todo formulario con más de un tema (identificación, contacto, crédito, documentos…) agrupa sus campos en **`molecules/FormSection`**: título `h6` + `ayuda` opcional (`body2`, `text.secondary`) + divisor de 1 px (`divider`) encima de la sección salvo la primera + 24 px entre secciones y 16 px entre campos (`gap: { xs: 3, campos: 2 }` en unidades del theme). Prop `dense` (16 px de aire) para formularios cortos en `AppDialog xs`. No se escriben encabezados de sección a mano con `Typography` suelto: siempre `FormSection` (reemplaza al helper local `Seccion` que traía `ClienteFormFields`). El pie del formulario (botones) no es una sección: lo pone `AppDialog`.

**Tamaño de inputs** — dentro de formularios (`AppDialog` o página de formulario) todos los `TextField`, `Select`, `Autocomplete` y `ToggleButtonGroup` usan **`size="small"`** (~40 px). Las áreas táctiles de `xs` (≥ 44 px, ver "Responsive") quedan cubiertas por el `label` + margen externo del campo, no por engordar el input. Fuera de formularios (filtros de tabla, barra de búsqueda) se mantiene `small` por densidad; `medium` queda para inputs aislados en páginas de contenido.

**Máscaras de entrada** — librería **`react-number-format`** (`NumericFormat`/`PatternFormat` con `customInput={TextField}`), la única del sistema para dar formato mientras se escribe:

- **`atoms/NumberField`** está construido sobre `NumericFormat`: los caracteres no numéricos **se bloquean en vivo** (no aparecen, no se guardan, no se descartan en silencio al hacer blur). Interfaz pública `value: number | null`, `onChange(number | null)`, `decimals`, `prefix`, `suffix`. Se prohibe reimplementar el parseo manual de números (`parseInput`/`display` artesanales) o usar `<input type="number">` plano.
- **`atoms/PhoneField`**: teléfono venezolano con máscara `####-#######` (`0414-1234567`), normaliza el prefijo `+58`/`58` y espacios, `inputMode="tel"`. Todo campo de teléfono de la app lo usa.
- **`atoms/RifCiField`**: máscara completa sobre `PatternFormat` — letra limitada a `V|E|J|G`, guion automático tras la letra, hasta 10 dígitos + dígito verificador opcional (`V-12345678`, `J-123456789`). Todo campo de RIF/cédula lo usa (cliente, representante legal, proveedor).

La máscara **previene**, no valida: la fuente de verdad sigue siendo el esquema `zod` (`RIF_CI_REGEX`, `TELEFONO_VE_REGEX`, límites de rango), que corre al submit con `mode: 'onSubmit'`. Si un valor pegado desde el portapapeles no cumple la máscara completa, zod lo rechaza con su mensaje.

- Librería: `react-hook-form` + `zod` (resolver `@hookform/resolvers/zod`) — **ya instaladas y en uso** (`02-clientes` las trae desde `ClienteForm.tsx`). Lo que sigue formaliza el patrón ya usado ahí para que `03-proveedores` y el resto lo repitan igual, sin inventar una convención distinta.
- **Un archivo de validación por entidad**: `src/lib/<entidad>Validation.ts` (patrón ya establecido por `src/lib/clienteValidation.ts`) — exporta las regex compartidas que aplican (`RIF_CI_REGEX`, `CEDULA_REGEX`, reusar las de `clienteValidation.ts` en vez de redeclararlas), el esquema `zod` (`<entidad>FormSchema`) y su tipo inferido (`<Entidad>FormValues`). No se crea una carpeta `schemas/` aparte; se sigue el nombre plano ya usado.
- **Mensajes de error**: se escriben inline en el propio esquema (como ya hace `clienteValidation.ts`: `z.string().min(1, 'Nombre requerido')`), en español, cortos y accionables. Si el mismo mensaje literal se repite en 2 o más entidades (ej. "Formato inválido (V-/E-/J- + números)", "Email inválido"), se extrae a un `src/lib/validationMessages.ts` compartido en ese momento — no antes, para no crear una capa de indirección para mensajes que nunca se repiten.
- **Momento de validación**: `mode: 'onSubmit'` (ya es lo que usa `ClienteForm.tsx`) — no marcar errores mientras el usuario llena el formulario por primera vez; `react-hook-form` ya revalida en `onChange` por defecto una vez que hubo un primer submit fallido, sin configuración adicional.
- **Validación cruzada** (ej. "un cliente persona jurídica requiere al menos un representante legal", ya implementado con `.superRefine()` en `clienteFormSchema`; o "peso de salida ≤ peso de entrada" en `04-inventario`, "fecha de entrega no anterior a hoy" en `05-ventas`): siempre con `.refine()`/`.superRefine()` dentro del esquema `zod`, nunca como `if` suelto en el componente de formulario.
- **Gap detectado a corregir — validar también en la Server Action**: hoy `clientes/actions.ts` hace `JSON.parse(raw)` pero **no** vuelve a correr `clienteFormSchema` sobre esos datos antes de escribir en la base — la validación vive solo en el cliente. Esto es una tarea pendiente de `02-clientes` (agregar `clienteFormSchema.safeParse(input)` al inicio de cada action, devolver el error estructurado si falla) y la regla a seguir desde `03-proveedores` en adelante **desde el primer commit**, no como arreglo posterior: toda Server Action que reciba datos de un formulario corre `<entidad>FormSchema.safeParse(input)` antes de tocar el repositorio.
- **Validación async** (ej. verificar que un `rif_ci` no esté duplicado): no se dispara en cada tecla; se verifica en la Server Action al enviar, y si falla, se mapea el error al campo correspondiente con `setError('rifCi', { message })` de react-hook-form — el usuario lo ve igual que un error de validación normal, aunque vino del servidor. (Todavía no implementado en `02-clientes`; queda como mejora, no bloquea el MVP.)
- **Campo requerido**: el label lleva asterisco (`label="Nombre *"`), no se depende solo del atributo HTML `required` (poco visible y no estiliza con el error).
- Campos numéricos de dinero con 2 decimales visibles y de peso (kg) con 3 decimales, usando `components/atoms/NumberField.tsx` (construido sobre `NumericFormat`, ver "Estructura visual") en vez de `<input type="number">` plano. Campos de teléfono usan `PhoneField`; RIF/cédula usan `RifCiField`.
- Botón de submit: deshabilitado si el formulario tiene errores o está enviando; muestra `CircularProgress` mientras envía (ver sección Loaders).

## Transiciones y micro-interacciones

> *Fase 4*: las duraciones y las curvas salen de `src/theme/tokens.ts`: rápida 120, media 200 y lenta 280/180 ms (§ Design system › Movimiento), y `theme.transitions` las toma de ahí. La lista de animaciones permitidas de esa sección reemplaza a la tabla siguiente donde difieran (por ejemplo, el modal entra con fundido + 8 px y no con `Grow`).

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
- *Fase 4*: las tasas en tarjetas y listados se muestran con `formatTasaCorta` (2 decimales), y con `formatTasa` (6) en el detalle o el tooltip (DS-6). La mezcla `en-US` (USD) y `es-VE` (Bs) se mantiene (DS-5, por confirmar).

## Componentes compartidos (catálogo — revisar antes de crear uno nuevo)

| Componente | Carpeta | Para qué |
|---|---|---|
| `ColorModeToggle` | `atoms` | Cambiar claro/oscuro/sistema |
| `NumberField` | `atoms` | Input numérico sobre `NumericFormat` (bloquea letras en vivo): `decimals`, `prefix`/`suffix` (USD/Bs/kg), `value: number \| null` |
| `PhoneField` | `atoms` | Teléfono venezolano con máscara `0414-1234567` (`PatternFormat`), normaliza `+58` |
| `RifCiField` | `atoms` | RIF/cédula con máscara completa `V-/E-/J-/G-` sobre `PatternFormat`, label dinámico |
| `FormSection` | `molecules` | Sección de formulario: título `h6` + `ayuda` + divisor 1 px (excepto primera); `dense` para diálogos `xs` |
| `PageLoader` | `atoms` | Skeleton de carga de página completa (`table`/`form`/`ficha`/`dashboard`); mientras está montado enciende `NavigationProgress`. `children`: skeleton extra debajo (ej. `CarteraSeccionSkeleton` en la ficha de cliente, 09) |
| `PageHeader` | `molecules` | Título `h4` + subtítulo + acciones. `primaryAction` (contained en `sm+`, `Fab` en `xs`) y `secondaryActions` (outlined en `sm+`, menú `⋮` en `xs`); `children` sigue funcionando |
| `EmptyState` | `molecules` | Lista/tabla vacía; `compact` para secciones de ficha (menos aire, título `subtitle1`) |
| `ErrorState` | `molecules` | Error al cargar datos |
| `ConfirmDialog` | `molecules` | Confirmación de acción destructiva |
| `AppShell` | `templates` | Shell persistente en `(protected)/layout.tsx`: menú 248 px (`md+`) / riel 72 px (`sm`) / temporal (`xs`), barra superior con `topBarStart`, cuenta y modo; usuario y rol por props desde el servidor |
| `NotificationProvider` | `organisms` | Toasts de éxito/error, vía `useNotify()` |
| `DocumentoUpload` | `molecules` | Subir/ver/reemplazar documentos vía adaptador `DocumentoStore` (drag&drop, validación, compresión, reemplazo real); `disabled` bloquea subir, reemplazar, eliminar y soltar (no "Ver") mientras el formulario dueño guarda; el botón usa `loading` |
| `DocumentosRequeridos` | `molecules` | Documentos exigidos por un proveedor según su tipo de persona (cédula, RIF, acta, cédulas de representantes), con ✓/⚠ según los presentes; `disabled` propaga a cada `DocumentoUpload` mientras el form dueño guarda (11-refactor-visual-proveedores) |
| `RepresentantesLegalesFieldArray` | `molecules` | Lista editable de representantes legales (tipado genérico, filas con `Collapse`) |
| `CopyableText` | `molecules` | Texto + botón copiar al portapapeles + toast; `variant` (ej. `h5` para el código de un lote) y `copiedMessage` (07-lotes) |
| `StatusChips` | `molecules` | Chips `soft` de 22 px: Activo (solo con `mostrarActivo`, en listados) / Inactivo, Bloqueado (tooltip con el motivo, convive con Activo) y Doc. incompleta (tooltip con faltantes). Sin chips que mostrar no renderiza nada. *Fase 4*: sobre `EstadoChip`; "Activo" deja de mostrarse (`mostrarActivo` queda sin efecto, deprecado) |
| `PeneroStripes` | `atoms` | Franjas de la borda (Peñero). **Se retira en la Fase 4** (tarea 140); lo reemplaza `FileteLaton` |
| `FileteLaton` (Fase 4, tarea 131; *P-UI2*) | `atoms` | Único decorativo de Puerto: filete de `brand.brass`. `variant="rule"` (estático, 2 px por defecto, `width`) y `variant="sweep"` (progreso indeterminado, quieto con `prefers-reduced-motion`). Reemplaza a `PeneroStripes` y `PeneroSweep` |
| `SegmentedControl` (Fase 4) | `atoms` | Filtro de estado u opción excluyente: `value`, `onChange`, `options` (`value`, `label`, `count?`), `aria-label`, `fullWidth`, `disabled`. Reemplaza a los chips-filtro y a `ToggleButtonGroup` |
| `EstadoChip` (Fase 4) | `atoms` | Chip de estado de 22 px con punto, `tono` `error`/`warning`/`success`/`neutral`, `label`, `tooltip?`. Base de los chips de dominio; `appDataGridColumns` lo reexporta |
| `DateField` (Fase 4) | `atoms` | Fecha `dd/mm/aaaa` sobre `DatePicker`; `value`/`onChange` en ISO `YYYY-MM-DD` \| `null`; mín. 160 px. Prohíbe `type="date"` |
| `SubmitButton` (Fase 4) | `atoms` | Botón de envío: `pending`, `pendingLabel` ("Guardando…"), ancho conservado, ignora el doble clic |
| `Skeletons` (Fase 4) | `atoms` | Primitivos de skeleton con la forma de las plantillas (`SkeletonTabla`, `SkeletonFicha`, `SkeletonKpis`, `SkeletonGrafico`, `SkeletonFormulario`); los usan `PageLoader`, `DashboardSkeletons` y los `Suspense` de sección |
| `FilterMenuButton` (Fase 4) | `molecules` | Filtro adicional como botón-menú ("Tipo: todos"), opción única o múltiple, "Limpiar" |
| `FormGrid` + `FormSubgroup` (Fase 4) | `molecules` | Grilla de campos (1/2 columnas, 24/16 px, `full`) y subgrupo con etiqueta `label` dentro de una `FormSection` |
| `LineasEditor` (Fase 4) | `molecules` | Disposición de líneas repetibles: fila de encabezados, filas sin caja, papelera de 36 px, "Agregar línea" debajo, slot de totales; la lógica (`useFieldArray`) la pone el consumidor |
| `Fallback` (Fase 4) | `molecules` | Vacío / sin resultados / error / sin permiso / no encontrado: ícono en círculo de 44 px, título, texto, acción. `EmptyState` y `ErrorState` lo envuelven |
| `RouteError` (Fase 4) | `organisms` | Contenido de todo `error.tsx`: `Fallback tipo="error"` + "Reintentar" (`reset`) + "Tus datos están a salvo" |
| `src/theme/tokens.ts` (Fase 4) | `src/theme` | Movimiento (duraciones y curvas), tiempos de carga (150/400 ms, 100 ms de navegación, 5 s de toast, 2 s de resaltado), espaciado semántico y sombras por elevación |
| `BrandMark` | `atoms` | Logo de Altamar (`variant: full / isotipo`, `size`, `orientation`); isotipo provisional en SVG hasta tener el archivo real (ícono de la app en `src/app/icon.svg`) |
| `NavigationProgress` | `atoms` | Barra de progreso (Peñero: 3 px con las franjas; Puerto: 2 px, `FileteLaton sweep`); `NavigationProgressProvider` + `NavLinkStatus` (`useLinkStatus` dentro de cada `Link`) + `useNavigationPending(activo)` |
| `BrandLoader` + `useGlobalLoader` | `organisms` / `lib` | Loader global con logo: `show(msg, { untilNavigation })` devuelve `release`, `hide()`, `run(tarea, msg)`; 150 ms de retardo, 400 ms mínimo, contador |
| `AppDataGrid` | `organisms` | Toda tabla: toolbar (búsqueda, filtros, acciones), `mode` cliente/servidor (`rowCount` + `onQueryChange`), `?pagina=` en la URL (`paginaDesdeParam` para `page.tsx`), tamaño recordado por `tableId`, `mobileCard` en `xs`, `hideOnMobile`, `getRowHref` (clic o Enter en una celda; recuerda el origen para `FichaHeader`), estados vacío/sin resultados/error/cargando. Búsqueda en modo cliente: `normalizeSearch` (por defecto `normalizarBusqueda`, sin acentos y minúsculas; `normalizarBusquedaSinSeparadores` quita además espacios, puntos y guiones) y `getSearchValues(row)` (por defecto, el valor crudo de cada columna); cada palabra debe aparecer en algún valor, igual en grilla y tarjetas |
| `AppDialog` | `organisms` | Todo diálogo de formulario: `size` xs/sm/md, `title`/`subtitle`, `primaryAction`, `pending`, `dirty`, `error`, `onSubmit` (el diálogo es un `<form>`), `footer` (pie custom que reemplaza el estándar, ej. navegación de Stepper; 11-refactor-visual-proveedores); pantalla completa + `Slide` en `xs`, cierre protegido, foco al primer campo. Referencia: `ClienteForm` |
| `colMonto` / `colKg` / `colTasa` / `colFecha` / `colEstado` / `colAcciones` + `EstadoChip` | `organisms/appDataGridColumns` | Columnas estándar de `AppDataGrid` (formato de `lib/format.ts`, montos a la derecha, chip `soft`, menú `⋮`) |
| `RowActionsMenu` | `molecules` | Menú `⋮` de una fila o tarjeta, con estado `pending` y opciones destructivas |
| `FichaHeader` | `molecules` | Encabezado de ficha: vuelta (`backHref`, `backLabel`; `router.back()` si se vino de ese listado, para conservar `?pagina=` y filtros), nombre `h5` (`component="h1"`), `meta` (documento, tipo, chips), `primaryAction` (`outlined` en `sm+`, primera opción del `⋮` en `xs`), `menuActions` (`RowAction[]`, en `RowActionsMenu`) y `pending` (10-refactor-visual-clientes) |
| `BloqueoDialog` | `organisms` | Bloqueo con motivo obligatorio (clientes y proveedores): `AppDialog xs`, primario `color="error"` con `loading`, `pending` y `dirty` (motivo escrito) protegen el cierre, guarda contra doble envío; error del motivo en el campo, otros en el `Alert` |
| `PeneroSweep` | `atoms` (en `PeneroStripes.tsx`) | Franjas barriendo (progreso indeterminado) para `NavigationProgress` y `BrandLoader`. **Se retira en la Fase 3** (→ `FileteLaton variant="sweep"`) |
| `TasaChip` | `molecules` | Chip de una tasa referencial: valor, fuente, fecha valor y aviso de "arrastrada" (08-tasas) |
| `TasaSelector` | `organisms` | Selector de tasa de una operación (08-tasas): referencial por fecha (BCV/paralela, Server Action con debounce) o manual con desviación en vivo; escribe `tasa_origen`/`tasa_fuente`/`tasa` en el form dueño (`FormProvider`); `pedirConfirmacionTasaManual` centraliza el ConfirmDialog del umbral |
| `EstadoCarteraChip` (+ `COLOR_ESTADO_CARTERA`) | `atoms` | Estado de cobro/pago de un documento de cartera: Vencida/Por vencer/Pendiente/Pagada/Anulada, chip `soft` 22 px (09-cuentas-por-cobrar; ficha de cliente, `/cobros`, futuro CxP) |
| `CarteraIndicador` | `molecules` | Ícono `ReceiptLongOutlined` + badge coloreado por el peor estado de un `ResumenCartera`; tooltip con conteos, montos (si el resumen los trae) y último recordatorio; accesible por teclado y táctil sin abrir la fila (09; listado de clientes, futuro proveedores) |
| `CarteraResumenCards` (+ `CarteraSeccionSkeleton`) | `molecules` | Cuatro tarjetas Vencidas/Por vencer/Pendientes/Pagadas con cantidad y monto (si hay `montos_usd`); con `onSeleccionar` filtran la tabla (09; ficha de cliente, `/cobros`) |
| `DiasCreditoField` | `molecules` | Días de crédito de una venta: `NumberField` entero, atajos 7/15/30, "Vence el …" en vivo y aviso si difiere de lo habitual del cliente (09; POS y entrega de pedido). `diasHabituales={null}` = sin habituales: vacío y sin aviso propio (06, `GenerarContratoDialog`) |
| `DocumentosCarteraTable` | `organisms` | Tabla genérica de `DocumentoCartera` sobre `AppDataGrid`: número, contraparte opcional, vencimiento con "vence en / vencida hace", montos solo con `mostrarMontos`, estado; orden por gravedad, chips por estado + "Ver anuladas", `renderAcciones` (menú `⋮`), filtro controlado o inicial (09; ficha de cliente, `/cobros`, futuro CxP) |
| `RecordatorioDialog` | `organisms` | Recordatorio de cobro (admin): facturas con casillas y total en vivo, canal con disponibilidad y motivo, vista previa editable (correo en `iframe sandbox`), aviso de 24 h, WhatsApp abierto en el mismo clic y correo con `loading` (09; ficha de cliente, `/cobros`) |
| `HistorialRecordatorios` | `organisms` | Historial de recordatorios (fecha, canal, destinatario, quién, estado; error y "Reintentar" en correos fallidos) (09; ficha de cliente) |
| `TasaIndicador` | `molecules` | Chip compacto de la barra superior con las vigentes de hoy (BCV/paralela USD, EUR en `sm+`), tooltip con fecha valor/origen, ícono de advertencia si arrastrada, clic → `/tasas` (08-tasas) |
| `LoteChip` | `molecules` | Etiqueta de cava de un lote: código (+ kg, prefijo "Lote" opcional), chip `soft` 22 px, chip "Antiguo" con los días en el tooltip; `href` lo enlaza a la ficha del lote (07-lotes; compras, procesamiento, POS, inventario) |
| `LoteAutocomplete` | `molecules` | Selector de lote: opciones con código, fecha de ingreso, días en cava, proveedor, kg disponibles y chip "Antiguo" (`dias_alerta_lote`); el padre preselecciona el más antiguo (07-lotes; procesamiento) |
| `LotesCreadosDialog` | `organisms` | Códigos de los lotes recién creados, grandes y copiables, para rotular; enlace a cada ficha (07-lotes; compras y procesamiento) |
| `LotesLineaVenta` + `AsignacionLotesPanel` | `organisms` | Lotes de una línea de venta: propuesta PEPS (debounce 300 ms, `Skeleton`), chips, "Cambiar lotes" en línea (kg por lote, aviso en vivo si no cuadra o excede), "Volver a PEPS", error de stock insuficiente y `onSuficiencia` para bloquear la emisión (07-lotes; POS y entrega de pedido) |
| `PerdidaLoteDialog` | `organisms` | Pérdida en un lote: kg ≤ stock, motivo (dañado/vencido/faltante/otro), detalle; `AppDialog sm` (07-lotes; inventario y ficha del lote) |
| `KpiCard` | `molecules` | Indicador: título `body2` (Puerto: `subtitle2`), cifra `h5` (Peñero: Barlow Condensed; Puerto: Fraunces 500, tabular), secundaria `caption`, radio 6 en Puerto, acento de estado `tone` (`error`/`warning`/`success`, borde izquierdo; en Puerto también con ícono, porque el color no basta), `href` (toda la tarjeta enlaza), `loading` (skeleton), `children` extra (15-dashboard) |
| `ChartCard` | `molecules` | Tarjeta de sección o gráfico: radio 8, borde `divider`, sin sombra; título `h6`, `help`, `action`; estados `loading` (skeleton de `skeletonHeight`), `error` (`ErrorState`), `empty` (`EmptyState compact`); `Fade` al llegar el contenido (15-dashboard) |
| `ChartLegendTable` | `molecules` | Alternativa accesible a un gráfico: tabla con los mismos datos, colapsable ("Ver tabla") o `variant="hidden"` (solo lectores de pantalla); columnas con `render` ya formateado y `align: 'right'` para números (15-dashboard) |
| `ListaResumen` | `molecules` | Lista compacta de resumen: principal + secundaria, monto tabular (+ detalle) y estado a la derecha, filas ≥ 56 px, `href` hace la fila enlace (15-dashboard: deudores, clientes inactivos, contratos) |
| `BarLineChart` | `organisms` | Barras + líneas sobre categorías con eje doble opcional (`formatoEjeDer`, `rangoEjeDer`), línea de `referencia`, leyenda arriba y tooltip por eje; composición de `@mui/x-charts` (15-dashboard: ventas USD/kg, flujo, Pareto, spread) |
| `RangoFechasSelector` | `molecules` | Rango de fechas por URL: chips de presets (Hoy, 7 días, mes en curso, mes anterior, 90 días, año) + "Personalizado" con `DatePicker` desde/hasta (dayjs, `es`); `router.replace` de `?desde`/`?hasta` conservando los demás parámetros; en `xs`, `Select` + diálogo. Valida con `rangoFechasSchema` (15-dashboard) |
| `SenalFacturaChip` (+ `NivelSenalChip`, `COLOR_NIVEL_SENAL`) | `atoms` | Señal de posible error de una línea de factura: Pérdida (error), Por debajo / Cobro mayor (aviso) e indicadores neutros Sin referencia / Sin costo; chip `soft` 22 px con tooltip de la regla y las cifras. `NivelSenalChip`: nivel de la factura con el conteo (17-trazabilidad-y-correccion-facturas; ficha `/facturas/[id]`) |
| `IvaVentaSwitch` | `molecules` | Interruptor "Factura con IVA (16 %)" de una venta (% de configuración), controlado, precargado con el "Aplica IVA" del cliente; aviso «Este cliente normalmente sí/no lleva IVA» si difiere; `helperText`/`error` (18-iva-opcional; POS y entrega de pedido) |
| `TotalesVenta` (+ `totalesVenta`) | `molecules` | Subtotal, IVA (`IVA (16 %)` o «Sin IVA») y total de una venta con `totalesDe` y `lib/format.ts`, cifras tabulares a la derecha; `totalesVenta(items, ivaPct)` omite líneas incompletas; `etiquetaTotal` (18-iva-opcional; POS, entrega de pedido, nota de crédito) |
| `CadenaTrazabilidad` | `molecules` | Cadena genérica de eslabones `{ icono, titulo, lineas, href? }` unidos por flechas: horizontal en `md+`, vertical en `xs`/`sm`; bordes `divider`, radio 8, cifras tabulares (17; compra → proceso → venta por lote) |
| `DocumentoPublicoLayout` | `templates` | Página pública sin sesión (21-cotizaciones, `/c/[token]`): `BrandMark` + franjas de la borda (Puerto: filete de latón), datos del negocio, contenido centrado (máx. 880 px), sin `AppShell` ni datos de usuario. Reutilizable para otros documentos públicos |
| `CotizacionDocumento` | `organisms` | Vista de solo lectura de una cotización (cliente, líneas, totales USD, notas y términos), mismo orden que el PDF; la comparten la ficha y la página pública; solo recibe datos para el cliente (21) |
| `CotizacionNoDisponible` | `organisms` | Página de respaldo de un enlace público (`vencida` con número / `generica` sin datos) con WhatsApp al negocio (21). Patrón a seguir si otro documento tiene enlace público |
| `lib/pdf/marca.tsx` + `lib/pdf/fuentes.ts` | `src/lib/pdf` | PDF con la identidad (react-pdf): `EncabezadoMarca` (isotipo + nombre + datos del negocio + franjas; Puerto: filete de latón), `PiePagina` con «Página N de M», `registrarFuentesMarca()` (Barlow desde TTF en `lib/pdf/fuentes/`; Puerto: Fraunces + Instrument Sans; Helvetica si faltan). Para cualquier PDF nuevo (21) |
| `src/theme/marca.ts` + `src/lib/marca/isotipo.ts` | `src/theme`, `src/lib/marca` | Hex de `palette.brand` (claro/oscuro) y geometría del isotipo: única fuente para lo que vive fuera de MUI (PDF, correo). `theme.ts` y `BrandMark` los leen (21, tarea agregada en 00) |

Gráficas: `@mui/x-charts` (v9, alineada con `x-data-grid`; agregada en 15-dashboard, D1). Colores con `coloresGrafico(theme)` de `lib/dashboard/chartColors.ts` (variables CSS de `theme.palette`, nunca hex ni `brand.*` decorativo). En Puerto, la serie categórica sale de un token nuevo `palette.chart` (`c1`–`c6`, claro y oscuro, *P-UI9*). Cada color debe dar ≥ 3:1 contra `background.paper` (WCAG 1.4.11), y por eso no se usa `brand.brass` claro (`#C9A66B`). `success` y `primary` ya no se distinguen por tono, así que los gráficos no dependen solo del color para positivo/negativo: van con leyenda, etiqueta y `ChartLegendTable`; cada gráfico lleva `aria-label` y su `ChartLegendTable`. Las animaciones del paquete respetan `prefers-reduced-motion`.

Además de los anteriores: `lib/navigationOrigin.ts` (`recordarOrigen` / `consumirOrigen`: de qué listado se abrió una ficha, para `FichaHeader`), `lib/useConfirm.tsx` (`ConfirmProvider` + `useConfirm`), `lib/useNotify.ts` (re-export del hook), `lib/themeStorage.ts` (`StorageManager` de MUI que persiste el modo en cookie + localStorage), `lib/validationMessages.ts` (mensajes de validación compartidos), `lib/actionState.ts` (`ActionState` + `toActionError`), `lib/documentoStore.ts` (`DocumentoStore` para `DocumentoUpload`), `lib/bancosVe.ts` (catálogo de bancos y utilidades de cuenta), `lib/useGlobalLoader.tsx` (`GlobalLoaderProvider` en el layout raíz + `useGlobalLoader`), variante de theme `Chip variant="soft"` (estados) y la página de muestra `/estandares` (solo desarrollo y admin). Dominio de cartera (09): `lib/cartera/` (puro: `estado.ts`, `resumen.ts`, `recordatorios/plantillas.ts`, `recordatorios/telefono.ts`, canales Strategy en `recordatorios/canales/`).

Cada módulo que cree un componente genérico nuevo (no específico de su dominio) debe agregarlo a esta tabla como parte de su propia tarea, para que el siguiente módulo lo encuentre.

## Accesibilidad (mínimo viable)

- Contraste AA (4.5:1 texto normal, 3:1 texto grande) verificado en ambos esquemas de color al definir la paleta oscura.
- Todo `IconButton` sin texto visible lleva `aria-label`.
- Ningún `:focus` se remueve vía CSS; si se reemplaza el estilo default de foco, debe seguir siendo visible.
- Formularios: `<label>` asociado a su input (MUI `TextField` ya lo hace si se usa `label`, no se debe omitir por diseño).
- Puerto (2026-10-22): los pares de texto se verifican con herramienta y quedan anotados en el checklist de la Fase 3. Contornos de input, foco y series de gráfico, ≥ 3:1 contra su fondo (WCAG 1.4.11). El latón decorativo (`#C9A66B`) y el `success` de relleno (`#ABC7F1`) **nunca** van como texto sobre claro. El foco visible es un contorno de 2 px de `primary` (en oscuro, latón). *Fase 4*: en claro, anillo de 3 px `focusRing` (`rgba(201,166,107,.55)`); en oscuro, 2 px `#D4B27A`. Hay que verificar ≥ 3:1 en ambos, junto con el borde de campo `#5E7194` sobre `#0F1C31`, el segmentado seleccionado y el toast.

## Decisiones de la Fase 3 (Puerto)

El cliente aprobó el 2026-10-22 las diez propuestas tal como están (P-UI1 a P-UI10). Si más adelante cambia alguna, se toca solo el token o el componente indicado.

| Id | Decisión | Aprobado (2026-10-22) |
|---|---|---|
| P-UI1 | Texto e ícono de `success` sobre claro (`#ABC7F1` da ~1,7:1 sobre blanco) | `success.main` `#2F5E9E` (~6,5:1) para texto e ícono; `#ABC7F1` como `success.soft`/`light` (relleno, chip "Pagada"). En oscuro, `#ABC7F1` para todo |
| P-UI2 | Reemplazo de `PeneroStripes` y de los loaders con franjas | `atoms/FileteLaton`: filete de latón estático (sidebar, login, documento público, PDF) y en barrido (navegación 2 px, loader global). El ítem activo del menú lleva un punto de latón |
| P-UI3 | Radio de diálogos | 8, igual que las superficies; 0 a pantalla completa |
| P-UI4 | Logo | Sigue el isotipo provisional, redibujado en Puerto (proa medianoche + filete de latón + "Altamar" en Fraunces). Se reemplaza al recibir el logo real (pendiente (g)) |
| P-UI5 | Tamaño de `h5` (no está en la muestra) | 24 px Fraunces 500 |
| P-UI6 | `info` (no está en la muestra; lo usan los kg en gráficos; "pendiente" pasó a ámbar el 2026-10-22) | `#44597A` claro / `#9FB4D3` oscuro, pizarra azulada, distinto de `primary` y de `success` |
| P-UI7 | Contorno de input (`#E4E1D8` da < 3:1 sobre blanco) | `#E4E1D8` para separadores; `#A9A397` para el contorno de `OutlinedInput` en claro |
| P-UI8 | Cifras tabulares, si Instrument Sans o Fraunces no traen `tnum` | Consultar antes de sumar una tercera familia |
| P-UI9 | Paleta categórica de gráficos | Claro: `#0B1B33`, `#2F5E9E`, `#7A5C2E`, `#A15C07`, `#5B6474`, `#B3261E`. Oscuro: `#ABC7F1`, `#D4B27A`, `#EEF0F4`, `#E9B460`, `#A3ADBD`, `#EE8A83`. Verificar 3:1 de cada una |
| P-UI10 | Tonos oscuros sin valor en la muestra: `background.subtle`, sidebar y `brand.navy` | `#17253D`, `#0A1424` con borde `#22314B`, `#1C2E4D` |

## Fuera de alcance (MVP)
- Internacionalización (todo queda en español, moneda USD/Bs fijas).
- Modo de alto contraste separado del modo oscuro estándar.
- Fase 3 (Puerto): el PDF de contratos (`lib/contratos/plantillas/`, en Helvetica y con sus propios grises) no se rediseña; el de cotizaciones sí, porque ya lee la marca compartida. El mapeo de estados a colores de `09` (`COLOR_ESTADO_CARTERA`) solo cambia `pendiente` → `warning` (ver chips de estado). La anatomía de pantallas no cambia: solo la piel. *(La Fase 4 sí ajusta la anatomía de listados, formularios, fichas y feedback; lo que sale de su alcance figura en § Design system › Fuera de alcance.)*
- Animaciones elaboradas (parallax, scroll-triggered, animaciones de página complejas) o cualquier librería de animación de terceros — las transiciones básicas ya quedan cubiertas en la sección "Transiciones y micro-interacciones" arriba.
