# 17 — Trazabilidad y corrección de facturas

## Contexto

Pedido del cliente (2026-10-19): ver el detalle de las cuentas por cobrar con la **trazabilidad completa de cada venta**, para medir si hay errores en las facturas, y poder **corregir el monto de una factura en el momento**.

Lo que existe hoy:

- **Facturas** (`05-ventas`): `facturas`, `factura_items` (`peso_kg`, `precio_usd_kg`, `costo_usd_kg` snapshot), `pagos` y `notas_credito` / `nota_credito_items`. Los totales los calcula `invoiceService` (`subtotalItems`, `ivaSobre`) y la RPC `registrar_factura` los inserta. **No hay ficha de factura**: solo existe `IFacturaRepository.getById` → `FacturaDetalle`, que usa `NotaCreditoForm`. `facturas` y `factura_items` no tienen política de `update` (se retiró en `0016`), así que solo escriben las RPC `security definer`.
- **Lotes** (`07-lotes`): `factura_item_lotes` (de qué lotes salió cada línea, con `orden` y el costo del lote), un movimiento `venta` por asignación y el lock de la fila del lote. Las RPC están en `supabase/migrations/20261007180400_lotes_rpc_ventas.sql`. La devolución de una nota de crédito vuelve a los lotes en orden inverso (`nota_credito_item_lotes`) y reabre el lote.
- **Procesamiento** (`16-procesamiento-multisalida`): cabecera `procesamientos` con la entrada única y `proceso_items` con el costo asignado y el snapshot `precio_referencia_usd_kg`. Se lee por `procesamientos_view` / `proceso_items_view`.
- **Lotes `inicial`**: el script `scripts/importar-inventario-octubre.ts` crea lotes de apertura sin compra ni proveedor (movimiento `ajuste`).
- **Cartera** (`09-cuentas-por-cobrar`): `DocumentosCarteraTable` en `/cobros` y en la ficha de cliente, con `renderAcciones` y `getRowHref`. El saldo es `total − pagado − notas de crédito emitidas` (`lib/cartera/estado.ts`, `cartera_clientes_view`).
- **Contratos** (`06-contratos`): PDF inmutable, un contrato activo por factura. El trigger `contratos_validar` solo deja cambiar `estado` y `notas`.
- **Dashboard** (`15-dashboard`): `dashboard_lineas_venta` y `dashboard_facturas_saldo_view` leen los valores vigentes de `factura_items` y `facturas`. Todos los indicadores de cartera filtran `saldo_usd > 0.005`.

Depende de `05`, `06`, `07`, `09`, `15` y `16`, todos hechos.

**Por qué es un módulo propio**: reabre una decisión cerrada de `05-ventas/spec.md` §4.4 ("la factura original nunca se edita"). Además cruza ventas, lotes y ledger (07), contratos (06), cartera (09) y dashboard (15). Es el mismo precedente que `07-lotes` y `16`.

## Decisiones cerradas (2026-10-19, con el usuario)

| Tema | Decisión |
|---|---|
| Detalle | Desde una factura de la cartera, cada línea muestra su cadena: compra al proveedor → lote crudo → procesamiento → lote procesado → línea de factura, con margen por línea y por factura y una **señal de posible error**. |
| Corrección | **Se edita la factura, con historial.** El admin puede cambiar el **peso (kg)** y el **precio por kg** de una línea. Nunca el total ni el IVA directamente. Subtotal, IVA, total y saldo se recalculan. |
| Historial | Cada cambio guarda quién, cuándo, valor anterior, valor nuevo y **motivo obligatorio**. Lo ve **solo el admin**. El cliente y cualquier documento enviado o impreso ven solo los valores vigentes, sin rastro de la corrección. |
| Pagos y contratos | Se permite editar con pagos o con contrato, y se avisa. Total por debajo de lo pagado → **saldo a favor** del cliente (mismo tratamiento que las notas de crédito en `05`). Con contrato activo, el contrato queda **desactualizado** para regenerarlo. |
| Notas de crédito | El peso no puede bajar de lo ya devuelto por notas de crédito emitidas. |
| Anuladas | Las facturas anuladas no se editan. |
| Stock | Editar el peso **mueve stock** de los lotes de la línea (ver "Reglas de stock"). Si sube: primero los lotes de la línea, luego PEPS del mismo producto y, si no alcanza, error sin cambios parciales. |
| Señales | Tres por línea: **Pérdida** (precio < costo), **Por debajo** (precio < referencia) y **Cobro mayor** (precio > referencia). Tolerancia simétrica en `config_negocio`, por defecto 0 %. Sin precio de referencia → "sin referencia". |
| Precio de referencia | El snapshot del procesamiento (ponderado por kg) y, como respaldo, el del catálogo. |
| Ledger | Las filas `correccion_venta` son visibles al operador en `movimientos_view`, solo con kg (sin costo ni motivo). |
| Contado que sube | Queda `abierta` y vencida desde el mismo día. |
| Otros | El cliente bloqueado no impide corregir. El límite de crédito da solo un aviso con confirmación. No se actualiza `pedido_items.peso_entregado_kg`. |
| Permisos | **Solo admin**, tanto el detalle (muestra costos) como la edición: `es_admin()` dentro de RPC `security definer`, con lock como las ventas. El operador no ve nada de esto. |

Las filas de Stock a Otros las aprobó el usuario el 2026-10-19, después de la primera versión de esta spec.

Esto **reemplaza** "la factura original nunca se edita" de `05-ventas/spec.md` §4.4. La nota de crédito sigue siendo la vía para devoluciones. La corrección es para **errores de captura** (peso o precio mal anotados). La tasa (`tasa_snapshot` y su procedencia, `/SPEC.md` §2) **nunca** cambia con una corrección.

## Decisión de diseño

### Pantalla de detalle: ficha `/facturas/[id]` (solo admin)

`06-contratos` decidió "sin fichas nuevas" solo para generar contratos. Aquí el detalle necesita espacio para la cadena de N lotes por línea, los pagos, las notas de crédito y el historial, así que un diálogo no alcanza. Por eso se crea una ficha propia:

- `page.tsx` server con `requireAdmin()`. Para el operador, `notFound()`: así no revela que la factura existe.
- Entradas:
  - fila abrible (`getRowHref`, solo admin) y opción `⋮` "Ver detalle y trazabilidad" en `/cobros` y en la sección "Facturas y cobranza" de `/clientes/[id]`;
  - en `LoteTimeline` (07), el número de factura de una venta enlaza a la ficha si el usuario es admin.

### Lectura: una RPC de solo lectura

`trazabilidad_factura(p_factura_id uuid) → jsonb`, `security definer`, falla con `42501` si `not es_admin()`. Arma la cadena en una sola consulta transaccional: factura, líneas, lotes con su origen (compra, inicial o proceso + lote padre + compra del padre), notas de crédito, pagos, correcciones y contrato activo. Así se evitan N+1 sobre vistas y se sigue el precedente de `dashboard_*`. Los **márgenes y señales** no se calculan en SQL: los calculan funciones puras en TS (ver "Señales").

### Historial: tabla `factura_correcciones`

Una fila por corrección de una línea, con los valores anteriores y nuevos de la línea y de los totales. Los kg movidos por lote **no se duplican** en otra tabla: son los movimientos `correccion_venta` del ledger con `ref_id = factura_correcciones.id`.

### Escritura: RPC `corregir_linea_factura`

Corrige **una línea por llamada**, con su motivo. Es atómica y toma el lock de la factura y luego el de los lotes, en el mismo orden que `registrar_nota_credito`. Con eso se serializa contra pagos, notas de crédito, ventas y otras correcciones.

### Contrato desactualizado: derivado, sin escribir en `contratos`

Un contrato activo está **desactualizado** si existe una corrección de su factura con `created_at` posterior al `created_at` del contrato. Se expone como columna nueva de `contratos_listado_view` y en la elegibilidad de `contratoService`.

Por qué derivado y no una columna `contratos.desactualizado`:

- el trigger `contratos_validar` y la regla "PDF inmutable" de 06 no cambian;
- no hay estado que se pueda desincronizar;
- al anular y generar otro contrato, el nuevo nace "al día" solo, porque su `created_at` es posterior.

### Movimiento del ledger: tipo nuevo `correccion_venta`

Se descartan dos alternativas:

- **`ajuste`**: ya significa dos cosas distintas, la carga de lotes `inicial` del script de apertura y la devolución o reversión de notas de crédito (`ref_id` = nota).
- **Reescribir el movimiento `venta` original**: rompe el ledger auditable (`/SPEC.md` §5).

Un tipo propio deja leer en el ledger qué kg se movieron por corrección, con `ref_id` = corrección y `fecha` = momento de la corrección. Nada en el código ni en las RPC filtra movimientos por `tipo`, así que agregar uno no afecta stock ni reportes.

## Modelo de datos

### `factura_correcciones` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | `ref_id` de los movimientos `correccion_venta` |
| `factura_id` | uuid not null FK `facturas` | |
| `factura_item_id` | uuid not null FK `factura_items` | |
| `peso_anterior_kg`, `peso_nuevo_kg` | numeric(12,3) not null | nuevo > 0 |
| `precio_anterior_usd_kg`, `precio_nuevo_usd_kg` | numeric(14,6) not null | nuevo ≥ 0 |
| `costo_anterior_usd_kg`, `costo_nuevo_usd_kg` | numeric(14,6) not null | snapshot de costo de la línea antes y después (cambia si cambian los lotes) |
| `subtotal_anterior_usd`, `subtotal_nuevo_usd`, `iva_anterior_usd`, `iva_nuevo_usd`, `total_anterior_usd`, `total_nuevo_usd` | numeric(14,6) not null | totales de la factura antes y después |
| `pagado_usd` | numeric(14,6) not null | lo pagado al momento de corregir (para explicar un saldo a favor) |
| `estado_anterior`, `estado_nuevo` | text not null | `abierta` / `pagada` |
| `contrato_id` | uuid null FK `contratos` | contrato activo al corregir (queda desactualizado) |
| `motivo` | text not null | check `char_length(btrim(motivo)) between 5 and 500` |
| `usuario_id` | uuid not null default `auth.uid()` FK `perfiles` | |
| `created_at` | timestamptz not null default `now()` | |

Check `peso_nuevo_kg <> peso_anterior_kg or precio_nuevo_usd_kg <> precio_anterior_usd_kg`. Índices `(factura_id, created_at desc)` y `(factura_item_id)`.

RLS: `enable row level security`, `select` solo `using (public.es_admin())`, sin políticas de `insert`/`update`/`delete` (solo escribe la RPC), `revoke all … from anon`. **Nada se borra**: el historial es permanente.

### Cambios a tablas existentes

| Tabla | Cambio | Módulo dueño |
|---|---|---|
| `movimientos` | `movimientos_tipo_check` suma `correccion_venta` (`drop constraint` + `add constraint`, como en `20261007180100_lotes.sql`) | 04 / 07 |
| `config_negocio` | `+ tolerancia_precio_ref_pct numeric(5,2) not null default 0` (check 0–100). Es una sola tolerancia simétrica para "Por debajo" y "Cobro mayor". Se edita en Catálogos › Configuración | 04 (`ConfigNegocioForm`, 12) |
| `facturas`, `factura_items`, `factura_item_lotes` | Sin columnas nuevas. Los modifica **solo** `corregir_linea_factura` | 05 / 07 |
| `contratos_listado_view` | `create or replace` agregando al final `desactualizado boolean` y `ultima_correccion_at timestamptz` | 06 |

## Reglas de negocio

### Corrección de una línea (`corregir_linea_factura`)

Firma: `corregir_linea_factura(p_factura_item_id uuid, p_peso_kg numeric, p_precio_usd_kg numeric, p_motivo text) → jsonb`.

Devuelve, sin costos:

```
{ correccion_id, subtotal_usd, iva_usd, total_usd, pagado_usd, saldo_usd,
  saldo_a_favor_usd, estado, contrato: { id, numero, estado } | null,
  lotes: [{ lote_id, codigo, peso_kg }] }   -- peso_kg con signo: + vuelve al lote, − sale
```

Pasos:

1. `es_admin()`, o `42501`.
2. Lock de la factura (`for update`). Si está `anulada` → `factura_anulada`.
3. Redondea `peso` a 3 decimales y `precio` a 6, y valida `peso > 0`, `precio ≥ 0` y el motivo. Si nada cambia → `sin_cambios`.
4. `kg_devueltos` = Σ `nota_credito_items.peso_kg` de notas `emitida` sobre la línea. Si `peso_nuevo < kg_devueltos` → `peso_menor_devuelto`.
5. `delta = peso_nuevo − peso_anterior`. Si `delta ≠ 0`, mueve stock según "Reglas de stock".
6. `costo_usd_kg` de la línea = `round(Σ fil.peso × fil.costo / peso_nuevo, 6)`. Es 0 si la línea no tiene lotes (sin control de stock), igual que `registrar_factura`.
7. Actualiza `factura_items` (peso, precio y costo).
8. Recalcula los totales con el `iva_pct` **de la factura** (snapshot, no el de `config_negocio`) y el mismo redondeo que `subtotalItems` / `ivaSobre`:
   - `subtotal = round(Σ peso × precio, 6)`;
   - `iva = round(subtotal × iva_pct / 100, 6)`;
   - `total = round(subtotal + iva, 6)`.
9. `estado = 'pagada'` si `total − pagado ≤ 0.000001`; si no, `'abierta'`. Es la misma regla que `registrar_pago`, así que una factura `pagada` cuyo total sube vuelve a `abierta`.
10. Inserta `factura_correcciones` (con el `contrato_id` activo, si lo hay) y los movimientos con `ref_id` = su id.

Errores (`errcode P0001`, `hint`):

| `hint` | Cuándo |
|---|---|
| `factura_anulada` | La factura está anulada |
| `sin_cambios` | Peso y precio iguales a los vigentes |
| `peso_menor_devuelto` | Peso nuevo < kg devueltos por notas de crédito emitidas |
| `stock_insuficiente` | Sube el peso y no alcanza el stock de los lotes (ver la regla) |
| `linea_sin_lotes` | Cambia el peso de un producto con control de stock cuya línea no tiene `factura_item_lotes` (dato legado). Solo se puede corregir el precio |
| `motivo_requerido` | Motivo vacío o con menos de 5 caracteres |

`revoke … from public, anon` y `grant execute … to authenticated`.

### Reglas de stock

- **Baja el peso** (`delta < 0`): los kg vuelven a los lotes de la línea en **orden inverso** de `factura_item_lotes.orden`, igual que una nota de crédito.
  - Por lote, como máximo `fil.peso_kg − Σ nota_credito_item_lotes.peso_kg` de notas `emitida` sobre ese lote y esa línea. Así no se devuelve dos veces lo que ya volvió por una nota. Siempre alcanza, por el paso 4.
  - Se descuenta de `fil.peso_kg`. Si una fila queda en 0, se borra (check `peso_kg > 0`).
  - Movimiento `correccion_venta` positivo al costo del lote.
  - El lote vuelve a `abierto` si estaba `agotado` o `cerrado`: un lote cerrado no puede tener stock. Es el mismo precedente que `registrar_nota_credito`.
- **Sube el peso** (`delta > 0`), regla aprobada el 2026-10-19:
  1. Primero, de los **lotes que ya tiene la línea**, en su `orden`, si están `abierto` y con stock.
  2. Lo que falte, por **PEPS** entre los demás lotes `abierto` del producto (`fecha_ingreso`, `codigo`), como `registrar_factura`.
  3. Si aun así no alcanza → `stock_insuficiente` y no se guarda nada.
  - Se suma a la fila de `factura_item_lotes` existente o se inserta una nueva con `orden = max + 1` y el costo del lote. Movimiento `correccion_venta` negativo y `lote_sincronizar_estado`.
  - Todos los lotes candidatos se bloquean en **una sola** sentencia ordenada por `fecha_ingreso, codigo`, como en `registrar_factura`, para evitar interbloqueos con ventas.
- **Producto sin control de stock** (sin lotes): un movimiento `correccion_venta` sin lote por `−delta` a costo 0, espejo del movimiento `venta` sin lote de `registrar_factura`.
- Cambiar **solo el precio** no mueve stock ni cambia el costo.

### Pagos, saldo a favor y ganancia cambiaria

- `pagado_usd` y los `pagos` **no se tocan**: son dinero recibido.
- Si `total_nuevo < pagado`, el saldo `total − pagado − créditos` queda negativo: es el **saldo a favor** del cliente. La factura queda `pagada`. Igual que con una nota de crédito sobre una factura pagada (`05` §4.4), **se muestra pero no se aplica sola** a otra venta.
- **Hallazgo a corregir** (tarea agregada en 05): `clienteBalanceService.getSaldoPendiente` solo suma facturas `abierta`, así que un saldo a favor por corrección (factura `pagada` con `pagado > total`) no se vería. Debe restar también `Σ (pagado − total)` de las facturas no anuladas con `pagado > total`.
- **Ganancia cambiaria** (`/SPEC.md` §4.5): `(tasa_pago − tasa_factura) × USD_pagados`. La corrección no cambia `tasa_snapshot` ni el `monto_usd` de ningún pago, así que la `ganancia_cambiaria_bs` de los pagos registrados **sigue siendo correcta y no se recalcula**. La porción que queda como saldo a favor conserva su ganancia, porque los Bs se recibieron a esa tasa. Cuando exista la aplicación o el reintegro de saldos a favor (fuera de alcance), se tratará allí.
- **Contado**: la regla es la misma. Si el total sube, la factura pasa a `abierta` con la diferencia como saldo. Como su `fecha_vencimiento = fecha`, aparece como **vencida** en la cartera y se puede recordar. El diálogo lo avisa.
- **Límite de crédito**: si una factura a crédito sube y el saldo del cliente más el aumento supera `limite_credito_usd`, aparece el aviso blando con confirmación de `05` §4.1 (`LimiteCreditoExcedido`). El bloqueo del cliente **no** impide corregir: no es una venta nueva.

### Notas de crédito ya emitidas

- El peso no baja de lo devuelto (paso 4).
- Las notas emitidas **no cambian** con una corrección de línea: conservan su peso, su precio y su total (son documentos emitidos). Si se corrige el precio de una línea con devoluciones, el diálogo avisa que la nota sigue al precio con que se emitió.
- Anular después una nota sigue funcionando: `anular_nota_credito` revierte por `nota_credito_item_lotes`, que la corrección no toca.
- Una nota nueva usa los valores vigentes de la línea (`disponible = peso vigente − devuelto`).

### Contrato activo

- Si la factura tiene contrato activo (`generado`, `enviado` o `firmado`), el diálogo muestra antes de guardar: «El contrato N.º 0007 (firmado) quedará desactualizado: anúlalo y genera otro desde el menú ⋮».
- Después de la corrección, la regla de "Decisión de diseño" lo marca como desactualizado en:
  - `/contratos`: chip "Desactualizado" junto a "Documento anulado";
  - el menú `⋮` de `useContratoAcciones`: "Ver contrato N.º 0007 (desactualizado)";
  - la ficha de la factura.
- No se anula solo: anular sigue siendo decisión del admin (06, regla 4).

### Lo que ve el cliente

Las facturas no se imprimen hoy. El PDF de contrato (06) y los recordatorios (09) toman los valores vigentes de `facturas` y `factura_items` y **no** leen `factura_correcciones`. Cualquier documento futuro para el cliente debe seguir la misma regla, y queda anotado en el checklist. El número, la fecha y la tasa de la factura no cambian.

### Trazabilidad por línea

Cada línea muestra un eslabón por lote asignado (`factura_item_lotes`), según el origen del lote:

| Origen del lote vendido | Cadena |
|---|---|
| `proceso` (procesado) | **Compra** del lote padre (proveedor, fecha, costo/kg de entrada en USD y en la moneda pactada, tasa) → **Procesamiento** (fecha, lote crudo, entrada, Σ salidas, merma kg y %, rendimiento, reparto `valor`/`peso`, **costo/kg de esta salida**, precio de referencia snapshot) → **Venta** (lote, kg, precio/kg) |
| `compra` (crudo vendido sin procesar) | **Compra** → "Vendido sin procesar" → **Venta** |
| `inicial` (apertura) | "Inventario inicial" (fecha, costo/kg, tasa; sin proveedor) → [procesamiento si es padre] → **Venta** |
| Sin lote (producto sin control de stock) | Solo la línea, con la etiqueta "Sin control de stock: sin costo de inventario" |

Merma y rendimiento son siempre **del proceso completo**, tomados de la cabecera de `procesamientos` (regla de 16). Si un procesamiento legado no tiene cabecera, se usa `Σ proceso_items`.

Debajo de las líneas se muestran:

- **Notas de crédito aplicadas**: número, fecha, motivo, kg y monto por línea, y si volvió a inventario.
- **Pagos**: fecha, monto USD, moneda, tasa, método y ganancia cambiaria.

### Margen

Montos en USD y sin IVA, con la misma regla que `dashboard_lineas_venta` (15):

- Línea: `venta = peso × precio`, `costo = peso × costo_usd_kg`, `margen = venta − costo` y `margen % = margen / venta` (`null` si la venta es 0).
- Factura (neta de notas de crédito emitidas): `Σ margen de líneas − Σ (nci.peso × nci.precio − nci.peso × fi.costo_usd_kg)`.

### Señales de posible error (funciones puras; aprobadas el 2026-10-19)

Son tres señales por línea. `t = config_negocio.tolerancia_precio_ref_pct / 100` (default 0: marca cualquier diferencia).

| Señal | Etiqueta | Nivel | Regla (por línea) |
|---|---|---|---|
| `perdida` | Pérdida | error | `costo_usd_kg > 0` y `precio < costo` |
| `por_debajo` | Por debajo | aviso | Hay referencia y `precio < ref × (1 − t)` |
| `cobro_mayor` | Cobro mayor | aviso | Hay referencia y `precio > ref × (1 + t)` |

- **Comparación al centavo**: precio, costo y `ref × (1 ± t)` se redondean a 2 decimales antes de comparar. Así, con tolerancia 0, la media ponderada de la referencia (p. ej. 11,999999) no marca diferencias que no existen.
- **Una sola tolerancia simétrica**: no se ve razón para separarlas. El usuario pidió marcar cualquier diferencia en los dos sentidos, y con 0 % ambas reglas son exactas.
- **Indicadores** (no son señales, chip neutro):
  - **"Sin referencia"**: la línea no tiene precio de referencia, así que "Por debajo" y "Cobro mayor" no aplican.
  - **"Sin costo"**: el producto no tiene control de stock o el costo es 0, así que "Pérdida" no aplica.
- **Precio de referencia** de una línea: la media de los `proceso_items.precio_referencia_usd_kg` (snapshot de 16) de sus lotes, ponderada por kg. Si ningún lote tiene snapshot (lote de compra, inicial o legado), se usa `productos.precio_referencia_usd_kg` del catálogo. Si tampoco hay, queda "sin referencia". Si solo una parte de los lotes tiene snapshot, se ponderan solo esos.
- **Nivel de la factura**: el peor de sus líneas, con el conteo por señal ("1 pérdida · 2 cobro mayor").
- Las señales son **informativas**: no bloquean nada.

## Pantallas

### `/facturas/[id]` — ficha de factura (solo admin)

- `FichaHeader`:
  - título "Factura F-000123";
  - `meta`: cliente (enlace a su ficha), fecha, condición, vencimiento, `EstadoCarteraChip`, chip "Corregida · 2" si tiene correcciones y chip "Contrato desactualizado" si aplica;
  - `backHref` `/cobros`.
- **Resumen** (`organisms/FacturaTotalesCard`):
  - subtotal, IVA (`iva_pct`), total, abonado, notas de crédito, saldo o **saldo a favor** (en verde, con el texto "a favor del cliente"), en USD y en Bs a la tasa de la factura;
  - margen neto USD y %, con el nivel y el conteo de señales de la factura.
- **Líneas** (`organisms/FacturaTrazabilidadLineas`): una tarjeta por línea con producto, kg, precio/kg, subtotal, costo/kg, margen, chips de señal y kg devueltos (si hay).
  - Se expande con `Collapse` y muestra la cadena de cada lote con `molecules/CadenaTrazabilidad`: eslabones con ícono, título, cifras y enlace al lote o a la compra. En `md+` va horizontal y en `xs` vertical.
  - Acción "Corregir" (`EditOutlined`), deshabilitada con tooltip si la factura está anulada.
- **Notas de crédito** y **Pagos**: listas compactas (`ListaResumen` de 15, o `AppDataGrid` embebida si hay más de 5).
- **Historial de correcciones** (`organisms/HistorialCorreccionesFactura`): fecha y hora, usuario, línea, "kg 2,000 → 1,500 · USD/kg 12,00 → 10,00", total antes → después, motivo, lotes movidos (código y kg con signo) y contrato afectado. `EmptyState compact`: «Sin correcciones».
- `loading.tsx` (`PageLoader ficha`), `error.tsx` (`ErrorState`), `not-found.tsx`.

### `organisms/CorregirLineaFacturaDialog` (`AppDialog sm`, `fullScreen` en `xs`)

- Subtítulo: «Filete de salmón · Factura F-000123».
- Campos:
  - "Peso (kg)" (`NumberField` 3 decimales; ayuda «Mínimo 2,000 kg: ya devueltos por notas de crédito» si aplica);
  - "Precio (USD/kg)" (`NumberField` 2–6 decimales);
  - "Motivo *" (multilínea, 5–500).
- **Vista previa en vivo** con la función pura de totales: subtotal, IVA y total antes → después, saldo nuevo o saldo a favor, y la variación de kg con su efecto («Vuelven 0,500 kg al lote FIL-261019-1» / «Se descuentan 1,000 kg: primero de los lotes de la línea y, si no alcanza, del más antiguo»).
- `Alert` según el caso:
  - abonos registrados (y saldo a favor si aplica);
  - contrato activo que quedará desactualizado;
  - notas de crédito ya emitidas (no cambian su precio);
  - factura de contado que pasa a tener saldo;
  - stock disponible menor al aumento (aviso previo; la validación real es de la RPC).
- Primario "Guardar corrección" con `loading` y `useForm({ disabled })`. Cierre protegido con `dirty`. Si se excede el límite de crédito, se confirma con `useConfirm`. Los errores de la RPC se marcan en su campo (`peso_kg`, `precio_usd_kg`, `motivo`) o en el `Alert` del diálogo.
- Al guardar: `notify.success('Factura F-000123 corregida')` y `router.refresh()`.

### Cambios en pantallas existentes

| Pantalla | Cambio |
|---|---|
| `/cobros` (`cobros-screen.tsx`) | Admin: `getRowHref` → `/facturas/[id]` y `⋮` "Ver detalle y trazabilidad" (`ReceiptLongOutlined`) |
| `/clientes/[id]` (sección "Facturas y cobranza") | Lo mismo, solo admin |
| `LoteTimeline` (07) | Admin: el número de factura de una venta enlaza a `/facturas/[id]` |
| `/contratos` (`ContratosTable`) y `useContratoAcciones` | Chip / etiqueta "Desactualizado" (06) |
| Catálogos › Configuración (`ConfigNegocioForm`) | `FormSection` "Señales de facturas": "Tolerancia frente al precio de referencia (%)", con la ayuda «0 % marca cualquier diferencia» |

## Arquitectura por capas (archivos)

| Capa | Archivo | Cambio |
|---|---|---|
| Migraciones | `supabase/migrations/20261019100000_correccion_facturas_esquema.sql`, `…100100_…_rpc.sql`, `…100200_…_contratos.sql` | Ver `tasks.md` |
| Tipos | `src/types/domain.ts` | `TipoMovimiento` + `correccion_venta`; `CorreccionFactura`; `TrazabilidadFactura`, `LineaTrazabilidad`, `EslabonLoteVendido` (unión por origen); `SenalFactura` (`perdida` \| `por_debajo` \| `cobro_mayor`), `NivelSenal`; `ResultadoCorreccion`; `ConfigNegocio.tolerancia_precio_ref_pct` |
| Dominio puro | `src/lib/facturas/totales.ts` (`subtotalItems` e `ivaSobre` se **mueven** aquí desde `invoiceService`, que los importa), `src/lib/facturas/margen.ts`, `src/lib/facturas/senales.ts`, `src/lib/facturas/correccion.ts` (`previsualizarCorreccion`) | Sin imports de Supabase; usables en componentes cliente |
| Validación | `src/lib/correccionFacturaValidation.ts` | `corregirLineaSchema` |
| Repositorio | `interfaces.ts` (`IFacturaRepository` + `getTrazabilidad(id)`, `corregirLinea(input)`), `facturaRepository.ts` | Solo RPC |
| Servicios | `src/lib/services/trazabilidadFacturaService.ts`, `src/lib/services/correccionFacturaService.ts`, `clienteBalanceService.ts` (saldo a favor), `contratoService.ts` (elegibilidad con `desactualizado`) | Ver `tasks.md` |
| UI | `app/(protected)/facturas/[id]/` (`page.tsx`, `factura-ficha.tsx`, `actions.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`); `atoms/SenalFacturaChip`, `molecules/CadenaTrazabilidad`, `organisms/FacturaTotalesCard`, `organisms/FacturaTrazabilidadLineas`, `organisms/CorregirLineaFacturaDialog`, `organisms/HistorialCorreccionesFactura` | Ver "Pantallas" |

## Efecto en otros módulos

- **05-ventas**: se reabre la decisión del §4.4 (nota "Antes: …"); `subtotalItems` / `ivaSobre` pasan a `lib/facturas/totales.ts`; `getSaldoPendiente` incluye el saldo a favor por corrección.
- **06-contratos**: `contratos_listado_view` + `desactualizado`; chip en `/contratos` y en el menú `⋮`. El trigger y la regla del PDF inmutable no cambian.
- **07-lotes**: tipo de movimiento `correccion_venta`; `factura_item_lotes` puede cambiar después de la venta, solo por la RPC; enlace de `LoteTimeline` a la ficha. `resultadoLote` lee `factura_item_lotes`, así que refleja los kg corregidos sin cambios.
- **09-cuentas-por-cobrar**: `getRowHref` y la acción en `/cobros` y en la ficha. `lib/cartera` y `DocumentoCartera` **no cambian**: el saldo negativo ya da `pagada`.
- **15-dashboard**: **sin cambios de RPC**. Las cifras de ventas, margen y cartera reflejan la factura corregida **en el período de la fecha de la factura**, no en el de la corrección: corregir un error de captura cambia la historia de ese período. Los saldos a favor quedan fuera de los indicadores de cartera por el filtro `saldo_usd > 0.005`, como pasa con las notas de crédito.

## Fuera de alcance (MVP)

- Editar otra cosa que peso y precio de una línea: total, IVA, cliente, fecha, tasa, condición, días de crédito, producto, ni agregar o quitar líneas (eso sigue siendo nota de crédito o factura nueva).
- Elegir a mano los lotes al subir el peso (se usa la regla automática aprobada).
- Deshacer una corrección: se hace otra corrección con su motivo.
- Aplicar o reintegrar el saldo a favor automáticamente (igual que en 05).
- Recalcular la ganancia cambiaria de pagos ya registrados.
- Actualizar `pedido_items.peso_entregado_kg` del pedido de origen: el pedido conserva lo pesado al entregar.
- Indicador de señales en el listado de `/cobros` o un reporte agregado de "facturas con posible error" (candidato a siguiente paso; hoy la señal está en la ficha).
- Corrección por el operador o flujo de aprobación.
- Impresión o PDF de la factura.

## Variables de entorno nuevas

Ninguna.
