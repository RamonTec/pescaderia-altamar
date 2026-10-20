# Tareas — 19-edicion-compras

Ejecutar en orden. Cada tarea indica archivos y criterio de hecho.

Depende de: `03`, `04`, `06`, `07`, `08`, `15`, `16`, `17` y `18` (hechos). Toca el esquema de `04`/`07` (`compra_items`, `movimientos`, `registrar_compra`) y la vista de `06`, y recalcula datos de `16` y `17`. Está anotado como tarea agregada (2026-10-19) en `03-proveedores`, `04-inventario`, `06-contratos`, `07-lotes`, `15-dashboard`, `16-procesamiento-multisalida` y `17-trazabilidad-y-correccion-facturas`.

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`. Las migraciones aplicadas no se editan (en particular `20261007180300_lotes_rpc_inventario.sql`, `20261019000200_procesamiento_multisalida_rpc.sql`, `20261019100200_correccion_facturas_contratos.sql` y las de 18). Prefijo timestamp ≥ `20261019120000`, después de `20261019110100_iva_opcional_rpc.sql`.

**Decisiones**: todas cerradas por el usuario el 2026-10-19, incluidas D1–D8 (tabla "Decisiones cerradas" de `spec.md`). No hay pendientes antes de empezar.

## Fase A — Esquema y RPC

1. **`20261019120000_edicion_compras_esquema.sql`**:
   - `compra_items.costo_kg_pactado numeric(14,6)`: `add column`, relleno (`usd` → `costo_usd_kg`; `bs` → `round(costo_usd_kg × compras.tasa_snapshot, 2)`), `set not null` y check ≥ 0.
   - `compra_items_view`: `create or replace` con `costo_kg_pactado` al final (`null` si no `es_admin()`).
   - `movimientos_tipo_check` con `correccion_compra` (`drop` + `add`, conservando `correccion_venta`).
   - Tablas `compra_correcciones` y `compra_correccion_items` con columnas, checks e índices de `spec.md`; RLS `select` solo `es_admin()`, sin políticas de escritura, `revoke` de `anon` y de escritura de `authenticated`.
   - Hecho: como operador, las dos tablas devuelven 0 filas y un `insert` directo falla; `compra_items_view.costo_kg_pactado` es `null`; las compras en Bs existentes recuperan el costo tecleado.
2. **`20261019120100_edicion_compras_rpc.sql`**:
   - `registrar_compra`: `create or replace` con la misma firma y el mismo cuerpo de `20261007180300`, más `costo_kg_pactado` del item (si no llega, derivado como el relleno).
   - Funciones internas (sin `grant`): `compra_recalcular_procesamiento(p_procesamiento_id, p_costo_lote)` (reparto con `procesamiento_repartir_costo`, `reparto_costo` guardado, snapshot de precios, orden `proceso_items.id`; actualiza cabecera, líneas y lotes hijos) y `lote_reescribir_costo(p_lote_id)` (movimientos y `factura_item_lotes` del lote al costo del lote; devuelve los `factura_item_id` tocados).
   - `editar_compra(uuid, jsonb, jsonb, text) → jsonb`: pasos, errores y "Orden de recálculo" de `spec.md`, con pagado y estado por la tabla de "Pagos, condición y estado" (D1–D3), bloqueo de proveedor (D4), validación de fecha (D5) y reapertura de lote cerrado o agotado (D7).
   - `detalle_compra(uuid) → jsonb` (`stable`, `security definer`, `42501` si no es admin) con el contenido de "Lectura" en `spec.md`.
   - `revoke … from public, anon` y `grant execute … to authenticated` en las dos públicas.
   - Hecho: en un Postgres local con todas las migraciones (método del checklist de 16–18), los casos de las tareas 22–26 dan las cifras esperadas a nivel SQL.
3. **`20261019120200_edicion_compras_contratos.sql`**:
   - `create or replace view contratos_listado_view` con la definición de `20261019100200` y `ultima_correccion_at` = máximo de `factura_correcciones` (por `factura_id`) y `compra_correcciones` (por `compra_id`). Sigue `security_invoker`.
   - Hecho: un contrato de compra generado antes de una edición sale `desactualizado = true`; uno generado después, `false`; los de venta no cambian.
4. **`src/types/domain.ts`**: tipos de `spec.md` ("Arquitectura por capas"), sin `any`.
   - Hecho: `tsc` señala los consumidores de `TipoMovimiento` y `CompraItem` a adaptar.

## Fase B — Dominio puro y validación

5. **`src/lib/services/costingService.ts`**: `recalcularRepartoProceso(salidas, entrada, costoLote, reparto)` sobre `repartirCostoProceso`, con el orden y la regla de empate de la RPC.
6. **`src/lib/compras/edicion.ts`**: `pagadoTrasEdicion(condicionFinal, pagosRegistrados, total)`, `estadoCompra(total, pagado)` y `previsualizarEdicionCompra(detalle, valores)` (costos USD por línea con `costoUsdKg`, kg mínimos, total, pagado, saldo o saldo a favor, estado, costo de lotes hijos y costo de lo vendido antes → después, y la lista de avisos). Sin imports de Supabase.
7. **`src/lib/compraEdicionValidation.ts`**: `editarCompraSchema` (`compra_id`, cabecera, `cambiar_tasa` + `camposTasa` exigidos solo si `cambiar_tasa`, `items[]` con `compra_item_id`, `peso_kg` > 0 y `costo_kg` ≥ 0, `motivo` 5–500).
8. **`scripts/probar-edicion-compra.ts`** (`npx tsx`, `process.exit(1)` si falla). Casos:
   - costo pactado ↔ USD en las dos monedas y con cambio de tasa;
   - reparto recalculado del caso de 16 (lote de 10 kg de $5 → $6: filete, cabeza y piel con los snapshot $12/$2/$1) y paridad con `repartirCostoProceso`;
   - `pagadoTrasEdicion` en los cuatro cambios de condición (D1–D3) y saldo a favor;
   - kg mínimo por consumo;
   - costo de lo vendido antes → después con una línea repartida en dos lotes;
   - paridad TS ↔ SQL de `recalcularRepartoProceso` en 200 casos aleatorios.
   - Hecho: el script pasa.

## Fase C — Repositorios y servicios

9. **`interfaces.ts` + `compraRepository.ts` + `compraDetalleMapper.ts`**: `getDetalle(id)` y `editar(input)` solo llaman a las RPC y mapean; `create` envía `costo_kg_pactado`.
10. **`compraService.crearCompra`**: envía `costo_kg_pactado` = `costo_kg` capturado.
    - Hecho: una compra nueva en Bs guarda el costo tecleado y el mismo `costo_usd_kg` que antes.
11. **`edicionCompraService.ts`**:
    - `getDetalleCompra(id)`: `requireAdmin()` + repositorio.
    - `editarCompra(input)`: `requireAdmin()`, esquema, proveedor activo y no bloqueado si queda a crédito (mensaje claro antes de la RPC), tasa con `resolverTasaOperacion` para la fecha final **solo** si `cambiar_tasa`, repositorio, y mapeo de `hint` a campos (`proveedor_*` → `proveedor_id`, `fecha_*` → `fecha`, `peso_menor_consumido` → `items.N.peso_kg`, `motivo_requerido` → `motivo`; el resto, al `Alert`).
    - Hecho: con sesión de operador lanza el error de permisos antes de llamar a la RPC.
12. **`proveedorBalanceService.getSaldoPendiente`** (tarea agregada en 04): resta además `Σ (pagado − subtotal)` de las compras no anuladas con `pagado > subtotal`; exponer el saldo a favor para la ficha. Si hace falta, una lectura nueva en el repositorio, sin lógica.
13. **`contratoService.elegibilidad`** (tarea agregada en 06): un origen de contado **con** contrato activo entra al mapa con `puedeGenerar: false` y su `contratoActivo`.

## Fase D — UI

14. **`organisms/CompraResumenCard`, `CompraLineasLotes`, `HistorialCorreccionesCompra`** según `spec.md` ("Pantallas"). Números con `lib/format.ts` y cifras tabulares; reutilizar `ListaResumen`, `LoteChip`, `EstadoChip` y la `FilaPrevia` de 17 si encaja.
15. **`organisms/EditarCompraDialog`**: `AppDialog md`, secciones, `TasaSelector` tras "Cambiar tasa", aviso de tasa del día nuevo (D5), vista previa con `previsualizarEdicionCompra`, avisos, `useForm({ disabled })`, `Button loading`, `dirty`, confirmación por desviación de tasa, errores por campo.
16. **`app/(protected)/compras/[id]/`**: `page.tsx` server con `requireAdmin()` → `notFound()` (revisar la guía de `params` en `node_modules/next/dist/docs/`), `compra-ficha.tsx`, `actions.ts` (`safeParse` → servicio → `ActionState` + `revalidatePath` de `/compras`, `/compras/[id]`, `/proveedores/[id]`, `/inventario`, `/procesamiento`, `/contratos` y `/`), `loading.tsx`, `error.tsx`, `not-found.tsx`; `?editar=1` abre el diálogo (D8).
    - Hecho: como admin se ve una compra con un lote procesado, uno vendido sin procesar y una línea sin control de stock.
17. **Entradas**:
    - `ComprasTable` + `compras-screen.tsx`: `getRowHref`, `⋮` "Ver detalle" y "Editar compra" (admin), saldo «a favor» (tarea agregada en 04);
    - `proveedor-ficha.tsx`: lo mismo en "Historial de compras" y saldo a favor (tarea agregada en 03);
    - `LoteTimeline`: enlace a la compra y evento "Corrección de compra" (tarea agregada en 07);
    - `useContratoAcciones`: contado con contrato activo (tarea agregada en 06).
18. Registrar en "Componentes compartidos" de `specs/00-estandares-ui/spec.md` cualquier componente genérico nuevo (si no hay, anotarlo en el checklist).

## Fase E — Documentación y verificación (no saltarse)

19. **Documentación global** (hecha al planificar el 2026-10-19; revisar que siga vigente al cerrar):
    - `/SPEC.md` §2 (snapshot de tasa), §4.1, §4.2, §4.6 y §5 con nota del 2026-10-19;
    - `specs/README.md` (orden y cambio de alcance);
    - tareas agregadas en 03, 04, 06, 07, 15, 16 y 17.
20. Aplicar en el Postgres local las 3 migraciones sobre una base con datos sembrados **antes** (compras en USD y en Bs, procesadas, vendidas, con pérdidas, notas de crédito, correcciones de 17 y contratos) y comprobar que el relleno y la vista no fallan.
21. **Caso del cliente** (admin). Compra a crédito en Bs, tasa 36,50, salmón 10 kg a 182,50 Bs/kg ($5,00). Procesado entero: filete 6 kg, cabeza 1 kg, piel 0,5 kg (snapshot $12/$2/$1). Vendidos 2 kg de filete a $12. Abono de $20.
    - Costo 182,50 → 219,00 Bs/kg: costo $6,00; costo total del proceso $60,00 y hijos 9,664430 / 1,610738 / 0,805370 (verificar con el script); movimientos y `factura_item_lotes` de los 4 lotes al costo nuevo; `factura_items.costo_usd_kg` = 9,664430; total y saldo de la factura **iguales**; compra: total $60, pagado $20, saldo $40.
    - Tasa 36,50 → 43,80 (manual, con confirmación por desviación): costo vuelve a $5,00 y todo baja en cascada; la ganancia cambiaria del abono no cambia.
    - Kg 10 → 12: `correccion_compra` +2 kg, `peso_inicial` 12, stock del crudo +2. Kg 12 → 9,5 (consumido 10) → `peso_menor_consumido`.
    - El historial muestra las 3 ediciones con usuario, motivo, antes → después y propagación.
22. **Pagos y condición** (D1–D3): crédito con $60 pagados que baja a $50 → `pagada` y saldo a favor $10 (ficha de compra, `/compras`, ficha del proveedor). Contado que sube → sigue `pagada`. Crédito → contado con $20 pagados → `pagada`, pagado = total. Contado → crédito sin pagos → `abierta` con todo por pagar y aparece en CxP del dashboard.
23. **Proveedor y fecha** (D4, D5): cambio de proveedor → compra, lote y los 3 hijos con el nuevo; rendimiento por proveedor del dashboard lo refleja. A crédito con proveedor bloqueado → `proveedor_bloqueado`. Fecha nueva posterior al procesamiento → `fecha_posterior_a_salidas`; anterior → `fecha_ingreso` cambia, el código no, y la sugerencia PEPS se reordena. La tasa no cambia sola y el diálogo avisa.
24. **Contrato**: con contrato `firmado`, aviso previo; tras editar, "Desactualizado" en `/contratos` y en el `⋮`. Crédito → contado con contrato activo: el `⋮` de `/compras` muestra "Ver contrato … (desactualizado)".
25. **Bordes**: compra anulada (forzada en local) → `compra_anulada`; `sin_cambios`; motivo corto; líneas que no coinciden; lote cerrado o agotado que sube → `abierto` (D7); línea sin control de stock (solo compra y ledger sin lote); compra con dos líneas del mismo producto.
26. **Paridades**:
    - para cada lote tocado, todas sus filas de `movimientos` tienen `costo_usd_kg = lotes.costo_usd_kg` y `lote_stock ≥ 0`;
    - para cada procesamiento recalculado, `Σ proceso_items.costo_total_usd = procesamientos.costo_total_usd = round(peso_entrada × costo del lote, 6)`;
    - para cada `factura_items` afectado, `costo_usd_kg = round(Σ fil.peso × fil.costo / peso, 6)`, y ningún `precio_usd_kg`, `subtotal_usd`, `total_usd` ni `pagado_usd` de facturas cambió (comparación antes/después);
    - `lotes.peso_inicial_kg = compra_items.peso_kg` en los lotes de compra.
27. **Dashboard**: antes y después de la edición del caso 21, valor del inventario, margen del período de la venta, merma y rendimiento por proveedor reflejan el costo nuevo; `dashboard_resultado_cambiario` idéntico. Ninguna RPC `dashboard_*` cambió.
28. **Sesión de operador**: `/compras/[id]` da 404; sin `⋮` de edición; `editar_compra` y `detalle_compra` dan `42501` por PostgREST; las tablas de historial devuelven 0 filas; no hay `update` directo sobre `compras`, `compra_items` ni `lotes`.
29. **Concurrencia**: edición que baja kg y venta simultánea sobre el último stock del lote → una espera y la otra falla o recalcula sin dejar el lote negativo; edición y abono simultáneos → se serializan y el estado final cuadra; edición y procesamiento simultáneos del mismo lote → el procesamiento usa el costo final.
30. `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx tsx scripts/probar-edicion-compra.ts` y `npx tsx scripts/probar-procesamiento.ts`.
31. Aplicar las 3 migraciones en Supabase en orden. Revisión visual en claro/oscuro y en 375/768/1024/1440 px.
32. Recorrer `checklist.md`.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "NN-modulo necesita … — agregado el <fecha>")_
