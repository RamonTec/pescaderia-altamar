# 18 — IVA opcional

## Contexto

Pedido del cliente (2026-10-19): **el IVA no aplica a todas las ventas ni a todos los clientes**.

Lo que existe hoy:

- **Regla global** (`/SPEC.md` §2 y §4.4): toda factura lleva IVA desglosado al `config_negocio.iva_pct` (default 16 %). No hay forma de vender sin IVA.
- **Emisión** (`05-ventas`): `invoiceService.crearFactura` lee `config_negocio.iva_pct`, calcula los totales con `subtotalItems` / `ivaSobre` (`src/lib/facturas/totales.ts`, movidos allí por 17) y envía `iva_pct`, `subtotal_usd`, `iva_usd` y `total_usd` a la RPC `registrar_factura` (última versión en `supabase/migrations/20261007180400_lotes_rpc_ventas.sql`). **La RPC no recalcula ni valida esos importes**: inserta lo que recibe. La venta directa (`PedidoForm`, entrega inmediata) y la entrega de un pedido (`EntregaPedidoDialog` → `pedidoService.entregarPedido`) pasan por la misma `crearFactura`. `pedidos` no guarda IVA.
- **Pantallas de venta**: `PedidoForm` muestra "Total USD" = `Σ peso × precio`, **sin IVA**, y el aviso «Quedará una cuenta por cobrar de …» usa esa cifra, aunque la factura nace con IVA. `EntregaPedidoDialog` muestra un «total estimado» con el mismo cálculo. (Hallazgo que este módulo corrige de paso: ver "Pantallas".)
- **Notas de crédito** (`05` §4.4): `notaCreditoService` calcula su IVA con el `iva_pct` de la factura leído **antes** de llamar a `registrar_nota_credito`, que inserta los importes sin recalcularlos. La RPC toma el lock de la factura, pero el IVA ya viene calculado.
- **Corrección de facturas** (`17-trazabilidad-y-correccion-facturas`, implementado, migraciones `20261019100000`–`20261019100200` aplicadas): `corregir_linea_factura` recalcula con el `iva_pct` **de la factura**. `factura_correcciones` tiene `factura_item_id not null`, las columnas de línea `not null` y el check `factura_correcciones_cambio_real`. `trazabilidad_factura` arma el historial con un `join` (interno) a `factura_items`. El contrato desactualizado se deriva de `factura_correcciones.created_at` (`contratos_listado_view`, ficha de factura).
- **Dónde se muestra el IVA**: ficha `/facturas/[id]` (`FacturaTotalesCard`, `CorregirLineaFacturaDialog`), PDF de contrato de venta (`src/lib/contratos/plantillas/bloques.tsx`, `Totales`: «IVA (x %)»). No hay factura impresa ni PDF de factura. `/cobros`, `RegistrarPagoDialog` y los recordatorios (`lib/cartera/recordatorios/plantillas.ts`) muestran solo total o saldo, sin IVA desglosado.
- **Dashboard** (`15-dashboard`): ninguna RPC `dashboard_*` lee `iva_usd` ni `iva_pct`. Las ventas y el margen son **sin IVA** (`Σ peso × precio`). La cartera usa `total_usd`, así que refleja cualquier cambio de total.
- **Clientes** (`02-clientes`): `clientes` sin dato fiscal de IVA. RLS `using (true)` para `authenticated`: cualquier usuario edita clientes.

Depende de `02`, `05`, `06`, `09`, `15` y `17`, todos hechos.

**Por qué es un módulo propio**: modifica una regla cerrada de `/SPEC.md` §2 ("IVA desglosado configurable, default 16 %", aplicado a toda venta) y la decisión de `17` de que la corrección cambia "solo el peso y el precio/kg de una línea". Además cruza clientes (02), ventas y notas de crédito (05), contratos (06), cartera (09) e historial de correcciones (17).

## Decisiones cerradas (2026-10-19, con el usuario)

| Tema | Decisión |
|---|---|
| Dónde se decide | **Por cliente, editable en la venta.** Campo nuevo `clientes.aplica_iva` ("Aplica IVA"), por defecto sí; los clientes existentes quedan en sí. Se edita en el formulario de cliente. Al emitir una venta (POS y entrega de pedido), el interruptor de IVA viene precargado con el valor del cliente y se puede cambiar **solo para esa factura**. |
| Qué % | **Sí o no, sin otro %.** Sí = `config_negocio.iva_pct` vigente (16 %). No = 0 %. No se elige otro porcentaje. Las facturas existentes conservan su % actual. |
| Efecto en el total | **El total baja.** El precio/kg es neto: quitar el IVA elimina el IVA del total ($100 + IVA = $116 pasa a $100). |
| Corrección de emitidas | El admin puede **activar o quitar el IVA** de una factura emitida, con motivo obligatorio. Queda en `factura_correcciones`. Se recalculan IVA, total y saldo. Mismas reglas que 17: saldo a favor si ya está pagada, contrato marcado como desactualizado, facturas anuladas no se tocan, no se recalcula la ganancia cambiaria de pagos previos, solo admin y RPC atómica `security definer` con `es_admin()`. Al activarlo se usa el % de configuración **vigente**. |
| Representación | Una factura sin IVA es `facturas.iva_pct = 0`, **sin booleano nuevo** en `facturas` (ver "Decisión de diseño"). |
| Notas de crédito emitidas | Al cambiar el IVA de la factura, **se recalculan el IVA y el total** de sus notas `emitida` al % nuevo; subtotal, ítems y kg no cambian. Las anuladas no se tocan. |
| Historial | `factura_correcciones` suma la columna `tipo linea\|iva`, con un check por tipo; no se crea otra tabla. |
| Validación en la base | Triggers `before insert` `facturas_validar_iva` y `notas_credito_iva_factura`. |
| Quién usa el interruptor | **Cualquiera que venda** (operador incluido). "Aplica IVA" del cliente lo edita quien edita clientes (misma RLS de hoy). |
| Pedidos | Los pedidos **no guardan el IVA**: se decide al facturar (venta inmediata o entrega), precargado con el cliente en ese momento. |
| Sin re-tasar | Aplicar IVA a una factura que ya lo tiene → `sin_cambios` (no se re-tasa al % vigente). Activar con el IVA de configuración en 0 % → `iva_config_cero`. |

Las filas de Representación a Sin re-tasar las aprobó el usuario el 2026-10-19, después de la primera versión de esta spec.

Esto **reemplaza** "IVA desglosado configurable (default 16 %)" de `/SPEC.md` §2 (aplicado a toda venta) y amplía la corrección de `17` más allá de "solo peso y precio/kg de una línea". La tasa (`/SPEC.md` §2) sigue sin cambiar nunca con una corrección.

## Decisión de diseño

### Representación en `facturas`: basta con `iva_pct = 0` (sin booleano nuevo)

Una factura **sin IVA** es una factura con `iva_pct = 0` (y por tanto `iva_usd = 0` y `total_usd = subtotal_usd`). No se agrega `facturas.aplica_iva`.

Por qué:

- **Con la decisión "sí/no, sin otro %"**, `iva_pct` ya codifica todo: `iva_pct > 0` ⇔ lleva IVA. Un booleano solo repetiría ese dato y abriría la puerta a filas incoherentes (`aplica_iva = true` con `iva_pct = 0`, o al revés), que habría que impedir con un check.
- **Nada cambia aguas abajo**: `corregir_linea_factura` (17) ya recalcula con el `iva_pct` de la factura, `notaCreditoService` también, y el PDF de contrato, la ficha y el dashboard leen `iva_pct` / `iva_usd` / `total_usd`. Con 0 % todos dan el resultado correcto sin tocarlos.
- **`registrar_factura` no cambia de firma** ni hay que reescribirla: ya recibe `iva_pct` en el payload.
- **La única ambigüedad** sería un `config_negocio.iva_pct = 0` global: una venta "con IVA" nacería también con 0 %. Para el negocio es lo mismo (no se cobra IVA), así que no hace falta distinguirlo. Para mostrarla, la regla es una sola: `iva_pct = 0` → «Sin IVA».
- **Reactivar** el IVA de una emitida no necesita recordar el % original: la decisión dice que se usa el de configuración vigente.

Las facturas existentes no se tocan: conservan su `iva_pct` (16) y sus importes.

### Validación en la base al emitir (hallazgo)

Hoy `registrar_factura` inserta `iva_pct`, `iva_usd` y `total_usd` tal como llegan, y la puede llamar cualquier `authenticated` por PostgREST. Con el IVA opcional, el 0 % pasa a ser legítimo, pero un % arbitrario (p. ej. 5) no. Se agrega un trigger `before insert` en `facturas`, `facturas_validar_iva`, que exige:

- `iva_pct = 0` **o** `iva_pct = config_negocio.iva_pct`;
- `iva_usd = round(subtotal_usd × iva_pct / 100, 6)` y `total_usd = round(subtotal_usd + iva_usd, 6)` (tolerancia 0,000001).

Si no se cumple, `P0001` con `hint = 'iva_invalido'`. Es un trigger de insert: no afecta a `corregir_linea_factura` ni a la RPC nueva, que hacen `update`. Así no se reescribe `registrar_factura`, que ya tocaron 07, 08 y 09.

### Notas de crédito: su IVA sigue al de la factura

- **Al emitir**: un trigger `before insert` en `notas_credito`, `notas_credito_iva_factura`, recalcula `iva_usd = round(subtotal_usd × facturas.iva_pct / 100, 6)` y `total_usd = round(subtotal_usd + iva_usd, 6)` con el `iva_pct` vigente de la factura. Como `registrar_nota_credito` ya tomó el lock de la factura antes del `insert`, el trigger lee el valor confirmado. Esto cierra la carrera entre "emitir nota" y "cambiar IVA" sin reescribir `registrar_nota_credito`. `notaCreditoService` sigue calculando igual (lo que envía coincide, salvo en la carrera).
- **Notas ya emitidas al cambiar el IVA de la factura**: la RPC de cambio de IVA **recalcula `iva_usd` y `total_usd` de las notas `emitida` de esa factura** con el % nuevo. El `subtotal_usd`, los ítems, los kg y el precio no cambian. Los totales de créditos antes y después quedan en la fila de `factura_correcciones`.
  - Por qué: si la factura queda sin IVA y una nota sigue acreditando su IVA, el cliente recibe un crédito por un impuesto que ya no se le cobra, y el saldo `total − pagado − créditos` queda mal. Bloquear el cambio cuando hay notas obligaría a anularlas, y anular una nota falla si su stock ya se volvió a vender (`anular_nota_credito`).
  - Esto **amplía** la regla de 17 "las notas emitidas no cambian": sigue valiendo para la corrección de una línea (peso y precio), pero el IVA de la nota sigue siempre al de su factura.
  - Las notas `anulada` no se tocan.

### Historial: una fila de `factura_correcciones` a nivel factura

Se reutiliza `factura_correcciones` (no se crea otra tabla), con una columna `tipo`:

- `tipo = 'linea'`: la corrección de 17, sin cambios. Es el default, así que `corregir_linea_factura` no se toca.
- `tipo = 'iva'`: corrección a nivel factura. `factura_item_id` y las columnas de peso, precio y costo de línea van en `null`. Se llenan `iva_pct_anterior` / `iva_pct_nuevo`, los totales anteriores y nuevos (con `subtotal` igual en los dos), `pagado_usd`, los estados, `contrato_id`, `motivo` y los créditos de notas antes y después.

Por qué la misma tabla:

- el **contrato desactualizado** (`contratos_listado_view`, `trazabilidad_factura`) ya se deriva de `max(factura_correcciones.created_at)` por factura: un cambio de IVA lo marca **sin tocar la vista ni `contratoService`**;
- el chip "Corregida · N" y el historial de la ficha cuentan y listan todo en un solo orden cronológico;
- RLS, permanencia (sin `update`/`delete`) y escritura solo por RPC ya están resueltos.

El check `factura_correcciones_cambio_real` se reemplaza por uno por `tipo` (ver "Modelo de datos").

### Escritura: RPC `cambiar_iva_factura`

Una RPC nueva, separada de `corregir_linea_factura`: no mueve stock ni toca líneas, así que no toma locks de lotes. Toma el lock de la factura y después el de sus notas de crédito (`anular_nota_credito` bloquea la fila de la nota). Así se serializa con abonos, notas, correcciones de línea y otros cambios de IVA.

## Modelo de datos

### `clientes` (02)

| Columna | Tipo | Nota |
|---|---|---|
| `aplica_iva` | boolean not null default `true` | "Aplica IVA". Los clientes existentes quedan en `true` por el default. Precarga el interruptor de la venta. Editable por quien edita clientes (misma RLS que el resto de la tabla). |

### `factura_correcciones` (17)

| Cambio | Detalle |
|---|---|
| `+ tipo` | text not null default `'linea'`, check `tipo in ('linea', 'iva')` |
| `factura_item_id` | `drop not null` |
| `peso_anterior_kg`, `peso_nuevo_kg`, `precio_anterior_usd_kg`, `precio_nuevo_usd_kg`, `costo_anterior_usd_kg`, `costo_nuevo_usd_kg` | `drop not null`. Los checks de columna existentes (`peso_nuevo_kg > 0`, `precio_nuevo_usd_kg >= 0`) siguen valiendo: con `null` pasan |
| `+ iva_pct_anterior`, `+ iva_pct_nuevo` | numeric(5,2) null. Solo en `tipo = 'iva'` |
| `+ creditos_anterior_usd`, `+ creditos_nuevo_usd` | numeric(14,6) null. Σ `total_usd` de las notas `emitida` antes y después. Solo en `tipo = 'iva'` |
| `factura_correcciones_cambio_real` | `drop constraint` y se reemplaza por `factura_correcciones_forma` (abajo) |

`factura_correcciones_forma`:

```
(tipo = 'linea'
   and factura_item_id is not null
   and peso_anterior_kg is not null and peso_nuevo_kg is not null
   and precio_anterior_usd_kg is not null and precio_nuevo_usd_kg is not null
   and costo_anterior_usd_kg is not null and costo_nuevo_usd_kg is not null
   and (peso_nuevo_kg <> peso_anterior_kg or precio_nuevo_usd_kg <> precio_anterior_usd_kg))
or
(tipo = 'iva'
   and factura_item_id is null
   and peso_anterior_kg is null and peso_nuevo_kg is null
   and precio_anterior_usd_kg is null and precio_nuevo_usd_kg is null
   and costo_anterior_usd_kg is null and costo_nuevo_usd_kg is null
   and iva_pct_anterior is not null and iva_pct_nuevo is not null
   and (iva_pct_anterior = 0) <> (iva_pct_nuevo = 0)
   and creditos_anterior_usd is not null and creditos_nuevo_usd is not null
   and subtotal_nuevo_usd = subtotal_anterior_usd)
```

Las filas existentes cumplen la rama `linea` (17 ya exigía todo eso). RLS, índices y `revoke` no cambian.

### `facturas` y `notas_credito` (05)

Sin columnas nuevas. Triggers `before insert` nuevos: `facturas_validar_iva` y `notas_credito_iva_factura` (ver "Decisión de diseño"). Las modifica **solo** `cambiar_iva_factura` (además de las RPC existentes).

## Reglas de negocio

### Emisión (POS y entrega de pedido)

- `CrearFacturaInput` suma `aplica_iva?: boolean`. Si no viene, se toma `cliente.aplica_iva`.
- `iva_pct = aplica_iva ? config_negocio.iva_pct : 0`. Los totales, con `totalesDe` de `lib/facturas/totales.ts`, como hoy.
- El límite de crédito (`verificarLimiteCredito`) se compara con el **total con o sin IVA según el interruptor**.
- `pedidos` no guarda el IVA: el interruptor aparece al **facturar** (venta inmediata o entrega). Al entregar, viene precargado con el `aplica_iva` actual del cliente del pedido.
- Las facturas existentes no cambian.

### Cambio de IVA de una factura emitida (`cambiar_iva_factura`)

Firma: `cambiar_iva_factura(p_factura_id uuid, p_aplica_iva boolean, p_motivo text) → jsonb`.

Devuelve, sin costos:

```
{ correccion_id, iva_pct, subtotal_usd, iva_usd, total_usd, pagado_usd,
  creditos_usd, saldo_usd, saldo_a_favor_usd, estado,
  contrato: { id, numero, estado } | null }
```

Pasos:

1. `es_admin()`, o `42501`.
2. Lock de la factura (`for update`). Si no existe → `P0002`. Si está `anulada` → `factura_anulada`.
3. Valida el motivo (`btrim`, 5–500) → `motivo_requerido`.
4. `iva_pct_nuevo = p_aplica_iva ? config_negocio.iva_pct : 0`.
   - Si `(factura.iva_pct > 0) = p_aplica_iva` → `sin_cambios` (ya tiene o ya no tiene IVA). Activar el IVA de una factura que ya lo tiene **no** la re-tasa al % vigente.
   - Si `p_aplica_iva` y `config_negocio.iva_pct = 0` → `iva_config_cero`.
5. Lock de las notas de crédito `emitida` de la factura (`for update`, orden por `id`).
6. Totales con el **mismo redondeo** que `subtotalItems` / `ivaSobre`: `subtotal` = el vigente (no cambia), `iva = round(subtotal × iva_pct_nuevo / 100, 6)`, `total = round(subtotal + iva, 6)`.
7. Notas `emitida`: `iva_usd = round(subtotal_usd × iva_pct_nuevo / 100, 6)` y `total_usd = round(subtotal_usd + iva_usd, 6)`. `creditos_anterior` / `creditos_nuevo` = Σ `total_usd` antes y después.
8. `estado = 'pagada'` si `total − pagado ≤ 0.000001`; si no, `'abierta'` (misma regla que `registrar_pago` y `corregir_linea_factura`).
9. `update facturas set iva_pct, iva_usd, total_usd, estado`.
10. Inserta `factura_correcciones` con `tipo = 'iva'` y el `contrato_id` activo, si lo hay.

Errores (`errcode P0001`, `hint`):

| `hint` | Cuándo |
|---|---|
| `factura_anulada` | La factura está anulada |
| `sin_cambios` | Se pide activar y ya tiene IVA, o quitar y ya no lo tiene |
| `iva_config_cero` | Se pide activar y el IVA configurado es 0 % |
| `motivo_requerido` | Motivo vacío, de menos de 5 o de más de 500 caracteres |

`revoke … from public, anon` y `grant execute … to authenticated`.

### Pagos, saldo a favor, contado y límite (iguales a 17)

- `pagado_usd`, los `pagos` y su `ganancia_cambiaria_bs` **no se tocan ni se recalculan**: la tasa de la factura y los montos pagados no cambian (`17`, "Pagos, saldo a favor y ganancia cambiaria").
- Quitar el IVA de una factura pagada deja **saldo a favor** (`total − pagado − créditos < 0`): se muestra, no se aplica solo. Ejemplo: $100 + IVA 16 % = $116 pagados → sin IVA, total $100 y saldo a favor $16.
- Activar el IVA de una factura de **contado** pagada la deja `abierta` y vencida (vence el mismo día), con la diferencia como saldo. El diálogo lo avisa.
- Activar el IVA de una factura a **crédito**: si el saldo del cliente más el aumento supera `limite_credito_usd`, aviso blando con confirmación (`LimiteCreditoExcedido`), como en 17. El bloqueo del cliente no impide el cambio.
- El dashboard (15) refleja el total nuevo en la cartera del período de la **fecha de la factura**. Las ventas y el margen no cambian, porque son sin IVA.

### Correcciones de línea después de un cambio de IVA

`corregir_linea_factura` no cambia: recalcula con el `iva_pct` vigente de la factura, así que una factura sin IVA sigue sin IVA al corregir peso o precio.

### Contrato activo

Igual que en 17: aviso previo en el diálogo y, después, marca **"Desactualizado"** derivada (la fila nueva de `factura_correcciones` tiene `created_at` posterior al contrato). No se anula solo. El PDF regenerado muestra los valores vigentes: con `iva_pct = 0`, la fila de IVA dice «IVA: no aplica» (ver "Pantallas").

### Lo que ve el cliente

Como en 17: el PDF de contrato y los recordatorios usan los valores vigentes y **no** leen `factura_correcciones`. Una factura sin IVA se rotula **«Sin IVA»** en todo documento o pantalla (nunca «IVA (0 %)»).

## Pantallas

### Clientes (02)

- `ClienteFormFields` (sección de condiciones comerciales, junto a límite y días de crédito): `Switch` "Aplica IVA", encendido por defecto, con la ayuda «Se precarga en cada venta; se puede cambiar en la factura».
- Ficha `/clientes/[id]`: en el `meta` del `FichaHeader`, chip `soft` "Sin IVA" cuando `aplica_iva = false`. El listado no cambia.

### Venta directa (`PedidoForm`, entrega inmediata) y entrega de pedido (`EntregaPedidoDialog`)

- `molecules/IvaVentaSwitch`: `Switch` "Factura con IVA (16 %)" (el % de configuración), precargado con `cliente.aplica_iva`. Si el valor difiere del habitual del cliente, ayuda «Este cliente normalmente {sí/no} lleva IVA». Al cambiar de cliente se vuelve a precargar. En `PedidoForm` solo se muestra con "entrega inmediata".
- `molecules/TotalesVenta`: subtotal, IVA (`IVA (16 %)` o «Sin IVA») y total, con `totalesDe` y `lib/format.ts`. **Corrige el hallazgo**: el total mostrado, la equivalencia en Bs y el aviso «Quedará una cuenta por cobrar de …» pasan a usar el **total con IVA** (hoy usan el subtotal). En `EntregaPedidoDialog`, con los pesos reales capturados.
- `pedidoFormSchema` y `entregaPedidoSchema` suman `aplica_iva: boolean`.

### Ficha `/facturas/[id]` (17, solo admin)

- `FacturaTotalesCard`: la fila de IVA dice «Sin IVA» si `iva_pct = 0`. Acción secundaria (botón de texto en la tarjeta) «Quitar IVA» o «Aplicar IVA (16 %)», deshabilitada con tooltip si la factura está anulada.
- `organisms/CambiarIvaFacturaDialog` (`AppDialog sm`, `fullScreen` en `xs`):
  - subtítulo «Factura F-000123 · Cliente»;
  - **vista previa** con la función pura `previsualizarCambioIva`: IVA y total antes → después, créditos de notas antes → después (si hay), saldo nuevo o saldo a favor;
  - `Alert` según el caso: abonos registrados (y saldo a favor si aplica); contrato activo que quedará desactualizado; notas de crédito emitidas cuyo IVA se recalcula; contado que pasa a tener saldo; al activar, si el % vigente difiere del que tenía la factura antes de quitarlo (último `iva_pct_anterior` del historial), «Se aplicará el 16 % vigente»;
  - "Motivo *" (multilínea, 5–500);
  - primario «Quitar IVA» / «Aplicar IVA» con `loading` y `useForm({ disabled })`, cierre protegido con `dirty`, confirmación del límite con `useConfirm`, error del motivo en su campo y el resto en el `Alert`;
  - al guardar: `notify.success('IVA de la factura F-000123 actualizado')` y `router.refresh()`.
- `HistorialCorreccionesFactura`: una fila `tipo = 'iva'` se lee «IVA 16 % → Sin IVA» (o «Sin IVA → IVA 16 %»), con total antes → después, créditos de notas antes → después si cambiaron, motivo, usuario, fecha y contrato afectado. Sin línea ni lotes movidos.
- El chip "Corregida · N" cuenta las dos clases de corrección.

### Otros

| Pantalla | Cambio |
|---|---|
| PDF de contrato de venta (`bloques.tsx`, `Totales`) | Con `iva_pct = 0`: fila «IVA» con valor «No aplica». Con IVA, igual que hoy |
| `NotaCreditoForm` | Debajo de «Subtotal a devolver», IVA (`IVA (x %)` o «Sin IVA», el de la factura) y total a acreditar, con `totalesDe` |
| Catálogos › Configuración (`ConfigNegocioForm`) | El campo pasa a «IVA (%) *», con la ayuda «Se aplica a las ventas con IVA. Las ventas sin IVA van al 0 %» |
| `/cobros`, `RegistrarPagoDialog`, recordatorios | Sin cambios: muestran total o saldo, que ya reflejan el IVA vigente |

## Arquitectura por capas (archivos)

| Capa | Archivo | Cambio |
|---|---|---|
| Migraciones | `supabase/migrations/20261019110000_iva_opcional_esquema.sql`, `…110100_iva_opcional_rpc.sql` | Ver `tasks.md` |
| Tipos | `src/types/domain.ts` | `Cliente.aplica_iva`; `CorreccionFactura` pasa a unión discriminada por `tipo` (`CorreccionLinea` \| `CorreccionIva`); `ResultadoCambioIva` |
| Dominio puro | `src/lib/facturas/iva.ts` (`ivaPctVenta(aplica, configPct)`, `facturaConIva(f)`, `etiquetaIva(pct)`), `src/lib/facturas/correccion.ts` (+ `previsualizarCambioIva`) | Sin imports de Supabase |
| Validación | `clienteValidation.ts` (`aplica_iva`), `pedidoValidation.ts` (`aplica_iva` en venta y entrega), `correccionFacturaValidation.ts` (+ `cambiarIvaSchema`) | Mensajes en `lib/validationMessages.ts` |
| Repositorio | `interfaces.ts` (`IFacturaRepository.cambiarIva(input)`), `facturaRepository.ts`, `trazabilidadFacturaMapper.ts` (correcciones por `tipo`) | Solo RPC y mapeo |
| Servicios | `invoiceService.ts` (`aplica_iva`), `pedidoService.ts` (pasa `aplica_iva`), `clienteService.ts` (`aplica_iva`), `correccionFacturaService.ts` (+ `cambiarIvaFactura`) | Ver `tasks.md` |
| UI | `molecules/IvaVentaSwitch`, `molecules/TotalesVenta`, `organisms/CambiarIvaFacturaDialog`; cambios en `ClienteFormFields`, `ClienteForm`, `cliente-ficha.tsx`, `PedidoForm`, `EntregaPedidoDialog`, `NotaCreditoForm`, `FacturaTotalesCard`, `HistorialCorreccionesFactura`, `factura-ficha.tsx`, `facturas/[id]/actions.ts`, `ConfigNegocioForm`, `lib/contratos/plantillas/bloques.tsx` | Ver "Pantallas" |

## Efecto en otros módulos

- **02-clientes**: columna `aplica_iva` en el formulario y chip en la ficha.
- **05-ventas**: `invoiceService` y las pantallas de venta con el interruptor y los totales con IVA; triggers de validación de IVA en `facturas` y de IVA de la nota en `notas_credito`. Cambia la regla de cálculo del §4.2 (nota "Antes: …").
- **06-contratos**: la fila de IVA del PDF dice «No aplica» cuando `iva_pct = 0`. Un cambio de IVA marca el contrato como desactualizado **sin cambios en la vista ni en `contratoService`**.
- **09-cuentas-por-cobrar**: sin cambios de código. Quitar el IVA puede dejar saldo a favor (da `pagada`, como en 17); activarlo en contado deja la factura vencida y recordable.
- **15-dashboard**: **sin cambios de RPC**. Ventas y margen son sin IVA; la cartera usa el total vigente.
- **17-trazabilidad-y-correccion-facturas**: `factura_correcciones` suma `tipo` y las columnas de IVA, con el check por tipo; `trazabilidad_factura` se recrea (`left join` a la línea y campos nuevos); `CorreccionFactura` pasa a unión; el historial y el servicio de corrección se amplían. `corregir_linea_factura` no cambia.

## Fuera de alcance (MVP)

- Elegir otro % de IVA por factura o por cliente (solo sí/no).
- Guardar la decisión de IVA en el pedido agendado (se decide al facturar).
- Re-tasar al % vigente una factura que ya tiene IVA.
- Cambio masivo del IVA de varias facturas o de todas las de un cliente al cambiar `clientes.aplica_iva` (el campo solo precarga ventas nuevas).
- Motivo fiscal de exención, retenciones de IVA o cualquier tratamiento SENIAT (`/SPEC.md` §9).
- Recalcular la ganancia cambiaria de pagos previos; aplicar o reintegrar el saldo a favor (igual que 17).
- Restringir al admin el interruptor de IVA en la venta (decisión cerrada: lo usa quien vende).
- Indicador o filtro "Sin IVA" en el listado de `/cobros` o en el dashboard.
- Impresión o PDF de la factura (si se agrega, debe rotular «Sin IVA»).

## Variables de entorno nuevas

Ninguna.
