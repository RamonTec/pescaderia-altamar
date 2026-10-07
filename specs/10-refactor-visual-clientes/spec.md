# 10 — Refactor visual de Clientes

## Historia de usuario

> **Como** quien atiende el mostrador (admin u operador),
> **quiero** que el listado, la ficha y los diálogos de clientes se vean y se comporten igual que el resto de la app (tablas, cargas, botones, modales y teléfono),
> **para** encontrar rápido a un cliente, saber de un vistazo si se le puede fiar y actuar sobre él sin dudar si la acción se hizo o no.

Criterios de aceptación (resumen; el detalle está en `checklist.md`):

1. El listado `/clientes` usa `AppDataGrid`: 25 filas por defecto, búsqueda que ignora acentos y separadores del RIF, filtros como chips, página y filtro en la URL, y tarjetas en el teléfono.
2. En el teléfono, "Nuevo cliente" es un `Fab` y ninguna pantalla de clientes tiene scroll horizontal.
3. La ficha tiene un encabezado estándar (nombre `h5`, RIF en `caption`, chips de estado, acciones a la derecha o en `⋮` en `xs`) y secciones con radio 8 y borde.
4. La ficha carga sus datos en el servidor: un error muestra `ErrorState`, nunca secciones vacías.
5. Todo diálogo de clientes es `AppDialog` y toda acción en curso usa `Button loading`; mientras guarda, no se puede cerrar ni editar, y el doble envío es imposible.
6. Se ve bien en claro y oscuro, a 375, 768, 1024 y 1440 px.

## Contexto

`02-clientes` está `done` en lo funcional, y su UI ya se pasó a la identidad Peñero (commit `c79cc7d`). La Fase 2a de `00-estandares-ui` (commit `caadbf9`) construyó la base del acabado visual (`AppDataGrid`, `AppDialog`, `RowActionsMenu`, `PageHeader` con `Fab`, columnas estándar) y migró solo `ClienteForm` como diálogo de referencia. **Ninguna tabla usa `AppDataGrid` todavía.**

Este módulo es la **Fase 2b de `00-estandares-ui` aplicada a clientes**: tareas 40 a 43 de `00-estandares-ui/tasks.md` para el listado, la ficha y los diálogos de clientes. Es el piloto: lo que se resuelva aquí en los componentes base (búsqueda normalizada, fila abrible con teclado, encabezado de ficha) lo reusan proveedores, compras y el resto.

**Referencias** (no se duplican aquí):
- `00-estandares-ui/spec.md`: Identidad visual, Tipografía, Responsive, Loaders, Botones, Tablas y paginación, Modales, catálogo de Componentes compartidos.
- Muestra visual aprobada (2026-10-07): [Estándares visuales Altamar](https://claude.ai/artifact/3WKKVWcmPJVK7MnaKEPDyo), artboards *Tabla* (shell con Clientes), *Movil-lista* (tarjetas) y *Modal*. Si esta spec y la muestra difieren, se consulta al usuario.
- `02-clientes/spec.md`: qué datos y acciones existen (no cambian).

**No cambia**: esquema, RLS, servicios de negocio, validaciones (`clienteValidation.ts`), reglas de bloqueo/desactivación ni permisos por rol. Es un refactor de presentación. La única capa que se toca fuera de la UI es la carga de datos de la ficha (ver "Ficha").

## Estado actual (2026-10-07)

| Pieza | Archivo | Qué falta frente al estándar |
|---|---|---|
| Listado | `organisms/ClientesTable.tsx` | `DataGrid` crudo, `pageSizeOptions [10,25,50]`, filtro `ToggleButtonGroup`, menú `⋮` armado a mano, filas solo clicables con mouse, búsqueda y filtro fuera de la URL, sin `mobileCard` (oculta columnas en `xs`), `NUM` local repetido. |
| Pantalla | `clientes/clientes-screen.tsx` | `PageHeader` con `children` (sin `Fab` en `xs`), `AddIcon` relleno. |
| Ficha | `clientes/[id]/cliente-ficha.tsx` | título `h4`, `ArrowBackIcon` relleno con `fontSize: 16` suelto, `Editar` + `⋮` también en `xs`, tablas `Table` de MUI a mano, chips `outlined` (no `soft`), **consulta Supabase desde el navegador** (`createClient` + `representanteLegalRepository`) sin manejo de error: si falla, las secciones quedan vacías. |
| Crédito | `molecules/CreditoResumen.tsx` | cifra con `fontSize` sueltos (1.75 / 2.125 rem) en lugar de la variante `h5`. |
| Bloqueo | `organisms/BloqueoDialog.tsx` (compartido con proveedores) | `Dialog` a mano, `CircularProgress` en el botón, sin `AppDialog`. |
| Alta/edición | `organisms/ClienteForm.tsx` | ya migrado (Fase 2a). Falta `DocumentoUpload` deshabilitado mientras guarda (pendiente (d) de 00). |
| Estados | `molecules/StatusChips.tsx` (compartido) | chips `filled`, sin variante `soft` ni altura de 22 px; no muestra "Activo". |
| Acciones | `clientes/useClienteAcciones.tsx` | un solo `isPending` para todo: no sabe qué fila está en curso. |

## Alcance

### Listado `/clientes`

- **Encabezado**: `PageHeader title="Clientes"` con `primaryAction` "Nuevo cliente" (`AddOutlined`). En `xs` es `Fab` extendido. La lista deja espacio inferior para que el `Fab` no tape la última tarjeta.
- **Tabla**: `ClientesTable` pasa a ser un envoltorio de `AppDataGrid` (`tableId="clientes"`, `label="Clientes"`, `mode="client"`, catálogo según la tabla de paginación de 00):

  | Columna | Contenido | Notas |
  |---|---|---|
  | Cliente | nombre (`body2` 500) + RIF/cédula en `caption` | "Sin RIF / cédula" si falta |
  | Teléfono | teléfono o `—` | cifras tabulares |
  | Límite de crédito | `colMonto` USD, a la derecha | "Sin crédito" (`text.secondary`) cuando es `null` o 0, como en la muestra (hoy dice "Contado") |
  | Estado | `StatusChips` en variante `soft` 22 px: Activo / Inactivo / Bloqueado (tooltip con el motivo) | como en la muestra: "Activo" se muestra; "Bloqueado" convive con "Activo" |
  | (acciones) | `colAcciones` + `RowActionsMenu` | Editar · Bloquear / Desbloquear (solo admin) · Desactivar (destructivo) / Activar. `pending` en la fila cuya acción está en curso |

- **Filtros**: chips exclusivos en la barra (`filters` de `AppDataGrid`): "Activos (n)" (por defecto), "Bloqueados (n)", "Todos (n)". El filtro vive en la URL (`?estado=bloqueados`, sin parámetro = activos), igual que la página, para que volver desde la ficha conserve ambos.
- **Búsqueda**: placeholder "Buscar por nombre, RIF o teléfono". Debe conservar el comportamiento actual: **ignora acentos, mayúsculas, espacios, puntos y guiones** ("V-12.345" encuentra "v12345"). Hoy `AppDataGrid` solo quita acentos, así que se extiende (ver "Cambios en componentes compartidos").
- **Fila → ficha**: `getRowHref` a `/clientes/[id]`, abrible también con teclado (cierra el pendiente (b) de 00).
- **Estados**: sin clientes → `EmptyState` "Aún no hay clientes" + acción "Nuevo cliente". Sin resultados → el estándar de `AppDataGrid` ("Sin resultados para «…»" + "Limpiar búsqueda"). Filtro sin filas (p. ej. ningún bloqueado) → `EmptyState` con mensaje del filtro ("No hay clientes bloqueados") y acción "Ver todos".
- **Teléfono (`xs`)** — `mobileCard`, como *Movil-lista*: `primary` nombre, `secondary` RIF, `status` solo chips que informan algo (Bloqueado / Inactivo; "Activo" no se repite en la tarjeta), `actions` el mismo `RowActionsMenu` con tamaño `medium` (44 px). La paginación queda "‹ 1–25 de N ›".

### Ficha `/clientes/[id]`

- **Encabezado** — molécula nueva y genérica `molecules/FichaHeader` (la reusa la ficha de proveedor):
  - enlace de vuelta "Clientes" (`ArrowBackOutlined` en tamaño del theme, sin `fontSize` suelto), que regresa a la página y filtro de los que vino (usa `router.back()` si el referrer es el listado; si no, `href`),
  - nombre en `h5` (`component="h1"`), corta con `overflowWrap: anywhere`,
  - línea en `caption`/`body2`: RIF con `CopyableText`, tipo de persona y chips de estado,
  - acciones: `sm+` "Editar cliente" `outlined` + `⋮` (Bloquear/Desbloquear, Desactivar/Activar); `xs` todo dentro de `⋮`. Se reusa `RowActionsMenu` para el `⋮`.
- **Avisos**: los `Alert` de bloqueado e inactivo se mantienen, con `maxWidth: '75ch'` y su botón ("Desbloquear", "Activar") con `loading`.
- **Secciones** (`FichaSeccion`, radio 8 + borde `divider`, sin sombra): Contacto, Representantes legales (solo jurídica), Facturas, Pedidos, y en la columna lateral Crédito y Documentos. Mismo layout de dos columnas en `md+` y una en `xs`.
  - **Representantes legales**: lista de `FichaDatos` (nombre, cédula, cargo, teléfono), uno por representante, separados por `Divider`. No es tabla: así en `xs` no se pierden columnas. Sin representantes: el `Alert` actual con "Agregar".
  - **Facturas** y **Pedidos**: `AppDataGrid` embebidas (`searchable={false}`, `pageParam` propio: `pfacturas`, `ppedidos`), con `colFecha`, `colMonto`, `colEstado` (`EstadoChip` `soft`) y `mobileCard`. Estados vacíos con `EmptyState` compacto ("Aún no hay facturas para este cliente").
  - **Crédito** (`CreditoResumen`): la cifra protagonista usa `variant="h5"` (Barlow Condensed, tabular). El bloque casco se mantiene (decisión de `c79cc7d`).
  - **Documentos**: sin cambios de comportamiento.
- **Carga de datos en el servidor**: `[id]/page.tsx` obtiene cliente, saldo, representantes, facturas y pedidos vía servicios (`Promise.all`) y los pasa por props. `cliente-ficha.tsx` deja de importar `createClient` y `representanteLegalRepository`. La carga la cubre `[id]/loading.tsx` (`PageLoader variant="ficha"`), y un fallo lo captura un `[id]/error.tsx` nuevo con `ErrorState` + "Reintentar". `FichaSeccion` ya no necesita `loading` en esta ficha.
  - Es la misma tarea que la 20 de `09-cuentas-por-cobrar`, sin la cartera. Si 09 ya la hizo al llegar aquí, **no se repite**: solo se aplica el resto del refactor visual sobre lo que dejó 09 (incluida su sección "Facturas y cobranza", que reemplaza a "Facturas").

### Diálogos y acciones

- **`ClienteForm`**: ya es `AppDialog md`; solo se agrega `disabled` a `DocumentoUpload` mientras guarda.
- **`BloqueoDialog`** (compartido con proveedores): pasa a `AppDialog size="xs"`, título "Bloquear a {nombre}", primario `color="error"` "Bloquear" con `loading`, `pending` bloquea el cierre y `dirty` (motivo escrito) pide "¿Descartar cambios?". El error del servidor va en el campo (si es del motivo) o en el `Alert` de `AppDialog`. Proveedores queda migrado de paso: se revisa allí también.
- **`useClienteAcciones`**: expone qué cliente tiene una acción en curso (`pendienteId`), para `RowActionsMenu pending` en la fila y para deshabilitar el `⋮` de la ficha. Las demás filas siguen operables.
- **Copy** (tarea 43 de 00): botones con el verbo de la acción y el toast con el mismo verbo — "Guardar cliente" / "Cliente guardado", "Actualizar cliente" / "Cliente actualizado", "Bloquear" / "Cliente bloqueado", "Desbloquear" / "Cliente desbloqueado", "Desactivar" / "Cliente desactivado", "Activar" / "Cliente activado". Errores con causa y solución, sin disculpas.

### Cambios en componentes compartidos

Se hacen en el componente base (no dentro de clientes) y se anotan en `00-estandares-ui` (tabla de "Componentes compartidos" + "Componentes agregados después de la primera pasada"):

| Componente | Cambio |
|---|---|
| `organisms/AppDataGrid` | (1) normalización de búsqueda configurable (p. ej. prop `normalizeSearch?: (s: string) => string`) aplicada tanto a la grilla (`quickFilterValues` / `getApplyQuickFilterFn`) como a las tarjetas `xs`; la de clientes quita además espacios, puntos y guiones. (2) Fila con `getRowHref` abrible con Enter cuando tiene el foco (pendiente (b) de 00). La solución exacta la decide quien implemente, sin romper la navegación con flechas de la grilla. |
| `molecules/StatusChips` | variante `soft`, 22 px, prop para mostrar "Activo" (listado sí, tarjeta y ficha no). Revisar el uso en proveedores. |
| `molecules/FichaHeader` | **nuevo**: `backHref`, `backLabel`, `title`, `meta` (nodo para RIF, tipo y chips), `primaryAction` y `menuActions` (`RowAction[]`), `pending`. |
| `molecules/DocumentoUpload` | prop `disabled`. |
| `organisms/BloqueoDialog` | sobre `AppDialog xs` (ver arriba). |

## Fuera de alcance

- Columna "Facturas", filtro "Con facturas vencidas" y sección "Facturas y cobranza": son de `09-cuentas-por-cobrar` (la muestra ya los dibuja). Este módulo deja el listado listo para que 09 agregue la columna y el chip de filtro sobre `AppDataGrid`.
- Botón "Exportar" de la muestra: no está en ninguna spec. Si se quiere, se planifica aparte.
- Paginación en servidor del listado: clientes es un catálogo, va en modo cliente (00, "Tablas y paginación").
- Logo real de Altamar (pendiente (g) de 00).
- Ficha de proveedor y demás tablas: el resto de la Fase 2b. Solo se tocan aquí los componentes compartidos indicados arriba.

## Dependencias y orden

- Depende de: `00-estandares-ui` Fase 2a (hecha), `02-clientes` (hecho).
- Se recomienda **antes de `09-cuentas-por-cobrar`**: así 09 agrega su columna, filtro y sección sobre `AppDataGrid` y `FichaHeader` en lugar de sobre el `DataGrid` crudo, y no se migra dos veces. Si 09 va primero, este módulo migra lo que 09 haya dejado (ver "Carga de datos en el servidor").
- Coordinación: otro agente puede estar trabajando en el mismo árbol. Revisar `git status` antes de cada tarea y no editar archivos con cambios ajenos sin commitear.
