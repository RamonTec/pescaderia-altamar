# Tareas — 10-refactor-visual-clientes

Depende de `00-estandares-ui` Fase 2a y `02-clientes` (ambos hechos). Leer antes `spec.md` de este módulo y, de `00-estandares-ui/spec.md`, las secciones Tipografía, Responsive, Loaders, Botones, Tablas y paginación, Modales y el catálogo de componentes.

Tras **cada** tarea: `npm run lint` y `npx tsc --noEmit`. Antes de cada tarea: `git status` (no editar archivos con cambios ajenos sin commitear). Si `09-cuentas-por-cobrar` ya se implementó al empezar, leer primero qué dejó en `ClientesTable`, `clientes/page.tsx` y la ficha, y aplicar las tareas sobre eso.

## A. Componentes compartidos (primero: el resto los usa)

1. **`AppDataGrid` — búsqueda normalizable**: prop opcional `normalizeSearch?: (s: string) => string` (por defecto, la normalización actual: sin acentos y en minúsculas). Se aplica al texto de búsqueda y al de cada celda, tanto en la grilla (`getApplyQuickFilterFn` por columna o `quickFilterParser`) como en las tarjetas `xs` (`MobileCards`). Agregar el caso a la página `/estandares`.
   - Hecho cuando: con `normalizeSearch` que quita `[\s.\-]`, buscar "v12345" encuentra "V-12.345" en escritorio y en `xs`; las tablas que no pasan la prop no cambian.
2. **`AppDataGrid` — abrir fila con teclado** (pendiente (b) de 00): con `getRowHref`, Enter sobre una celda con foco navega a la ficha. No debe romper las flechas de la grilla ni dispararse desde el `⋮` ni desde otros controles de la celda. Anotar la solución elegida en `00-estandares-ui/checklist.md` (b).
3. **`StatusChips`**: variante `soft` y 22 px de alto (los tokens del theme, sin valores sueltos), prop `mostrarActivo?: boolean` (por defecto `false`) que pinta "Activo". Revisar que proveedores (listado y ficha) siga viéndose bien.
4. **`DocumentoUpload`**: prop `disabled` (deshabilita subir, reemplazar y el drag & drop; ver sigue funcionando). Pasarla desde `ClienteForm` con `isPending` (cierra el pendiente (d) de 00).
5. **`BloqueoDialog` → `AppDialog size="xs"`**: `pending`, `dirty` (motivo no vacío), primario `color="error"` con `loading`, sin `CircularProgress` manual, guarda contra doble envío. Error del servidor en el campo o en `error` de `AppDialog`. Verificar en clientes **y** proveedores.
6. **`molecules/FichaHeader`** (nuevo): props `backHref`, `backLabel`, `title`, `meta?: ReactNode`, `primaryAction?` (botón `outlined` en `sm+`), `menuActions: RowAction[]`, `pending?`. Nombre en `h5` (`component="h1"`). En `xs` la acción primaria entra al `⋮` como primera opción. El `⋮` reusa `RowActionsMenu`. Íconos `Outlined`.
   - Hecho cuando: a 375 px no hay botones sueltos a la derecha del nombre, solo `⋮`; a 1024 px se ven "Editar cliente" y `⋮`.
7. **Registrar** en `00-estandares-ui/spec.md` (tabla de componentes: `FichaHeader`, y las props nuevas de `AppDataGrid`, `StatusChips`, `DocumentoUpload`, `BloqueoDialog`) y en `00-estandares-ui/tasks.md` ("Componentes agregados después de la primera pasada", con fecha y "10-refactor-visual-clientes").

## B. Listado `/clientes`

8. **`useClienteAcciones`**: además de `isPending`, exponer `pendienteId: string | null` (el cliente cuya acción está en curso), para la fila y la ficha. Revisar los textos de los toasts en `clientes/actions.ts` según la tabla de copy de `spec.md` (verbo del botón = verbo del toast).
9. **`ClientesTable` sobre `AppDataGrid`**: columnas de `spec.md` (Cliente, Teléfono, Límite de crédito con `colMonto` y "Sin crédito", Estado con `StatusChips mostrarActivo`, acciones con `colAcciones` + `RowActionsMenu pending={pendienteId === row.id}`). `normalizeSearch` de clientes (sin acentos, espacios, puntos ni guiones), `getRowHref`, `emptyState` "Aún no hay clientes" + "Nuevo cliente". Quitar el `Menu` manual, `ToggleButtonGroup`, `normalizar` local, `NUM` local y los íconos sin sufijo.
10. **Filtro en chips y en la URL**: "Activos (n)" / "Bloqueados (n)" / "Todos (n)", exclusivos, en `filters`. El valor vive en `?estado=` (sin parámetro = activos), escrito sin recargar la página del servidor, como `?pagina=`. Al cambiar el filtro, la página vuelve a 1. Filtro sin filas → `EmptyState` con el mensaje del filtro y "Ver todos".
11. **`mobileCard`**: nombre, RIF, chips solo si hay Bloqueado/Inactivo, `RowActionsMenu` `medium`. Comparar con el artboard *Movil-lista* de la muestra.
12. **`clientes-screen.tsx`**: `PageHeader` con `primaryAction` "Nuevo cliente" (`AddOutlined`) en lugar de `children`; espacio inferior en `xs` para el `Fab`. Confirmar que `clientes/loading.tsx` (`PageLoader variant="table"`) se parece a la tabla final (barra con búsqueda y chips, filas de 52 px); ajustar `PageLoader` solo si la diferencia salta a la vista.

## C. Ficha `/clientes/[id]`

13. **Carga en el servidor** — **omitir si `09-cuentas-por-cobrar` tarea 20 ya está hecha** (y anotarlo aquí): agregar en servicios lo que falte para listar representantes, facturas y pedidos de un cliente (reusar `facturaRepository.getByCliente`; agregar `listByCliente` en el repositorio de pedidos si no existe, con su interfaz en `interfaces.ts`). `[id]/page.tsx` los pide con `Promise.all` junto con saldo y rol, y los pasa por props. `cliente-ficha.tsx` deja de importar `createClient` y `representanteLegalRepository` y quita el `useEffect` y los estados `loading`. Al terminar, anotar en `09-cuentas-por-cobrar/tasks.md` (tarea 20) que la parte sin cartera ya está hecha, con fecha.
14. **`[id]/error.tsx`** con `ErrorState` "No se pudo cargar la ficha del cliente." + "Reintentar" (`reset`). `not-found.tsx` sin cambios salvo íconos `Outlined` y copy.
15. **Encabezado con `FichaHeader`**: vuelta a "Clientes" (`router.back()` si se vino del listado, para conservar `?pagina=` y `?estado=`; si no, `href="/clientes"`), nombre `h5`, `meta` con `CopyableText` del RIF + tipo de persona + `StatusChips`, primaria "Editar cliente", `⋮` con Bloquear/Desbloquear (solo admin) y Desactivar/Activar, `pending={pendienteId === cliente.id}`. Quitar el `Menu` manual, `ArrowBackIcon` con `fontSize: 16` y el `IconButton` con borde.
16. **Avisos y secciones**: `Alert` de bloqueado/inactivo con `maxWidth: '75ch'` y botón con `loading`. Representantes como lista de `FichaDatos` con `Divider` (no tabla). Facturas y Pedidos con `AppDataGrid` embebida (`searchable={false}`, `pageParam` `pfacturas`/`ppedidos`, `colFecha`, `colMonto`, `colEstado` con los estados actuales, `mobileCard`, `EmptyState` compacto). Quitar `Table*`, chips `outlined` y `NUM` local. Si 09 ya reemplazó "Facturas" por "Facturas y cobranza", aplicar este punto solo a Pedidos y Representantes.
17. **`CreditoResumen`**: la cifra protagonista con `variant="h5"`; sin `fontSize` sueltos. Revisar que siga legible sobre el casco en claro y oscuro (contraste AA).
18. **`[id]/loading.tsx`**: el skeleton `ficha` de `PageLoader` debe parecerse al layout final (encabezado, dos columnas en `md+`). Ajustar solo si la diferencia salta a la vista.

## D. Verificación

19. `npm run lint`, `npx tsc --noEmit`, `npm run build`.
20. Recorrer `/clientes` y una ficha (natural y jurídica, bloqueado e inactivo) en 375 / 768 / 1024 / 1440 px y en claro/oscuro: sin scroll horizontal, `Fab` en `xs`, tarjetas en `xs`, `FichaHeader` con `⋮` en `xs`, diálogos a pantalla completa en `xs` (`BloqueoDialog` centrado: es `xs`).
21. Búsqueda: "v12345", "MARIA" y "maría" encuentran lo esperado. Filtro y página se conservan al ir a la ficha y volver.
22. Acciones: doble clic rápido en "Bloquear" y en "Guardar cliente" hace una sola escritura; durante la acción, el `⋮` de esa fila está deshabilitado con su indicador y las demás filas siguen operables; el diálogo no se cierra con Esc mientras guarda; cerrar con motivo escrito pide "¿Descartar cambios?".
23. Teclado: Tab llega a búsqueda, chips, filas y `⋮`; Enter en una fila abre la ficha; foco visible en todo; `aria-label` en todos los íconos.
24. Simular un fallo de carga de la ficha (p. ej. lanzar en el servicio en desarrollo) y ver `ErrorState` con "Reintentar".
25. Proveedores: listado, ficha y bloqueo siguen funcionando con `StatusChips` y `BloqueoDialog` nuevos.
26. Marcar `checklist.md` y los ítems de `00-estandares-ui/checklist.md` que este módulo cierre para clientes (con nota "clientes, 10-refactor-visual-clientes").
