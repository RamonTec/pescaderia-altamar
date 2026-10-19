# 16 — Procesamiento multisalida (1 lote crudo → N salidas)

## Contexto

Pedido del cliente (2026-10-19): al limpiar un lote crudo salen **varios productos a la vez**. Por ejemplo, de un pescado entero salen filete, cabeza y piel, cada uno con su peso y su valor de venta. Hoy el sistema solo permite **una salida por lote** (decisión cerrada de `07-lotes`, "un lote crudo da un lote procesado"). Además transfiere **todo** el costo de la entrada a esa única salida (`/SPEC.md` §4.3).

Lo que existe hoy (implementado en `04-inventario` + `07-lotes`):

- `procesamientos (id, fecha, notas)` + `proceso_items` (una fila por salida, con su propio `lote_origen_id`, `peso_entrada_kg` y `costo_total_usd`). Esquema en `0001_initial_schema.sql` y `20261007180100_lotes.sql`. El check `salida_menor_entrada` exige `peso_salida_kg ≤ peso_entrada_kg` por fila.
- La RPC `registrar_procesamiento(p_procesamiento, p_items)` está en `supabase/migrations/20261007180300_lotes_rpc_inventario.sql`. Acepta N líneas, pero cada una lleva su lote y su entrada, y la UI manda una sola. Por cada línea registra un `proceso_out`, un `proceso_in` y un lote hijo (`lotes.proceso_item_id` es `unique`: un lote por línea).
- La UI tiene estas piezas:
  - `ProcesamientoForm.tsx` maneja una sola salida y calcula en vivo con `costoDestino()` de `costingService.ts`.
  - `ProcesamientosTable.tsx` muestra una fila por `proceso_item`.
  - `procesamientoService.ts`, `procesamientoValidation.ts` y `procesamientoRepository.ts`.
- La trazabilidad está en `loteRepository.getMovimientosArbol`, `lib/lotes.ts` (`resultadoLote`) y `LoteTimeline.tsx`, que muestra un evento por `proceso_item`. El árbol padre → hijos (`TrazabilidadLote.arbol`) ya admite N hijos.
- El dashboard lee `proceso_items` en `dashboard_merma_procesos` y `dashboard_rendimiento_proveedor` (`20261008000300_dashboard_inventario.sql`), y lo muestra en `MermaProcesosPanel` y `RendimientoProveedorTable`.
- Deuda abierta: `proceso_items.costo_total_usd` es legible por el operador vía PostgREST (RLS `read_all` de `0001`). Está anotada en `04-inventario/checklist.md`, `07-lotes/checklist.md` y `15-dashboard/checklist.md`. Además, `procesamientos` y `proceso_items` conservan la política `write_all` de insert.

Depende de: `07-lotes` (lotes, RPC y trazabilidad) y `15-dashboard` (RPC de merma y rendimiento), ambos hechos. Toca el esquema de `04-inventario` (`productos`, `procesamientos`, `proceso_items`) y reemplaza la RPC de `07-lotes`. Por eso se anota como tarea agregada en esos dos módulos.

**Por qué es un módulo propio y no una tarea agregada en 04/07**: reabre una decisión cerrada (`/SPEC.md` §4.3 y la tabla de decisiones de `07-lotes`). Además cruza cuatro módulos ya hechos: catálogo (04/12), procesamiento y trazabilidad (07) y dashboard (15). Por eso necesita su propia verificación de cálculo y de seguridad. Es el mismo precedente que `07-lotes`, que reabrió el costeo.

## Decisiones cerradas (2026-10-19, con el usuario)

| Tema | Decisión |
|---|---|
| Unidad de registro | Un procesamiento = **un solo lote crudo** + **un solo peso de entrada** → **N salidas**. Otro lote = otro registro (no se mezclan lotes; sigue fuera de alcance como en `07-lotes`). |
| Salidas | Cada salida es un **producto procesado distinto** del mismo crudo (`productos.producto_origen_id`) y nace como **lote propio** con `lote_padre_id` = lote crudo. |
| Merma | `merma_kg = entrada − Σ salidas`, a nivel del **proceso completo** (no por salida). `Σ salidas ≤ entrada`. `rendimiento = Σ salidas / entrada`. |
| Costo total | `costo_total = peso_entrada × lote_origen.costo_usd_kg` (igual que hoy). |
| Reparto del costo | **Por valor de venta**: `costo_salida_i = costo_total × (kg_i × precio_i) / Σ(kg × precio)`, `costo_kg_i = costo_salida_i / kg_i`. `precio_i` = precio de referencia USD/kg del procesado. |
| Precio de referencia | Nueva columna en `productos` (nullable, ≥ 0, editable en el catálogo, solo en procesados). La línea guarda **siempre** el precio usado como snapshot. |

Esto **reemplaza** la regla "un lote crudo da un lote procesado" y la transferencia total del costo a una única salida (`/SPEC.md` §4.3, actualizado con nota del 2026-10-19). La transferencia total sigue siendo un caso particular: con una sola salida el reparto le asigna el 100 % del costo.

## Decisión de diseño — modelado de la entrada única

Se evaluaron tres opciones:

| Opción | Descripción | Problema |
|---|---|---|
| A. Entrada solo en `procesamientos`; `proceso_items` = salidas sin entrada | Modelo más limpio | Hay que reescribir `dashboard_merma_procesos`, `dashboard_rendimiento_proveedor`, `resultadoLote`, la trazabilidad y el listado, y quitar o volver nullable `peso_entrada_kg` y `salida_menor_entrada`. Los procesamientos históricos con líneas de lotes distintos no encajan. |
| B. Solo `proceso_items`, con la entrada prorrateada por salida | No cambia nada del esquema | No hay ningún registro de "la entrada": la regla "un solo lote, un solo peso" no la garantiza la base, y la merma del proceso solo se reconstruye sumando. |
| **C. Cabecera + líneas prorrateadas (elegida)** | La entrada vive en `procesamientos` (fuente de verdad). Cada `proceso_items` sigue siendo una salida y guarda su **parte prorrateada** de la entrada y su **costo asignado**. | La redundancia la controla la RPC, que es la única que escribe, y se verifica con una consulta (checklist). |

**Justificación de C**:

1. La base garantiza las decisiones 1 y 2: un solo `lote_origen_id` y un solo `peso_entrada_kg` por procesamiento.
2. **Compatibilidad sin reescribir reportes**:
   - `Σ proceso_items.peso_entrada_kg` = entrada del proceso y `Σ costo_total_usd` = costo total. Por eso las RPC del dashboard dan el resultado correcto sin cambios: merma, rendimiento y costo de la merma por producto de origen, y rendimiento por proveedor.
   - `resultadoLote` sigue cuadrando.
   - `lotes.proceso_item_id` (unique) sigue siendo "una línea = un lote hijo".
3. El check `salida_menor_entrada` se mantiene válido porque la entrada se prorratea **por kg de salida**, no por valor (ver regla abajo).
4. Datos existentes: cada procesamiento histórico tiene una línea con su lote. Se rellena la cabecera desde sus líneas sin perder nada.

**Regla**: `proceso_items.peso_entrada_kg` es un dato técnico de prorrateo. **La UI nunca muestra merma ni rendimiento por salida**, solo los del proceso. Lo que sí se muestra por salida es su `%` de la entrada (`kg_i / entrada`).

## Modelo de datos

### `productos` (cambio, esquema de `04-inventario`)

| Columna | Tipo | Nota |
|---|---|---|
| `precio_referencia_usd_kg` | numeric(14,6) nullable, check ≥ 0 | Precio de venta de referencia del procesado. Check: `tipo = 'procesado' or precio_referencia_usd_kg is null`. No es un costo: lo ven todos los roles. |

### `procesamientos` (cambio: cabecera con la entrada única)

| Columna | Tipo | Nota |
|---|---|---|
| `lote_origen_id` | uuid FK `lotes` | El lote crudo procesado |
| `peso_entrada_kg` | numeric(12,3) > 0 | Entrada pesada del proceso completo |
| `costo_total_usd` | numeric(14,6) ≥ 0 | `peso_entrada × costo del lote`. **Costo: solo admin** |
| `reparto_costo` | text check (`valor`, `peso`) | Método con que se repartió el costo (ver caso borde). Auditable |

Las cuatro son nullable a nivel de columna. Un check `not valid` exige las cuatro en filas nuevas. Si el relleno deja 0 filas legadas, se valida.

### `proceso_items` (cambio de semántica + snapshot)

| Columna | Cambio |
|---|---|
| `peso_entrada_kg` | Pasa a ser la **parte prorrateada** de la entrada de la cabecera (`Σ` = cabecera). |
| `costo_total_usd` | Pasa a ser el **costo asignado a esa salida** (`Σ` = cabecera). |
| `lote_origen_id`, `producto_origen_id` | Iguales a los de la cabecera (los escribe la RPC). |
| `precio_referencia_usd_kg` (**nueva**) | numeric(14,6) nullable, ≥ 0. **Snapshot** del precio usado en el reparto. `null` en filas históricas. |

Índice único `(procesamiento_id, producto_destino_id)`: una salida por producto en cada proceso.

### Seguridad (cierra la deuda de costos de procesamiento)

- Vistas `procesamientos_view` y `proceso_items_view` con `costo_total_usd` en `null` si `not es_admin()` (patrón de `lotes_view` en `20261007180200_lotes_vistas.sql`). Se ejecuta `revoke select` sobre las tablas base para `authenticated` y `anon`.
- Se retiran las políticas `write_all` de insert de `procesamientos` y `proceso_items`: solo escribe la RPC (`security definer`), como el ledger en `07-lotes`.
- `lotes_view` y las RPC `dashboard_*` son `security definer` y siguen leyendo las tablas base.
- El snapshot `precio_referencia_usd_kg` no es costo y se expone tal cual. Con precio y kg no se deduce el costo sin conocer el costo del lote.

## Reglas de negocio

### Cálculo del reparto (función pura en `costingService`, espejo en la RPC)

Entrada: `peso_entrada`, `costo_lote_usd_kg` y `salidas[{ kg, precio | null }]`.

1. `costo_total = round(peso_entrada × costo_lote, 6)`.
2. Peso de cada salida: `w_i = kg_i × precio_i`.
   - Si hay **una sola salida**, el precio no es necesario: recibe el 100 % del costo (equivale a la transferencia total anterior).
   - Si hay **≥ 2 salidas**, toda salida necesita precio (ver "Precio de referencia").
3. Si `Σ w_i > 0`, el reparto es **por valor** (`reparto_costo = 'valor'`).
   - **Caso borde `Σ(kg × precio) = 0`** (todas las salidas con precio 0): el reparto es **por peso**, `w_i = kg_i` (`reparto_costo = 'peso'`). Todas las salidas quedan con el mismo costo/kg = `costo_total / Σ kg`, que es la regla de transferencia total anterior.
   - Con una sola salida también se guarda `'peso'`.
4. `costo_salida_i = round(costo_total × w_i / Σ w, 6)`. El residuo de redondeo va a la salida de mayor `w` (la primera en caso de empate), para que `Σ costo_salida_i = costo_total` exacto.
5. `costo_kg_i = round(costo_salida_i / kg_i, 6)` → `lotes.costo_usd_kg` del hijo y `costo_usd_kg` de su `proceso_in`.
6. Si una salida tiene precio 0 y `Σ w > 0`, su costo es 0: su lote nace a costo 0 (check `≥ 0` vigente).
7. **Entrada prorrateada** (solo para `proceso_items.peso_entrada_kg`), por kg de salida, en milésimas:
   - `e_i = floor(entrada × kg_i / Σ kg, 3)`.
   - Las milésimas que faltan para llegar a `entrada` se reparten de a una por mayor resto.
   - Así se garantiza `e_i ≥ kg_i` (check `salida_menor_entrada`) y `Σ e_i = entrada`.

Ejemplo para `scripts/probar-procesamiento.ts`: lote de 10 kg a $5 (costo total $50).

| Salidas | Costo asignado | Costo/kg | Merma / rendimiento |
|---|---|---|---|
| filete 6 kg a $12, cabeza 1 kg a $2, piel **0,5 kg** a $1 (Σ valor 74,5) | 48,322148 / 1,342282 / 0,335570 (≈ $48,32 / $1,34 / $0,34) | 8,053691 / 1,342282 / 0,671140 (≈ $8,05 / $1,34 / $0,67) | 2,5 kg, 25 % / 75 % |

> Caso de prueba confirmado por el usuario el 2026-10-19: piel de **0,5 kg**. (Antes la spec documentaba también una variante con piel de 1 kg, que daba $48,00 / $1,33 / $0,67; se descartó.)

Entrada prorrateada: 8,000 / 1,333 / 0,667 (Σ 10,000).

### Precio de referencia

- Se edita en Catálogos (`ProductoForm`), solo en procesados, opcional.
- En el procesamiento, cada salida usa el precio del catálogo. Si existe, se muestra en solo lectura: el reparto no se ajusta por procesamiento.
- Si el procesado **no tiene precio** y hay ≥ 2 salidas, el formulario lo pide en esa fila (obligatorio, ≥ 0). Al registrar:
  - la RPC lo usa y lo guarda como snapshot;
  - **lo guarda en el catálogo solo si estaba vacío** (`update … where precio_referencia_usd_kg is null`). Nunca sobrescribe un precio existente, y el cambio de precio sigue siendo cosa de Catálogos.
- La RPC **no confía en el precio del cliente** si el catálogo tiene uno: usa el del catálogo, que lee bajo la misma transacción.
- Cambiar el precio en el catálogo no recalcula procesamientos ni lotes pasados: el snapshot y `lotes.costo_usd_kg` quedan fijos (`/SPEC.md` §2, "nunca se recalcula historia").

### RPC `registrar_procesamiento` (reemplazo, nueva migración)

Firma `registrar_procesamiento(p_procesamiento jsonb, p_salidas jsonb) → jsonb`. Se hace `drop` + `create`, como en 07.

- `p_procesamiento`: `{ id, fecha, notas, lote_origen_id, peso_entrada_kg }`.
- `p_salidas`: `[{ producto_destino_id, peso_salida_kg, precio_referencia_usd_kg? }]`.
- Devuelve `{ procesamiento_id, reparto_costo, lotes: [{ lote_id, codigo, producto_id, peso_kg }] }`, sin costos.

Pasos, todos bajo el lock de la fila del lote (`for update`):

1. Validaciones de origen iguales a las de hoy: crudo activo, lote abierto, `entrada ≤ stock`.
2. Validaciones por salida: procesado activo con `producto_origen_id` = crudo del lote, `kg > 0`, sin duplicados.
3. `Σ salidas ≤ entrada`.
4. Resolución de precios y reparto, según las reglas de arriba.
5. Inserta una cabecera, N `proceso_items`, **un** `proceso_out` (−entrada, lote crudo, `ref_id` = procesamiento) y, por salida con `controla_stock`, un lote hijo + su `proceso_in`. Las salidas sin control de stock registran el `proceso_in` sin lote, como hoy.
6. Ejecuta `lote_sincronizar_estado` del lote crudo.

Errores nuevos (`errcode P0001`, `detail = 'salida:N'` cuando aplica):

| `hint` | Cuándo |
|---|---|
| `salidas_exceden_entrada` | `Σ salidas > entrada` |
| `salida_duplicada` | El mismo producto aparece en dos salidas |
| `precio_requerido` | ≥ 2 salidas y una sin precio en catálogo ni en el payload |

Se conservan `lote_no_disponible`, `origen_invalido`, `destino_invalido`, `destino_no_corresponde` y `stock_insuficiente`.

## Pantallas

### `/procesamiento` — `ProcesamientoForm` (reescritura del cuerpo; `AppDialog` `md`, `fullScreen` en `xs`)

1. **Entrada**: fecha → producto crudo → `LoteAutocomplete` (PEPS preseleccionado, chip "antiguo") → peso de entrada ("Usar todo el lote" como hoy).
2. **Salidas** (`useFieldArray`, mín. 1, máx. 10): por fila, procesado del crudo (sin repetir los ya elegidos), kg y precio de referencia.
   - El precio se muestra solo con ≥ 2 salidas: en solo lectura si viene del catálogo, o campo obligatorio con ayuda "Se guardará en el catálogo".
   - Botón "Agregar salida" (deshabilitado si ya se usaron todos los procesados del crudo) y quitar fila (no la última).
   - Si el crudo tiene un solo procesado, se precarga la primera fila, como hoy.
3. **Resumen en vivo**:
   - Para todos: Σ salidas, merma kg y %, rendimiento del proceso, y por fila el `%` de la entrada.
   - Aviso en vivo si `Σ salidas > entrada` o si falta un precio.
   - **Solo admin** (`costo_usd_kg` del lote ≠ `null`): por fila, costo asignado, `%` del costo y costo/kg, más el texto "Costo del lote X ($…) repartido por valor de venta" (o "por peso" en el caso borde).
   - El operador no recibe ni ve costos (`lotes_view` ya los anula).
4. Al guardar: `LotesCreadosDialog` con los N códigos para rotular (ya admite lista).

### `/procesamiento` — `ProcesamientosTable`

- **Una fila por procesamiento**:
  - fecha
  - crudo + lote origen (`LoteChip`)
  - entrada
  - salidas: lista compacta "Filete 6,000 kg · FIL-261019-1", con `getRowHeight` automático
  - Σ salida
  - merma
  - rendimiento
  - **solo admin**: costo total y, en la lista de salidas, el costo/kg de cada una
- La búsqueda rápida encuentra por producto y código de lote de cualquier salida. En `xs` se ocultan entrada, merma y notas.

### Catálogos — `ProductoForm` / `ProductosTable`

- `ProductoForm`: `NumberField` "Precio de referencia (USD/kg)", opcional, visible solo si `tipo = 'procesado'`. Ayuda: "Se usa para repartir el costo cuando un lote da varios productos". Si se cambia a `crudo`, se envía `null`.
- `ProductosTable`: columna "Precio ref." (procesados), oculta en `xs`.

### Trazabilidad (`/inventario/lotes/[id]`)

- `ProcesoLote` se agrupa **por procesamiento**: entrada de la cabecera y lista de salidas con su lote hijo.
- `LoteTimeline` muestra un evento por procesamiento: "10,000 kg → 3 salidas", con un enlace a cada lote hijo y la merma y el rendimiento del proceso.
- En la ficha de un lote hijo, "Nace de procesar el lote X". Para admin se agrega el costo/kg con la nota "costo repartido por valor de venta" en lugar de "(incluye la merma)".
- `resultadoLote` toma la entrada de la cabecera, no de las líneas: mismo resultado y sin depender del prorrateo. El árbol de un crudo ya incluye sus N hijos y el resultado los consolida.

### Dashboard (`15-dashboard`)

- `dashboard_merma_procesos` y `dashboard_rendimiento_proveedor` **no cambian**: con la opción C, `Σ` de las líneas = cabecera. Se verifican con el caso de prueba (checklist).
- **Cambio de significado** en B7: `Σ costo_total_usd / Σ peso_salida_kg` deja de ser "costo del kg limpio" y pasa a ser el **costo medio del kg obtenido** de todas las salidas. Se re-etiqueta en `RendimientoProveedorTable` ("Costo medio kg obtenido", con ayuda) sin tocar la RPC. `MermaProcesosPanel` no cambia; solo se ajusta su texto de ayuda.

## Arquitectura por capas (archivos)

| Capa | Archivo | Cambio |
|---|---|---|
| Migraciones | `supabase/migrations/20261019000000_procesamiento_multisalida_esquema.sql`, `…000100_…_vistas.sql`, `…000200_…_rpc.sql` | Ver `tasks.md` |
| Tipos | `src/types/domain.ts` | `Producto.precio_referencia_usd_kg`; `Procesamiento` con cabecera (`costo_total_usd: number \| null`); `ProcesoItem.precio_referencia_usd_kg`; `RepartoCosto`; `ProcesoLote` agrupado + `SalidaProcesoLote` |
| Dominio puro | `src/lib/services/costingService.ts` | `repartirCostoProceso()` y `prorratearEntrada()` (reemplazan a `costoDestino`, que se retira al quedar sin consumidores) |
| Validación | `src/lib/procesamientoValidation.ts`, `src/lib/productoValidation.ts` | Esquema con `salidas[]` + helper puro `validarPreciosSalidas(salidas, procesados)` usado por la UI y el servicio |
| Repositorio | `interfaces.ts`, `procesamientoRepository.ts`, `loteRepository.ts`, `catalogRepositories.ts` | Lecturas desde las vistas nuevas; `create(procesamiento, salidas)` |
| Servicio | `procesamientoService.ts`, `lib/lotes.ts` | Validaciones previas y mapeo de errores a `salidas.N.*`; `resultadoLote` con la cabecera |
| UI | `ProcesamientoForm`, `ProcesamientosTable`, `procesamiento/page.tsx` + `actions.ts`, `LoteTimeline`, `ProductoForm`, `ProductosTable`, `RendimientoProveedorTable`, `MermaProcesosPanel` | Ver "Pantallas" |

## Fuera de alcance (MVP)

- Mezclar varios lotes crudos en un procesamiento (decisión 2).
- Merma o rendimiento **por salida** (decisión 1): la merma es del proceso.
- Ajustar el precio de referencia por procesamiento cuando el catálogo ya tiene uno.
- Historial de cambios del precio de referencia (solo existe el snapshot por línea).
- Desglose del dashboard por producto procesado (rendimiento o costo por salida); B7 solo se re-etiqueta.
- Anular o editar procesamientos (sigue siendo deuda de `04-inventario`).
- Usar el precio de referencia como precio sugerido en el POS.
