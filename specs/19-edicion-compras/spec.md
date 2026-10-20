# 19 — Edición de compras

## Contexto

Pedido del cliente (2026-10-19): el admin quiere **editar una compra ya registrada** (errores de captura en kg, costo, proveedor, fecha, condición, moneda o tasa).

Lo que existe hoy:

- **Compras** (`04-inventario`, `/SPEC.md` §4.2): `compras` (proveedor, fecha, condición, moneda, `tasa_snapshot` + procedencia de `08-tasas`, `subtotal_usd`, `pagado_usd`, estado, notas) y `compra_items` (`peso_kg`, `costo_usd_kg`). La escribe solo la RPC `registrar_compra` (última versión en `supabase/migrations/20261007180300_lotes_rpc_inventario.sql`); `compras` no tiene política de `update`. `compraService.crearCompra` convierte el costo/kg capturado en la moneda pactada a USD (`costoUsdKg`) y **no guarda el costo original en Bs**: solo `costo_usd_kg`. Contado nace con `pagado_usd = subtotal_usd` y estado `pagada`, **sin fila en `pagos_proveedores`** (pago implícito al registrar). Crédito nace `abierta` y se abona con `registrar_pago_proveedor` (lock de la compra, ganancia cambiaria contra `compras.tasa_snapshot`).
- **No hay ficha de compra**: `ICompraRepository.getById` → `CompraDetalle` (items + pagos) lo usa el contrato. Las compras se ven en `ComprasTable` (`/compras`, `⋮` solo admin: "Registrar pago" + contrato) y en "Historial de compras" de `/proveedores/[id]`.
- **Lotes** (`07-lotes`): una línea de compra con control de stock = un lote (`lotes.compra_item_id`), con `peso_inicial_kg`, `costo_usd_kg`, `moneda`, `tasa_snapshot`, `proveedor_id` y `fecha_ingreso` copiados de la compra. El código `<producto>-<AAMMDD>-<n>` usa la fecha de la compra (`generar_codigo_lote`). Stock = Σ `movimientos` del lote; **toda fila de `movimientos` de un lote lleva `costo_usd_kg` = costo del lote** (compra, proceso_out/in, venta, pérdida, `ajuste` de notas de crédito, `correccion_venta`). Lectura por `lotes_view` / `movimientos_view` / `compra_items_view` (costo `null` si no admin).
- **Procesamiento** (`16-procesamiento-multisalida`): solo se procesan crudos, así que el árbol tiene **un nivel**: lote de compra → lotes hijos. Cabecera `procesamientos` (`costo_total_usd`, `reparto_costo valor|peso`) y `proceso_items` (costo asignado + snapshot `precio_referencia_usd_kg`). Los hijos heredan proveedor, moneda y tasa del padre. Reparto en `registrar_procesamiento` (`20261019000200_…`) con las funciones internas `procesamiento_repartir_costo` / `procesamiento_div_redondeo`, espejo de `costingService.repartirCostoProceso`.
- **Ventas** (`05`/`07`/`17`): `factura_item_lotes.costo_usd_kg` = costo del lote; `factura_items.costo_usd_kg` = promedio ponderado de su asignación. `notas_credito`, `nota_credito_items`, `nota_credito_item_lotes` y `perdidas_lote` **no guardan costo**: lo toman del movimiento o de `factura_items`.
- **Corrección con historial** (`17` y `18`): precedente directo (RPC atómica `security definer` con `es_admin()` y lock, motivo 5–500, historial permanente solo admin, saldo a favor, contrato desactualizado derivado en `contratos_listado_view`, sin recalcular ganancia cambiaria).
- **Dashboard** (`15`): lee lotes, `proceso_items`, `factura_items` y `compras` vigentes (ver "Efecto en otros módulos").

Depende de `03`, `04`, `06`, `07`, `08`, `15`, `16`, `17` y `18`, todos hechos.

**Por qué es un módulo propio**: cambia valores que `/SPEC.md` §2 trata como snapshot (tasa y costo de la compra) y propaga costo a procesamientos (16), ledger y lotes (07) y líneas vendidas (17). Además toca contratos (06) y proveedores (03). Es el mismo precedente que `17`.

## Decisiones cerradas (2026-10-19, con el usuario)

| Tema | Decisión |
|---|---|
| Qué se edita | De cada línea: **kg** y **costo/kg**. De la cabecera: **proveedor, fecha, notas, condición** (contado/crédito), **moneda y tasa**. |
| Propagación del costo | Si cambia el costo USD de una línea (por costo/kg, moneda o tasa), el costo nuevo del lote baja a: lotes procesados hijos (reparto de 16 con el snapshot de `proceso_items`), movimientos del ledger, `costo_usd_kg` de `factura_item_lotes` y `factura_items` ya vendidos, y pérdidas y notas de crédito si guardan costo. **Precios de venta y totales de facturas no cambian.** Atómico. |
| Kg | Subir siempre. Bajar solo hasta lo consumido (`peso_inicial − stock`). El stock nunca queda negativo. |
| Permisos e historial | Solo admin, motivo obligatorio, historial (quién, cuándo, antes, después, motivo) solo admin, escrito solo por RPC `security definer` con `es_admin()` y lock de la compra y de los lotes. |
| Pagos | Si lo pagado supera el total nuevo → **saldo a favor con el proveedor**. No se recalcula la ganancia cambiaria de pagos hechos. |
| Contrato | El contrato de compra a crédito queda **desactualizado** con la regla derivada de 17. |
| Anuladas | Las compras anuladas no se editan. |
| D1 · Contado cuyo total cambia | Lo pagado **sigue al total**: en contado se paga en el momento lo que el proveedor cobra, así que la compra sigue `pagada` sin saldo. Solo hay saldo a favor si los pagos registrados aparte superan el total nuevo. |
| D2 · Crédito → contado | Se marca **pagada** sin registrar un pago (igual que una compra de contado nueva): lo que faltaba se toma como pagado al registrar, a la tasa de la compra y sin ganancia cambiaria. Los pagos ya registrados se conservan. |
| D3 · Contado → crédito | Se quita el pago implícito del registro: lo pagado pasa a ser solo la suma de pagos registrados (normalmente 0) y queda todo por pagar. Si se pagó una parte, se registra como abono después. |
| D4 · Cambio de proveedor | Cambia en la compra y en **todo el árbol de lotes** (compra + procesados). Los pagos registrados **siguen a la compra** (no tienen proveedor propio). El contrato queda desactualizado (su PDF nombra al anterior). Si la compra queda a crédito, el proveedor nuevo no puede estar **bloqueado** (regla de 04). |
| D5 · Cambio de fecha | Cambia `compras.fecha` y la `fecha_ingreso` de sus lotes (reordena el PEPS futuro; las asignaciones ya hechas no cambian). **El código de lote se conserva** (puede estar rotulado). La fecha no puede ser futura ni **posterior a la primera salida** de sus lotes (proceso, venta o pérdida). **La tasa no cambia sola**: si era referencial y la del día nuevo es distinta, se avisa y el admin decide si la cambia. |
| D6 · Cambio de moneda | El número del costo/kg **se conserva** y se interpreta en la moneda nueva (error típico: "anoté Bs pero quedó USD"); la vista previa muestra el costo USD resultante. Se guarda el costo pactado en su moneda (columna nueva). |
| D7 · Subir kg en lote cerrado o agotado | Se **reabre** el lote (`abierto`) con los kg agregados (mismo precedente que notas de crédito y 17), con aviso «ciérralo de nuevo si esos kg no existen». |
| D8 · Pantalla | Ficha **`/compras/[id]`** solo admin (como `/facturas/[id]`) con líneas, lotes, pagos, contrato e historial, y diálogo "Editar compra" desde la ficha y desde el `⋮` de `/compras` y del historial del proveedor. |

Las filas D1–D8 las aprobó el usuario el 2026-10-19, con la recomendación de la primera versión de esta spec y sin cambios.

## Decisión de diseño

### Costo pactado en la moneda de la compra (hallazgo)

Hoy `compra_items` solo guarda `costo_usd_kg`. En una compra en Bs, el costo pactado (p. ej. 3.500 Bs/kg) se pierde y solo se puede reconstruir como `costo_usd_kg × tasa`, con error de redondeo. Para cambiar la tasa de una compra en Bs hay que partir del costo pactado, no del USD. Por eso:

- columna nueva `compra_items.costo_kg_pactado` (en la moneda de la compra);
- relleno de las filas existentes: `usd` → `costo_usd_kg`; `bs` → `round(costo_usd_kg × tasa_snapshot, 2)` (el formulario captura 2 decimales, así que recupera el valor tecleado). El relleno **no** recalcula `costo_usd_kg`;
- `registrar_compra` lo guarda desde ahora (recibe el costo capturado);
- regla: `costo_usd_kg = moneda = 'usd' ? round(pactado, 6) : round(pactado / tasa, 6)` (igual que `costoUsdKg`).

Es costo: `compra_items_view` lo expone en `null` si no es admin.

### Procedencia de la tasa (08-tasas)

Cambiar la tasa usa el mismo `TasaSelector` y `resolverTasaOperacion` que el alta, **para la fecha final de la compra**: referencial (BCV o paralela, recalculada en el servidor) o manual (con la confirmación por desviación de 08). Se guardan `tasa_snapshot`, `tasa_origen`, `tasa_fuente`, `tasa_referencial` y `tasa_registrada_por = auth.uid()` (quien edita). Si la tasa no se toca, sus cinco columnas quedan **intactas** aunque cambie la fecha: no se re-resuelve la referencial (podría haber cambiado en `/tasas` y alteraría la historia sin pedirlo). El listado "Operaciones con tasa manual" de `/tasas` lee los valores vigentes.

Con moneda `usd`, cambiar la tasa no cambia el costo USD: solo `lotes.tasa_snapshot` (resultado en Bs a tasas históricas de 07) y la ganancia cambiaria **futura** de abonos. Con moneda `bs`, cambia el costo USD de todas las líneas y se propaga.

### Movimiento del ledger: tipo nuevo `correccion_compra`

Igual que `correccion_venta` en 17, se descartan:

- **reescribir los kg del movimiento `compra`**: rompe el ledger auditable (`/SPEC.md` §5);
- **`ajuste`**: ya significa inventario inicial y devoluciones o reversiones de notas de crédito.

`correccion_compra` lleva `+delta` o `−delta` kg en el lote de la línea, `ref_id` = la corrección y `fecha` = la de la edición. `lotes.peso_inicial_kg` pasa a ser el peso vigente de la línea (`= compra_items.peso_kg`): sigue siendo el "100 %" de la barra de stock, y el stock sigue siendo Σ movimientos. Nada filtra movimientos por `tipo`, así que agregar uno no afecta stock ni reportes.

Lo que **sí** se reescribe es el **costo** (`costo_usd_kg`) de los movimientos de los lotes cuyo costo cambia, nunca sus kg: lo aprobó el usuario (decisión "Propagación") y mantiene el invariante "movimiento de un lote = costo del lote", del que dependen `resultadoLote` y el dashboard.

### Historial: `compra_correcciones` + `compra_correccion_items`

Una fila por edición (una llamada, un motivo) con la cabecera antes y después, y una fila hija por línea que cambió. Dos tablas en lugar de columnas repetidas o `jsonb`, porque las líneas son N y se quieren checks por columna. La propagación (lotes hijos y líneas de factura recalculados) va como resumen `jsonb` en la cabecera: es informativa y su detalle exacto ya queda en las tablas vigentes.

### Escritura: RPC única `editar_compra`

Toda la edición en una llamada y una transacción: si algo falla, no queda nada a medias. Lock de la compra (`for update`, como `registrar_pago_proveedor`) y luego de **todos** los lotes del árbol (lotes de la compra + hijos) en **una sola sentencia** ordenada por `fecha_ingreso, codigo`, el mismo orden que `registrar_factura` y `corregir_linea_factura`, para no crear interbloqueos con ventas, procesamientos, pérdidas y correcciones de facturas. No se bloquean `facturas`: no se tocan sus totales, y las filas de `factura_items` / `factura_item_lotes` se actualizan bajo el lock de sus lotes.

### Contrato desactualizado: misma regla derivada de 17

`contratos_listado_view.ultima_correccion_at` pasa a ser el máximo entre `factura_correcciones` (por `factura_id`) y `compra_correcciones` (por `compra_id`). `desactualizado` no cambia de fórmula. Sin escribir en `contratos`.

### Lectura: RPC `detalle_compra`

`detalle_compra(p_compra_id) → jsonb`, `stable`, `security definer`, `42501` si no es admin. En una consulta: compra + proveedor, líneas con su lote (código, estado, `peso_inicial`, stock, consumido desglosado en procesado / vendido / perdido, fecha de la primera salida), procesamientos del lote con sus salidas (kg, snapshot de precio, reparto, lote hijo, costo), kg vendidos por lote (padre e hijos) con su número de líneas y facturas, pagos registrados, contrato activo con `desactualizado` y correcciones con sus líneas y el nombre del usuario. Alimenta la ficha y la vista previa sin N+1 (precedente `trazabilidad_factura`).

## Modelo de datos

### `compra_items` (04)

| Columna | Tipo | Nota |
|---|---|---|
| `costo_kg_pactado` | numeric(14,6) not null, check ≥ 0 | Costo/kg en la moneda de la compra. Relleno según "Decisión de diseño". En `compra_items_view`, al final, `null` si no admin |

### `compra_correcciones` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | `ref_id` de los movimientos `correccion_compra` |
| `compra_id` | uuid not null FK `compras` | |
| `proveedor_anterior_id`, `proveedor_nuevo_id` | uuid not null FK `proveedores` | |
| `fecha_anterior`, `fecha_nueva` | date not null | |
| `condicion_anterior`, `condicion_nueva` | text not null | `contado` / `credito` |
| `moneda_anterior`, `moneda_nueva` | text not null | `usd` / `bs` |
| `tasa_anterior`, `tasa_nueva` | numeric(14,6) not null | `tasa_snapshot` |
| `tasa_origen_anterior`, `tasa_origen_nueva` | text not null | `referencial` / `manual` |
| `tasa_fuente_anterior`, `tasa_fuente_nueva` | text null | |
| `tasa_referencial_anterior`, `tasa_referencial_nueva` | numeric(14,6) null | |
| `notas_anterior`, `notas_nueva` | text null | |
| `subtotal_anterior_usd`, `subtotal_nuevo_usd` | numeric(14,6) not null | |
| `pagado_anterior_usd`, `pagado_nuevo_usd` | numeric(14,6) not null | |
| `pagos_registrados_usd` | numeric(14,6) not null | Σ `pagos_proveedores.monto_usd` al editar (explica saldo a favor y D1–D3) |
| `estado_anterior`, `estado_nuevo` | text not null | `abierta` / `pagada` |
| `contrato_id` | uuid null FK `contratos` | Contrato activo al editar |
| `propagacion` | jsonb not null default `'{}'` | `{ lotes: [{ lote_id, codigo, origen, costo_anterior, costo_nuevo }], procesamientos, lineas_factura, facturas }` |
| `motivo` | text not null | check `char_length(btrim(motivo)) between 5 and 500` |
| `usuario_id` | uuid not null default `auth.uid()` FK `perfiles` | |
| `created_at` | timestamptz not null default `now()` | |

Índice `(compra_id, created_at desc)`.

### `compra_correccion_items` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `correccion_id` | uuid not null FK `compra_correcciones` | |
| `compra_item_id` | uuid not null FK `compra_items` | |
| `lote_id` | uuid null FK `lotes` | `null` si el producto no controla stock |
| `peso_anterior_kg`, `peso_nuevo_kg` | numeric(12,3) not null | nuevo > 0 |
| `costo_pactado_anterior`, `costo_pactado_nuevo` | numeric(14,6) not null | En la moneda anterior y la nueva |
| `costo_anterior_usd_kg`, `costo_nuevo_usd_kg` | numeric(14,6) not null | |

Una fila solo si cambió kg, costo pactado o costo USD de la línea. Índices `(correccion_id)` y `(compra_item_id)`. Unique `(correccion_id, compra_item_id)`.

RLS de las dos (igual que `factura_correcciones`): `select` solo `es_admin()`, sin políticas de escritura, `revoke all … from anon` y `revoke insert, update, delete, truncate … from authenticated`. Permanentes.

### Cambios a tablas existentes

| Tabla | Cambio | Módulo dueño |
|---|---|---|
| `movimientos` | `movimientos_tipo_check` suma `correccion_compra` (`drop` + `add`, conservando `correccion_venta`) | 04 / 07 |
| `compras`, `compra_items`, `lotes`, `procesamientos`, `proceso_items`, `movimientos`, `factura_items`, `factura_item_lotes` | Sin columnas nuevas (salvo `costo_kg_pactado`). Se actualizan **solo** desde `editar_compra` | 04 / 07 / 16 / 05 |
| `registrar_compra` | `create or replace` con la misma firma: guarda `costo_kg_pactado` (si no llega, lo deriva como el relleno) | 04 / 07 |
| `contratos_listado_view` | `create or replace`: `ultima_correccion_at` también lee `compra_correcciones` | 06 |

## Reglas de negocio

### RPC `editar_compra`

Firma: `editar_compra(p_compra_id uuid, p_cabecera jsonb, p_items jsonb, p_motivo text) → jsonb`.

- `p_cabecera`: `{ proveedor_id, fecha, condicion, moneda, notas, tasa: null | { tasa_snapshot, tasa_origen, tasa_fuente, tasa_referencial } }`. `tasa = null` conserva las cinco columnas de tasa.
- `p_items`: `[{ compra_item_id, peso_kg, costo_kg_pactado }]`: **todas** las líneas de la compra, ni más ni menos.
- Devuelve `{ correccion_id, subtotal_usd, pagado_usd, saldo_usd, saldo_a_favor_usd, estado, contrato: { id, numero, estado } | null, lotes: [{ lote_id, codigo, delta_kg }], propagacion: { lotes_recalculados, procesamientos, lineas_factura, facturas } }`.

Pasos (una transacción):

1. `es_admin()`, o `42501`.
2. Lock de la compra. No existe → `P0002`; `anulada` → `compra_anulada`.
3. Motivo (`btrim`, 5–500) → `motivo_requerido`. Líneas = las de la compra → `items_no_coinciden`. `peso > 0` (3 dec.), `costo_kg_pactado ≥ 0` (6 dec.), `tasa_snapshot > 0` → `23514`.
4. Proveedor: si cambia, debe existir y estar activo → `proveedor_invalido`. Si la condición final es crédito, el proveedor final está bloqueado y cambió el proveedor o la condición pasó a crédito → `proveedor_bloqueado` (D4).
5. Lock de los lotes del árbol (una sentencia, `fecha_ingreso, codigo`).
6. Fecha: no futura (zona de Caracas) → `fecha_invalida`; si cambia, ≤ primera salida de sus lotes (`procesamientos.fecha`, `facturas.fecha` de sus `factura_item_lotes`, `perdidas_lote.fecha`) → `fecha_posterior_a_salidas` (D5).
7. Costo USD nuevo de cada línea con la moneda y la tasa finales. Si nada cambia (cabecera, tasa y líneas) → `sin_cambios`.
8. Kg: por línea con lote, si `delta < 0` y `−delta > lote_stock` → `peso_menor_consumido` (`detail = 'item:N'`).
9. Aplica el "Orden de recálculo" (abajo).
10. Inserta `compra_correcciones` (id generado en el paso 1, con `contrato_id` activo y `propagacion`) y sus `compra_correccion_items`.

Errores (`P0001`, `hint`):

| `hint` | Cuándo |
|---|---|
| `compra_anulada` | La compra está anulada |
| `sin_cambios` | Nada cambia |
| `motivo_requerido` | Motivo vacío, < 5 o > 500 caracteres |
| `items_no_coinciden` | Faltan, sobran o se repiten líneas (agregar o quitar está fuera de alcance) |
| `peso_menor_consumido` | Bajar kg por debajo de lo ya consumido del lote |
| `proveedor_invalido` | Proveedor inexistente o inactivo |
| `proveedor_bloqueado` | Compra a crédito con proveedor bloqueado (D4) |
| `fecha_invalida` | Fecha futura |
| `fecha_posterior_a_salidas` | Fecha posterior a la primera salida de un lote |

`revoke … from public, anon`; `grant execute … to authenticated`.

### Orden de recálculo (dentro de `editar_compra`)

1. **Líneas**: `compra_items.peso_kg`, `costo_kg_pactado`, `costo_usd_kg`.
2. **Lote de la línea**: `peso_inicial_kg` = peso nuevo, `costo_usd_kg`, `moneda`, `tasa_snapshot`, `proveedor_id`, `fecha_ingreso` (el `codigo` no cambia). Si `delta ≠ 0`, movimiento `correccion_compra` por `delta` al costo nuevo; si `delta > 0` y el lote está `cerrado` o `agotado`, pasa a `abierto` (D7); luego `lote_sincronizar_estado`. Línea sin lote: movimiento `correccion_compra` sin lote.
3. **Hijos**: todo lote con `lote_padre_id` en los lotes de la compra hereda `proveedor_id`, `moneda` y `tasa_snapshot` (no su fecha, que es la del procesamiento).
4. **Procesamientos** de cada lote cuyo costo cambió, en orden `fecha, id`: `costo_total = round(peso_entrada × costo_lote_nuevo, 6)` y reparto con las funciones internas de 16, usando el `reparto_costo` guardado y los `precio_referencia_usd_kg` snapshot de sus `proceso_items` (orden `id`; el residuo va a la salida de mayor peso y, en empate, a la de menor `id`). Se actualizan `procesamientos.costo_total_usd`, `proceso_items.costo_total_usd` y `costo_usd_kg` de cada lote hijo (`round(costo_i / kg_i, 6)`, como 16). `peso_entrada_kg` prorrateado y kg no cambian. Procesamiento legado sin `reparto_costo` → por peso.
5. **Ledger**: `movimientos.costo_usd_kg` = costo del lote para **todas** las filas de cada lote cuyo costo cambió (compra, proceso_out/in, venta, pérdida, ajuste de notas de crédito, `correccion_venta`, `correccion_compra`). Líneas sin lote: el movimiento `compra` sin lote de esa línea (`ref_id` = compra, mismo producto, peso y costo anteriores; si hay dos idénticos, cualquiera) y sus `correccion_compra`.
6. **Ventas**: `factura_item_lotes.costo_usd_kg` = costo del lote; después, para cada `factura_items` afectado, `costo_usd_kg = round(Σ fil.peso × fil.costo / peso, 6)` (regla de 07 y 17). Incluye facturas anuladas (mantiene el invariante). `precio_usd_kg`, `subtotal_usd`, `iva_usd`, `total_usd`, `pagado_usd` y estado de las facturas **no se tocan**.
7. **Pérdidas y notas de crédito**: no guardan costo propio. Su valor sale del movimiento (paso 5) o de `factura_items.costo_usd_kg` (paso 6), así que quedan recalculadas sin escribir en `perdidas_lote` ni en `notas_credito*`.
8. **Compra**: cabecera, `subtotal_usd = round(Σ peso × costo_usd, 6)` (igual que `subtotalUsd`), pagado y estado (abajo).

**No se reescriben**: `factura_correcciones.costo_*` (historial de 17, vale lo que había al corregir), los `pagos_proveedores` ni su `ganancia_cambiaria_bs`, la tasa de facturas y pagos, ni ningún kg del ledger.

### Pagos, condición y estado

`P` = Σ `pagos_proveedores.monto_usd` de la compra; `T` = subtotal nuevo.

| Condición final | `pagado_usd` nuevo |
|---|---|
| Crédito (siga o venga de contado, D3) | `P` |
| Contado (siga o venga de crédito, D1/D2) | `max(P, T)`: el pago implícito al registrar cubre lo que no cubren los pagos registrados |

- Estado: `pagada` si `T − pagado ≤ 0.000001`; si no, `abierta` (regla de `registrar_pago_proveedor` y 17). Una compra a crédito con total 0 queda `pagada`, como en el alta.
- **Saldo a favor con el proveedor** = `pagado − T` cuando es > 0: se muestra (ficha, listado, ficha de proveedor) y **no se aplica sola** a otra compra.
- Ganancia cambiaria de pagos hechos: no se recalcula aunque cambie la tasa. Los abonos futuros usan la tasa nueva.
- **Vencimiento**: las compras no tienen vencimiento propio. Sin contrato, el dashboard lo deriva de `compras.fecha + dias_credito_default` (D2 de 15), así que sigue a la fecha nueva. Con contrato, el vencimiento es el del contrato (fijo) y el contrato queda desactualizado.

### Contrato activo

- Aviso previo en el diálogo, como 17: «El contrato N.º 0007 (firmado) quedará desactualizado: anúlalo y genera otro desde el menú ⋮». Con cambio de proveedor, el texto agrega «nombra a <proveedor anterior>».
- **Crédito → contado con contrato activo**: el contrato queda desactualizado y ya no se puede generar otro (contado no es elegible). Hoy `contratoService.elegibilidad` omite las compras de contado, así que el `⋮` no mostraría el contrato: se corrige para que un origen de contado **con contrato activo** muestre "Ver contrato N.º 0007 (desactualizado)" (tarea agregada en 06). Se anula desde ahí o desde `/contratos`.
- No se anula solo.

### Lo que ve el operador

Nada de la edición: la ficha da 404, no hay acciones, las RPC dan `42501` y las tablas de historial devuelven 0 filas. En el listado y en el inventario ve los valores vigentes sin costos (proveedor, fecha, condición, kg, estado). Los movimientos `correccion_compra` aparecen en `movimientos_view` solo con kg (como `correccion_venta`).

## Pantallas

### `/compras/[id]` — ficha de compra (solo admin, D8)

- `page.tsx` server con `requireAdmin()` → `notFound()` para el operador; `params` es `Promise` (Next 16). Datos de `detalle_compra`.
- `FichaHeader`: título «Compra del 07/10/2026»; `meta`: proveedor (enlace), condición, moneda, `EstadoChip`, chip "Editada · N" si tiene correcciones y "Contrato desactualizado" si aplica; `backHref` `/compras`; acción primaria "Editar compra" (`EditOutlined`), deshabilitada con tooltip si está anulada. `?editar=1` abre el diálogo al cargar.
- `organisms/CompraResumenCard`: total, pagado (pagos registrados + "pagado al registrar" si contado), saldo o **saldo a favor** (verde, «a favor del negocio»), en USD y Bs a la tasa de la compra; tasa con su procedencia (`TasaProcedenciaChip` si existe; si no, texto).
- `organisms/CompraLineasLotes`: por línea, producto, `LoteChip` (enlace a `/inventario/lotes/[id]`), kg inicial → consumido (procesado / vendido / perdido) → stock, costo/kg pactado y USD, subtotal. Si el lote tiene procesados, lista compacta de hijos con su costo/kg y kg vendidos.
- Pagos (`ListaResumen`) y contrato activo (enlace "Ver PDF").
- `organisms/HistorialCorreccionesCompra`: fecha y hora, usuario, motivo, cambios de cabecera («Proveedor: A → B · Tasa 36,50 → 37,10 (manual)»), líneas («SALM-261005-1: kg 30,000 → 28,500 · 3.500,00 Bs/kg → 3.400,00»), total y pagado antes → después, propagación («3 lotes procesados y 12 líneas de 5 facturas recalculadas»), contrato afectado. `EmptyState compact` «Sin ediciones».
- `loading.tsx` (`PageLoader ficha`), `error.tsx`, `not-found.tsx`.

### `organisms/EditarCompraDialog` (`AppDialog md`, `fullScreen` en `xs`)

- Subtítulo «Compra del 07/10/2026 · Pesquera X». `useForm` con los valores vigentes.
- `FormSection` "Datos de la compra": proveedor (selector de 04, con `StatusChips`), fecha (DatePicker, máx. hoy; ayuda con la fecha máxima por salidas), condición, notas.
- `FormSection` "Moneda y tasa": moneda; interruptor "Cambiar tasa" que muestra `TasaSelector` (08) para la fecha elegida. Si la fecha cambió, la tasa es referencial y la del día nuevo difiere, `Alert info` «La tasa referencial del dd/mm es X. ¿Quieres cambiarla?» con botón que activa el interruptor (D5).
- `FormSection` "Líneas": por línea, producto y lote (solo lectura), "Kg" (`NumberField` 3 dec., ayuda «Mínimo 18,500 kg: ya consumidos») y "Costo/kg (Bs|USD)" (`NumberField` 2 dec.). Sin agregar ni quitar filas.
- **Vista previa en vivo** (`previsualizarEdicionCompra`, función pura): por línea, costo USD/kg antes → después y Δ kg; total, pagado, saldo o saldo a favor y estado antes → después; propagación: costo/kg de cada lote hijo antes → después y «Costo de lo vendido: $X → $Y (12 líneas en 5 facturas). Los precios y totales de las facturas no cambian».
- `Alert` según el caso: pagos registrados (y saldo a favor); contrato que queda desactualizado; cambio de condición (D2/D3); cambio de proveedor (pagos que lo siguen, árbol de lotes); lote cerrado o agotado que se reabre (D7); tasa cambiada en compra en USD (solo afecta Bs) o en Bs (cambia costos); ganancia cambiaria de pagos que no se recalcula.
- "Motivo *" (multilínea, 5–500). Primario "Guardar cambios" con `loading` y `useForm({ disabled })`; cierre protegido con `dirty`; confirmación con `useConfirm` si la tasa manual supera el umbral (08). Errores de la RPC en su campo (`proveedor_id`, `fecha`, `items.N.peso_kg`, `motivo`) o en el `Alert`.
- Al guardar: `notify.success('Compra del 07/10/2026 actualizada')`, cierra y `router.refresh()`.

### Cambios en pantallas existentes

| Pantalla | Cambio |
|---|---|
| `/compras` (`ComprasTable`) | Admin: `getRowHref` → `/compras/[id]`; `⋮` "Ver detalle" (`ReceiptLongOutlined`) y "Editar compra" (`EditOutlined`, → `/compras/[id]?editar=1`, deshabilitada si anulada). Saldo negativo se muestra como «a favor» |
| `/proveedores/[id]` ("Historial de compras" y saldo) | Lo mismo en el historial (admin). El saldo pendiente descuenta los saldos a favor y, si quedan, muestra «a favor» (tarea agregada en 03/04) |
| `LoteTimeline` (07) | Admin: la compra enlaza a `/compras/[id]`; evento "Corrección de compra" por cada `correccion_compra` (kg con signo; motivo solo admin) |
| `useContratoAcciones` / `contratoService` (06) | Origen de contado con contrato activo: "Ver contrato … (desactualizado)" |

## Arquitectura por capas (archivos)

| Capa | Archivo | Cambio |
|---|---|---|
| Migraciones | `supabase/migrations/20261019120000_edicion_compras_esquema.sql`, `…120100_edicion_compras_rpc.sql`, `…120200_edicion_compras_contratos.sql` | Ver `tasks.md` |
| Tipos | `src/types/domain.ts` | `TipoMovimiento` + `correccion_compra`; `CompraItem.costo_kg_pactado`; `DetalleCompra` (líneas con lote, consumo, procesamientos, ventas por lote, pagos, contrato, correcciones); `CorreccionCompra`, `CorreccionCompraItem`, `PropagacionCosto`; `ResultadoEdicionCompra`; `PrevisualizacionEdicionCompra` |
| Dominio puro | `src/lib/compras/edicion.ts` (`pagadoTrasEdicion`, `estadoCompra`, `previsualizarEdicionCompra`), `src/lib/services/costingService.ts` (+ `recalcularRepartoProceso(salidas, entrada, costoLote, reparto)` sobre `repartirCostoProceso`) | Sin imports de Supabase |
| Validación | `src/lib/compraEdicionValidation.ts` (`editarCompraSchema`: cabecera, `cambiar_tasa` + `camposTasa`, items, motivo) | Mensajes en `lib/validationMessages.ts` |
| Repositorio | `interfaces.ts` (`ICompraRepository.getDetalle(id)`, `editar(input)`), `compraRepository.ts` (+ `costo_kg_pactado` en `create`), `compraDetalleMapper.ts` | Solo RPC y mapeo |
| Servicios | `src/lib/services/edicionCompraService.ts` (`getDetalleCompra`, `editarCompra`), `compraService.ts` (envía `costo_kg_pactado`), `proveedorBalanceService.ts` (saldo a favor), `contratoService.ts` (contado con contrato activo) | Ver `tasks.md` |
| UI | `app/(protected)/compras/[id]/` (`page.tsx`, `compra-ficha.tsx`, `actions.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`); `organisms/CompraResumenCard`, `CompraLineasLotes`, `HistorialCorreccionesCompra`, `EditarCompraDialog`; cambios en `ComprasTable`, `compras-screen.tsx`, `proveedor-ficha.tsx`, `LoteTimeline`, `useContratoAcciones` | Ver "Pantallas" |

## Efecto en otros módulos

- **03-proveedores**: entradas a la ficha de compra y saldo a favor en la ficha.
- **04-inventario**: `compra_items.costo_kg_pactado`, `registrar_compra` lo guarda, tipo `correccion_compra`, `proveedorBalanceService` con saldo a favor, entradas en `ComprasTable`.
- **06-contratos**: `contratos_listado_view` lee también `compra_correcciones`; contado con contrato activo visible en el `⋮`. Trigger, PDF inmutable y "anular y generar otro" no cambian.
- **07-lotes**: `peso_inicial_kg`, `costo_usd_kg`, `moneda`, `tasa_snapshot`, `proveedor_id` y `fecha_ingreso` de un lote pueden cambiar después del alta, solo por `editar_compra`; `LoteTimeline` con el evento y el enlace. `resultadoLote` lee lotes, movimientos y `factura_item_lotes` vigentes: refleja la edición sin cambios. La anulación de compras sigue fuera de alcance (deuda de 04/07).
- **15-dashboard**: **sin cambios de RPC** (por D1: una compra de contado nunca queda con saldo). Reflejan la edición: valor del inventario y antigüedad de lotes (al momento); margen, spread y productos con salida en el período de la **fecha de cada factura**; merma y rendimiento por proveedor (costo y proveedor nuevos) en el período del **procesamiento**; pérdidas por motivo; CxP, aging de compras y flujo con el total y la fecha nuevos. Los saldos a favor con proveedores quedan fuera de CxP (`estado = 'abierta'`). `dashboard_resultado_cambiario` no cambia (pagos intactos).
- **16-procesamiento-multisalida**: el costo de un procesamiento ya registrado se recalcula con su snapshot y su método de reparto, solo por `editar_compra`; `costingService` suma `recalcularRepartoProceso`. La regla "el precio de catálogo no recalcula procesamientos pasados" sigue igual.
- **17-trazabilidad-y-correccion-facturas**: el costo de líneas ya vendidas cambia; margen y señal "Pérdida" de la ficha de factura se recalculan solos. Sin cambios de RPC. El historial de `factura_correcciones` conserva los costos de su momento.

## Fuera de alcance (MVP)

- Agregar o quitar líneas, o cambiar el producto de una línea (con lotes vendidos o procesados, cambiaría el árbol completo; se hace con otra compra o, cuando exista, anulación).
- Anular una compra (sigue siendo deuda de 04/07).
- Editar procesamientos, pagos a proveedores o su ganancia cambiaria.
- Cambiar el código de un lote.
- Recalcular precios, totales, IVA o tasa de facturas; reescribir el historial de `factura_correcciones`.
- Aplicar o reintegrar el saldo a favor con el proveedor.
- Deshacer una edición (se hace otra edición con su motivo).
- Vencimiento propio de compras o días de crédito en la compra (sigue la regla D2 de 15 y el contrato).
- Edición por el operador o flujo de aprobación.
- Editar lotes de origen `inicial` (no tienen compra).

## Variables de entorno nuevas

Ninguna.
