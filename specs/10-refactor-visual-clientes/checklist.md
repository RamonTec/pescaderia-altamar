# Checklist — 10-refactor-visual-clientes

## Componentes compartidos
- [ ] `AppDataGrid` acepta `normalizeSearch` y lo aplica en la grilla y en las tarjetas `xs`; las tablas que no lo pasan no cambian.
- [ ] Una fila con `getRowHref` se abre con Enter, sin romper las flechas de la grilla ni dispararse desde el `⋮`.
- [ ] `StatusChips` en `soft`, 22 px, con `mostrarActivo`; proveedores se sigue viendo bien.
- [ ] `DocumentoUpload` acepta `disabled` y `ClienteForm` lo pasa mientras guarda.
- [ ] `BloqueoDialog` es `AppDialog xs`, con `Button loading`, cierre protegido (`pending` y `dirty`) y sin doble envío; probado en clientes y proveedores.
- [ ] `FichaHeader` existe en `molecules`, es genérico (sin nada propio de clientes) y queda en la tabla de componentes de `00-estandares-ui/spec.md`, junto con las props nuevas.

## Listado
- [ ] `ClientesTable` usa `AppDataGrid` en modo cliente: 25 filas por defecto, opciones 25/50/100, textos en español, página en `?pagina=`.
- [ ] Columnas como en `spec.md`: montos a la derecha y tabulares, "Sin crédito" cuando no hay límite, chips `soft`, una sola columna de acciones con `RowActionsMenu`.
- [ ] Búsqueda ignora acentos, mayúsculas, espacios, puntos y guiones ("v12345" encuentra "V-12.345").
- [ ] Filtros como chips (Activos / Bloqueados / Todos, con conteo), en `?estado=`; volver desde la ficha conserva filtro y página.
- [ ] `EmptyState` para "sin clientes" (con "Nuevo cliente"), sin resultados de búsqueda y filtro vacío (con "Ver todos").
- [ ] En `xs`: tarjetas como la muestra *Movil-lista*, `Fab` "Nuevo cliente" que no tapa la última tarjeta, sin scroll horizontal.
- [ ] La fila con una acción en curso muestra su `⋮` deshabilitado con indicador; las demás siguen operables.

## Ficha
- [ ] La ficha recibe todo por props desde el servidor; `cliente-ficha.tsx` no importa `createClient` ni repositorios. _(O hecho por 09, tarea 20: anotar.)_
- [ ] Un fallo de carga muestra `ErrorState` con "Reintentar" (`[id]/error.tsx`), nunca secciones vacías.
- [ ] `FichaHeader`: nombre `h5`, RIF copiable, tipo de persona y chips; "Editar cliente" + `⋮` en `sm+`, solo `⋮` en `xs`; la vuelta conserva página y filtro del listado.
- [ ] Representantes como lista (sin columnas ocultas en `xs`); Facturas y Pedidos con `AppDataGrid` embebida, `EstadoChip soft` y tarjetas en `xs`.
- [ ] `CreditoResumen` usa `h5` para la cifra, con contraste AA sobre el casco en ambos esquemas.
- [ ] Secciones con radio 8, borde `divider` y sin sombra; avisos con `maxWidth: 75ch`.

## Estándares generales (para todo el módulo)
- [ ] Sin `DataGrid`, `Dialog` ni `Table` de MUI usados directamente en archivos de clientes.
- [ ] Sin `CircularProgress` dentro de botones: toda acción asíncrona usa `Button loading`.
- [ ] Solo íconos `Outlined`; sin `fontSize`/tamaños sueltos fuera de la escala de `00-estandares-ui`.
- [ ] Sin colores sueltos (hex o clases de color de Tailwind); `NUM` local eliminado donde el theme ya aplica cifras tabulares.
- [ ] Copy: verbo del botón = verbo del toast; sentence case; errores con causa y solución.
- [ ] Doble clic rápido en guardar o bloquear produce una sola escritura.
- [ ] Teclado y lectores de pantalla: foco visible, `aria-label` en íconos, filas abribles con Enter.
- [ ] Revisado en 375 / 768 / 1024 / 1440 px y en claro/oscuro (listado, ficha natural y jurídica, `ClienteForm`, `BloqueoDialog`).
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores.
- [ ] Ítems de `00-estandares-ui/checklist.md` cerrados para clientes, anotados con "clientes, 10-refactor-visual-clientes".

## Pendientes / deuda técnica
- _(anotar aquí lo que se difiera, con motivo)_
