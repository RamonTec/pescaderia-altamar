# Checklist — 16-procesamiento-multisalida

> Verificación del 2026-10-19 (executor). "Postgres local" = contenedor `postgres:16-alpine` desechable, con stubs de `auth`/`storage` y de los roles de Supabase. Se aplicaron todas las migraciones en orden y, sobre un procesamiento legado creado con la RPC vieja, las 3 de este módulo. **No se aplicó nada a Supabase remoto.**

## Decisiones
- [x] Decisiones pendientes de `spec.md` confirmadas por el usuario antes de ejecutar (caso de prueba con piel de 0,5 kg o de 1 kg, precio no requerido con una sola salida, precio solo de lectura cuando viene del catálogo, costo 0 con precio 0, re-etiquetado de B7). — Confirmadas al invocar `/sdd-implement` (2026-10-19): piel de **0,5 kg**. La spec quedó con un solo caso.
- [x] `/SPEC.md` §4.3, §5, §6 y §7 reflejan el procesamiento multisalida con la nota "(Antes: …; reemplazado el 2026-10-19.)"; `specs/README.md` lo registra como cambio de alcance. — Revisado al cerrar: sigue vigente.

## Datos y seguridad (migraciones + RLS)
- [x] Tres migraciones nuevas e incrementales (`20261019000000`–`20261019000200`). No se editó `20261007180300_lotes_rpc_inventario.sql` ni ninguna otra migración aplicada.
- [x] `productos.precio_referencia_usd_kg` ≥ 0 y solo en procesados (check en la base).
- [x] Cabecera rellenada en todos los procesamientos existentes (0 filas legadas, o el número anotado aquí con su motivo); `Σ` de las líneas = cabecera en entrada y costo. — Postgres local: 0 filas legadas y `procesamientos_cabecera_completa` validado. En Supabase el conteo real se verá al aplicar. Si hubiera legados, la migración deja el check `not valid` y un `comment` con el número.
- [x] Una salida por producto en cada procesamiento (índice único) y `salida_menor_entrada` sigue válido para las filas nuevas. — El prorrateo usa floor + mayor resto, así que `e_i ≥ kg_i`.
- [x] El operador no lee `procesamientos` ni `proceso_items` base; en `procesamientos_view` / `proceso_items_view` el costo llega `null` (probado por PostgREST directo). Cierra la deuda de `04-inventario` y `07-lotes`, anotada allí. — Probado en Postgres local con el rol `authenticated` y el JWT del operador: las tablas base dan `permission denied` y las vistas devuelven 0 filas con costo. **Pendiente**: repetir la prueba por PostgREST directo contra Supabase después de aplicar (tarea 27).
- [x] Sin políticas de insert directo en `procesamientos` ni `proceso_items`: solo escribe la RPC `security definer`. — Un insert directo del operador da violación de RLS.
- [x] `lotes_view` y las RPC `dashboard_*` siguen funcionando tras el `revoke`. — Probado en Postgres local.

## Reglas de cálculo
- [x] Un procesamiento = un lote crudo + un peso de entrada → N salidas de procesados distintos del mismo crudo, cada una con su lote hijo y `lote_padre_id`.
- [x] `Σ salidas ≤ entrada` validado en la UI, el servicio y la RPC; la merma y el rendimiento son del proceso completo (nunca por salida en la UI).
- [x] Reparto por valor de venta: `costo_total × (kg_i × precio_i) / Σ(kg × precio)`; `Σ` de costos asignados = costo total exacto (residuo a la salida de mayor peso de reparto).
- [x] Caso borde `Σ(kg × precio) = 0` → reparto por peso (`reparto_costo = 'peso'`); una sola salida → 100 % del costo sin exigir precio.
- [x] Caso de prueba del lote de 10 kg a $5 cuadra con la tabla de `spec.md` (piel de 0,5 kg: 8,053691 / 1,342282 / 0,671140 USD/kg) en el script, en la RPC y en la UI de admin. — Cuadra en el script y en la RPC (Postgres local). La UI usa la misma función (`repartirCostoProceso`): la paridad TS ↔ SQL se comprobó en 300 casos aleatorios. **Pendiente**: verlo en pantalla como admin, después de aplicar las migraciones en Supabase.
- [x] Precio: se usa el del catálogo; si falta, se pide en el formulario, se guarda como snapshot y rellena el catálogo solo si estaba vacío; cambiarlo después no recalcula lotes pasados. — Nada reescribe el snapshot ni `lotes.costo_usd_kg`.
- [x] La RPC no confía en el precio del cliente cuando el catálogo tiene uno. — Probado: con el catálogo en 12 y 99 en el payload, el snapshot queda en 12.
- [x] Ledger: un `proceso_out` por procesamiento y un `proceso_in` por salida al costo/kg de su lote; el lote crudo pasa a `agotado` al quedar en 0.
- [x] Bajo lock de la fila del lote: dos procesamientos simultáneos nunca dejan stock negativo. — Probado con dos sesiones que procesan todo el stock. La segunda espera el lock y falla con `lote_no_disponible`, porque el lote ya quedó `agotado`. Con stock parcial el error sería `stock_insuficiente`.

## Repositorios y servicios
- [x] `IProcesamientoRepository` + implementación Supabase: solo RPC y lecturas desde las vistas, sin lógica de negocio. — Son dos consultas que se unen en el repositorio.
- [x] `procesamientoService` es el único que usa el repositorio; valida y mapea los errores de la RPC a `salidas.N.*`. — Lo hace `campoDeErrorProcesamiento` con el `hint` y `detail = 'salida:N'`.
- [x] `repartirCostoProceso` y `prorratearEntrada` son puras (`costingService`), con el mismo redondeo que la RPC; `costoDestino` retirada sin consumidores. — Los repositorios de `costingService` pasaron a import dinámico: así el módulo no carga clientes de Supabase.
- [x] `scripts/probar-procesamiento.ts` pasa.
- [x] `resultadoLote` y `getMovimientosArbol` usan la cabecera; el árbol de un crudo consolida sus N hijos. — Hay un caso en el script.

## Dashboard (15)
- [x] `dashboard_merma_procesos` y `dashboard_rendimiento_proveedor` dan cifras correctas con procesamientos multisalida, sin cambios de RPC (caso de la tarea 25). — Postgres local: entrada 12, salida 9,1, merma 2,9 y costo de merma 14,5 (= 2,9 × 5). Costo medio = 60 / 9,1.
- [x] B7 re-etiquetado "Costo medio kg obtenido" con ayuda; texto de `MermaProcesosPanel` actualizado.

## UI (Atomic Design y `00-estandares-ui`)
- [x] `ProcesamientoForm`: entrada única, lista dinámica de salidas (mín. 1, máx. 10, sin repetir producto), precio condicional, resumen en vivo; costos por salida **solo admin**. — Los costos solo aparecen si `lotes_view` trae el costo del lote.
- [x] `ProcesamientosTable`: una fila por procesamiento con sus salidas y lotes; costos solo admin; búsqueda por cualquier código de salida.
- [x] `LotesCreadosDialog` muestra los N códigos para rotular. — Sin cambios: ya admitía una lista.
- [x] `LoteTimeline`: un evento por procesamiento con enlaces a los N hijos.
- [x] `ProductoForm` / `ProductosTable`: precio de referencia solo en procesados.
- [x] `page.tsx` solo compone organisms/templates; formularios con `useForm({ disabled })`, `Button loading`, confirmación al descartar, toasts; números con `lib/format.ts`. — Las filas de salida van en la molécula nueva `SalidasProcesoFieldArray`.
- [ ] Modo claro/oscuro y responsive (375/768/1024/1440; diálogo `fullScreen` en `xs`, filas de salida apiladas) revisados. — **Diferido (2026-10-19)**. La pantalla lee `procesamientos_view` / `proceso_items_view`, que aún no existen en Supabase porque las migraciones no se aplicaron, y no hay Supabase local. Revisar en el navegador después de aplicar. El código usa solo tokens del tema, `AppDialog` (`fullScreen` en `xs`) y `Grid` con `xs: 12` para apilar.

## Tipos y calidad
- [x] Tipos nuevos o cambiados en `src/types/domain.ts`; sin `any`.
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores. — Lint deja 1 warning previo en `NotaCreditoForm.tsx`, ajeno al módulo.

## Pendientes / deuda técnica
- **2026-10-19 — Migraciones sin aplicar en Supabase** (tarea 21): `20261019000000`, `…000100` y `…000200` están escritas y validadas en un Postgres local desechable.
  - Falta aplicarlas en orden y comprobar el relleno de cabeceras de los procesamientos reales.
  - Hasta entonces la app nueva no funciona contra la base remota: lee vistas que no existen y llama a la RPC con la firma nueva.
- **2026-10-19 — Pruebas E2E con la app**: las tareas 22–24, 26 y 27 en pantalla, y el PostgREST directo del operador.
  - Están cubiertas a nivel SQL en Postgres local y con el script.
  - Falta repetirlas con la app y Supabase después de aplicar las migraciones.
- **2026-10-19 — Revisión visual** en claro/oscuro y responsive: ver el ítem de UI.
