# Tareas — 16-procesamiento-multisalida

Ejecutar en orden. Cada tarea indica archivos y criterio de hecho.

Depende de: `07-lotes` y `15-dashboard` (hechos). Cambia el esquema de `04-inventario` (`productos`, `procesamientos`, `proceso_items`) y reemplaza la RPC `registrar_procesamiento` de `07-lotes`. Ambos módulos lo tienen anotado como tarea agregada (2026-10-19).

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`. Las migraciones aplicadas no se editan, en particular `20261007180300_lotes_rpc_inventario.sql` y `20261008000300_dashboard_inventario.sql`. Prefijo timestamp ≥ `20261019000000`, después de `20261014000000_fix_proveedores_guard_bloqueo_insert.sql`.

**Antes de empezar**: confirmar con el usuario las decisiones pendientes de `spec.md`. Confirmadas el 2026-10-19 (al invocar `/sdd-implement`): caso de prueba con piel de **0,5 kg**, una salida = 100 % sin precio, precio del catálogo en solo lectura (si falta, se pide y se guarda solo si estaba vacío), todo en 0 → reparto por kg, máx. 10 salidas de productos distintos, re-etiquetado de B7 y cierre de la lectura directa del costo por el operador.

## Fase A — Esquema

1. **`20261019000000_procesamiento_multisalida_esquema.sql`**:
   - `productos.precio_referencia_usd_kg numeric(14,6)` con check `>= 0` y check `tipo = 'procesado' or precio_referencia_usd_kg is null`.
   - `procesamientos`: suma `lote_origen_id` (FK `lotes`), `peso_entrada_kg numeric(12,3)` (> 0), `costo_total_usd numeric(14,6)` (≥ 0) y `reparto_costo text` con check (`valor`, `peso`), más un índice `(lote_origen_id)`.
   - `proceso_items.precio_referencia_usd_kg numeric(14,6)` (≥ 0) e índice único `(procesamiento_id, producto_destino_id)`.
   - **Relleno**: los procesamientos cuyas líneas comparten un solo `lote_origen_id` reciben cabecera = ese lote, `Σ peso_entrada_kg` y `Σ costo_total_usd`, con `reparto_costo = 'peso'`.
   - Check `procesamientos_cabecera_completa` (las cuatro columnas `not null`) creado `not valid`. Se ejecuta `validate constraint` si quedan 0 filas sin cabecera; si no, se deja `not valid` con un comentario que cuente las filas legadas.
   - Hecho:
     - La consulta `select count(*) from procesamientos where lote_origen_id is null` da 0 (o el número anotado en el checklist).
     - Para cada procesamiento, `Σ proceso_items.peso_entrada_kg = procesamientos.peso_entrada_kg` y lo mismo para el costo.
2. **`20261019000100_procesamiento_multisalida_vistas.sql`**:
   - `procesamientos_view` y `proceso_items_view` con `costo_total_usd` en `null` si `not es_admin()`, siguiendo el patrón de `lotes_view` en `20261007180200_lotes_vistas.sql`.
   - `revoke select` de `procesamientos` y `proceso_items` para `authenticated` y `anon`, y `grant select` de las vistas.
   - `drop policy "write_all"` de insert en las dos tablas.
   - Hecho:
     - Como operador, `select * from proceso_items` da `permission denied` y la vista devuelve el costo en `null`.
     - Como admin, la vista devuelve el costo.
     - `lotes_view` y las RPC `dashboard_*` siguen funcionando: son `security definer`.
3. **`20261019000200_procesamiento_multisalida_rpc.sql`**:
   - `drop function registrar_procesamiento(jsonb, jsonb)` + `create` con la firma y los pasos de `spec.md` ("RPC `registrar_procesamiento`"):
     - lock del lote;
     - validaciones de origen y por salida;
     - `Σ salidas ≤ entrada`;
     - precios (catálogo primero; si viene en el payload y el catálogo está vacío, `update productos … where precio_referencia_usd_kg is null`);
     - reparto por valor con caso borde por peso, con el residuo a la salida de mayor peso de reparto;
     - entrada prorrateada por kg (floor + mayor resto);
     - una cabecera, N líneas, un `proceso_out`, N lotes hijos + `proceso_in`.
   - Hints `salidas_exceden_entrada`, `salida_duplicada` y `precio_requerido`, con `detail = 'salida:N'`.
   - `revoke … from public, anon` y `grant execute … to authenticated`.
   - Hecho: en un Postgres local con todas las migraciones, el caso del lote de 10 kg a $5 de `spec.md` (piel de 0,5 kg) deja:
     - cabecera de 10 kg y $50;
     - lotes hijos con los costos/kg de la tabla de `spec.md`;
     - lote crudo en 0 y `agotado`;
     - `Σ costo_total_usd` de las líneas = 50,000000.
     Además, un caso con todos los precios en 0 da `reparto_costo = 'peso'` y el mismo costo/kg en todas las salidas.
4. **`src/types/domain.ts`**:
   - `Producto.precio_referencia_usd_kg: number | null`.
   - `RepartoCosto = 'valor' | 'peso'`.
   - `Procesamiento` suma `lote_origen_id`, `peso_entrada_kg`, `costo_total_usd: number | null` y `reparto_costo`.
   - `ProcesoItem` suma `precio_referencia_usd_kg: number | null`, y `costo_total_usd` pasa a `number | null`.
   - `ProcesoLote` se agrupa por procesamiento (`peso_entrada_kg` de la cabecera, `salidas: SalidaProcesoLote[]` con `proceso_item_id`, `producto_nombre`, `peso_salida_kg`, `lote_destino_id`, `lote_destino_codigo`).
   - Sin `any`.
   - Hecho: `tsc` señala todos los consumidores a adaptar; se resuelven en las tareas siguientes.

## Fase B — Dominio puro y validación

5. **`src/lib/services/costingService.ts`**:
   - `repartirCostoProceso({ pesoEntradaKg, costoLoteUsdKg, salidas: { kg, precio: number | null }[] })` devuelve `{ costo_total_usd, salida_total_kg, merma_kg, merma_pct, rendimiento, reparto: RepartoCosto, salidas: { costo_usd, costo_usd_kg, participacion_costo, participacion_kg }[] }`.
   - `prorratearEntrada(pesoEntradaKg, kgSalidas)` devuelve `number[]` (milésimas, floor + mayor resto).
   - Ambas usan el mismo redondeo que la RPC. Se retira `costoDestino` y se actualiza el comentario del servicio (reparto por valor, 2026-10-19).
   - Hecho: sin imports de Supabase en las funciones puras, que se pueden usar en componentes cliente.
6. **`scripts/probar-procesamiento.ts`** (`npx tsx`, falla con `process.exit(1)`). Casos:
   - el del lote de 10 kg a $5 (piel de 0,5 kg);
   - una sola salida sin precio, que equivale a la transferencia total ($50 / kg);
   - todos los precios en 0, que reparte por peso;
   - una salida con precio 0 junto a otras con precio, que deja costo 0;
   - `Σ costo = costo_total` exacto en 50 repartos aleatorios;
   - `prorratearEntrada` con `Σ = entrada` y `e_i ≥ kg_i`, incluido el caso sin merma (`Σ salidas = entrada`).
   - Hecho: el script pasa.
7. **`src/lib/procesamientoValidation.ts`**:
   - `procesamientoFormSchema` con `fecha`, `producto_origen_id`, `lote_origen_id`, `peso_entrada_kg`, `salidas: [{ producto_destino_id, peso_salida_kg, precio_referencia_usd_kg: number ≥ 0 | null }]` (mín. 1, máx. 10) y `notas`.
   - `superRefine`: producto duplicado (en `salidas.N.producto_destino_id`) y `Σ salidas > entrada` (en `salidas`).
   - Helper puro `validarPreciosSalidas(salidas, procesados)`: con ≥ 2 salidas, exige precio en las que no lo tienen en el catálogo y devuelve los errores por índice.
   - Hecho: el script de la tarea 6 cubre también el esquema (duplicado, exceso y precio faltante).
8. **`src/lib/productoValidation.ts`**: `precio_referencia_usd_kg: number ≥ 0 | null`, que se fuerza a `null` si `tipo = 'crudo'`.

## Fase C — Repositorios y servicios

9. **`interfaces.ts` + `procesamientoRepository.ts`**:
   - `ProcesamientoNuevo` (cabecera sin costo) y `SalidaProcesoNueva`.
   - `create(procesamiento, salidas)` llama a la RPC nueva.
   - `list()` lee `procesamientos_view` con `proceso_items_view` embebida. Si PostgREST no infiere la relación entre vistas, se hacen dos consultas y se unen en el repositorio (sin lógica de negocio).
   - Hecho: el listado del operador trae `costo_total_usd = null` desde la base, no porque la página lo quite.
10. **`loteRepository.getMovimientosArbol`**: lee `proceso_items_view` + `procesamientos_view` y arma `ProcesoLote` agrupado por procesamiento con sus salidas y lotes hijos.
11. **`catalogRepositories.ts`** (productos): lee y escribe `precio_referencia_usd_kg`.
12. **`procesamientoService.ts`**:
    - Valida el origen y el lote como hoy, y por salida: procesado activo del crudo, sin duplicados, `Σ ≤ entrada` y precios con `validarPreciosSalidas`.
    - Redondea los kg y llama al repositorio.
    - Mapea los hints de la RPC a `fieldErrors` (`salidas.N.peso_salida_kg`, `salidas.N.precio_referencia_usd_kg`, `salidas.N.producto_destino_id`).
    - Hecho: un error de la base en la salida 2 marca esa fila del formulario.
13. **`src/lib/lotes.ts` (`resultadoLote`)**: merma y rendimiento desde la entrada de la cabecera y `Σ` salidas de cada `ProcesoLote`.
    - Hecho: el resultado del árbol del caso de prueba coincide con el cálculo a mano.

## Fase D — UI

14. **`ProcesamientoForm.tsx`** (+ `procesamiento/actions.ts` con el payload nuevo): entrada única + `useFieldArray` de salidas, precio de referencia condicional, resumen en vivo y bloque de costos solo admin. Todo según `spec.md` ("Pantallas"), con `repartirCostoProceso` y `AppDialog` `md`.
    - Usa `useForm({ disabled: isPending })` y `Button loading`, y confirma el descarte si hay cambios (`00-estandares-ui`).
    - Hecho: como operador no aparece ninguna cifra de costo; como admin, el caso de prueba muestra 8,05 / 1,34 / 0,67 USD/kg antes de guardar.
15. **`ProcesamientosTable.tsx` + `procesamiento/page.tsx`**:
    - `ProcesoFila` por procesamiento con `salidas[]`.
    - Lista compacta de salidas con `LoteChip` y `getRowHeight` automático.
    - Costo total y costo/kg por salida solo admin.
    - Búsqueda por producto y código de cualquier salida; columnas ocultas en `xs`.
    - `EmptyState` con un texto que ya no diga "le transfiere todo su costo".
16. **`LoteTimeline.tsx`**: un evento por procesamiento con enlaces a los N lotes hijos. En la ficha del hijo, el texto de costo dice "repartido por valor de venta" (solo admin).
17. **`ProductoForm.tsx` + `ProductosTable.tsx` + `catalogos/actions.ts`**: campo y columna "Precio de referencia (USD/kg)" solo para procesados (`NumberField`, `formatUsd`).
18. **`RendimientoProveedorTable.tsx` + `MermaProcesosPanel.tsx`** (15-dashboard): re-etiquetar "Costo kg limpio" → "Costo medio kg obtenido" con ayuda, y ajustar el texto de ayuda de la merma (merma del proceso completo). Sin cambios de RPC.

## Fase E — Documentación y verificación (no saltarse)

19. **Documentación global** (hecha al planificar, 2026-10-19; revisar que siga vigente al cerrar): `/SPEC.md` §4.3, §5, §6 y §7 con la nota "(Antes: …; reemplazado el 2026-10-19.)", `specs/README.md` (orden y cambio de alcance), y las notas de `07-lotes/spec.md`, `04-inventario/tasks.md`, `07-lotes/tasks.md` y `15-dashboard/tasks.md`.
20. `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npx tsx scripts/probar-procesamiento.ts`.
21. Aplicar las 3 migraciones en Supabase (en orden) y comprobar que los procesamientos existentes conservan su cabecera rellenada y que `/procesamiento`, la trazabilidad y el dashboard muestran las mismas cifras que antes para ellos.
22. **Caso del cliente** (admin): lote de 10 kg a $5 → filete 6 kg, cabeza 1 kg y piel 0,5 kg.
    - Tres lotes hijos con sus códigos, el costo/kg esperado y `lote_padre_id` = lote crudo.
    - Lote crudo en 0 y `agotado`.
    - Ledger con un `proceso_out` de −10 kg y tres `proceso_in`.
23. Precio faltante: con un procesado sin precio en el catálogo y 2 salidas, el formulario lo pide. Al guardar, el catálogo queda con ese precio y la línea con el snapshot. Después, cambiar el precio en Catálogos no altera el costo de ese lote hijo.
24. Validaciones: `Σ salidas > entrada` y producto duplicado se rechazan en la UI y en la RPC (llamada directa); con 2 salidas sin precio la RPC devuelve `precio_requerido`.
25. Dashboard: con el caso de la tarea 22 en el período, `dashboard_merma_procesos` da entrada 10, salida = Σ, merma = 10 − Σ y costo de merma = merma × 5, y `dashboard_rendimiento_proveedor` da el costo medio = 50 / Σ salidas.
26. Trazabilidad del lote crudo: un evento de procesamiento con 3 hijos enlazados. El resultado USD/Bs consolida los 3 hijos tras vender parte de cada uno.
27. Sesión de **operador**:
    - registra un procesamiento de 2 salidas sin ver costos en el formulario ni en el listado;
    - por PostgREST directo no lee `procesamientos` ni `proceso_items` y en las vistas ve el costo en `null`;
    - no puede insertar directo en esas tablas.
28. Concurrencia: dos procesamientos simultáneos sobre el último stock del mismo lote → uno falla con `stock_insuficiente`.
29. Recorrer `checklist.md`.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "NN-modulo necesita … — agregado el <fecha>")_
- **19-edicion-compras (2026-10-19)**: si el admin edita el costo de una compra, el costo de los procesamientos ya registrados de sus lotes se recalcula: `procesamientos.costo_total_usd`, `proceso_items.costo_total_usd` y el costo de los lotes hijos, con las funciones internas de reparto de este módulo, el `reparto_costo` guardado y el snapshot `precio_referencia_usd_kg` (no el catálogo). Kg y prorrateo de entrada no cambian. En empate de pesos el residuo va a la salida de menor `proceso_items.id` (no hay orden guardado). `costingService` suma `recalcularRepartoProceso`. Solo lo hace la RPC `editar_compra`; la regla "el precio del catálogo no recalcula procesamientos pasados" sigue igual.
