# Checklist — 17-trazabilidad-y-correccion-facturas

> Verificación del 2026-10-19 (executor). "Postgres local" = contenedor `postgres:16-alpine` desechable, con stubs de `auth` (`auth.uid()` desde `request.jwt.claim.sub`, `auth.users`), `storage` y los roles `anon` / `authenticated` / `service_role`. Se aplicaron todas las migraciones en orden (la `0015` con la secuencia en 1, porque la base estaba vacía) y luego un script de 81 aserciones SQL más dos pruebas de concurrencia con dos sesiones. El contenedor se borró al terminar. **No se aplicó nada a Supabase remoto.**

## Decisiones
- [x] Decisiones cerradas por el usuario el 2026-10-19 (tabla de `spec.md`): subida de peso (línea → PEPS → error), tres señales con tolerancia simétrica por defecto 0 %, referencia del snapshot con respaldo en el catálogo, ledger visible al operador solo con kg, contado que sube queda abierta y vencida, el bloqueo no impide corregir, el límite solo avisa y no se actualiza el peso entregado del pedido.
- [x] `/SPEC.md` (§2, §4.4, §4.6, §5) y `05-ventas/spec.md` §4.4 tienen la nota "(Antes: …; reemplazado el 2026-10-19.)". `specs/README.md` registra el cambio de alcance. Las tareas agregadas están en 04, 05, 06, 07, 09 y 15. — Revisado al cerrar: sigue vigente y coincide con lo implementado.

## Datos y seguridad (migraciones + RLS)
- [x] Tres migraciones nuevas e incrementales (`20261019100000`–`20261019100200`). No se editó ninguna migración aplicada.
- [x] `factura_correcciones`: motivo obligatorio (5–500), check de cambio real, `usuario_id` y `created_at` automáticos, sin `update`/`delete`. — Además `revoke insert, update, delete, truncate … from authenticated` y `revoke all … from anon`. Probado: `usuario_id` = `auth.uid()`; un `delete` del admin da `42501`.
- [x] `factura_correcciones` solo la lee el admin; nadie escribe directo. Se probó por PostgREST con la sesión de operador. — Probado en Postgres local con `set role authenticated` y el `sub` del operador: 0 filas y el `insert` da `42501`. **Pendiente**: repetirlo por PostgREST contra Supabase después de aplicar (ver deuda).
- [x] `trazabilidad_factura` y `corregir_linea_factura` son `security definer`, exigen `es_admin()` (`42501`) y no tienen `grant` para `anon`. — `has_function_privilege('anon', …)` = `false` en las dos.
- [x] `facturas`, `factura_items` y `factura_item_lotes` siguen sin políticas de `update`: solo las modifica la RPC. — Operador: `update facturas` afecta 0 filas y `update factura_items` da permiso denegado.
- [x] `movimientos_tipo_check` incluye `correccion_venta`. Cada corrección con cambio de peso deja movimientos con `ref_id` = corrección.
- [x] `contratos_listado_view` sigue siendo `security_invoker` y expone `desactualizado`. El trigger `contratos_validar` no cambió.

## Reglas de negocio
- [x] Solo cambian el peso y el precio/kg de una línea. Subtotal, IVA (con el `iva_pct` de la factura), total y estado se recalculan con el mismo redondeo que `subtotalItems` / `ivaSobre`. La tasa no cambia. — Paridad TS ↔ SQL en 200 casos aleatorios (precios de 2 y de 6 decimales, IVA 0/8/12,5/16) con aritmética decimal exacta.
- [x] Factura anulada → no se edita. Sin cambios → error claro. — `factura_anulada` y `sin_cambios` probados en SQL; en la UI "Corregir" queda deshabilitado con tooltip y el primario se deshabilita sin cambios.
- [x] El peso no baja de los kg devueltos por notas de crédito emitidas. Las notas emitidas no cambian. Anular una nota después sigue funcionando. — Tarea 22 en SQL: 0,900 < 1,000 da `peso_menor_devuelto`; 1,200 devuelve 0,8 kg al lote sin tope agotado; anular la nota revierte exactamente 1 kg. Paridad de stock sin diferencias.
- [x] Baja de peso: los kg vuelven a los lotes de la línea en orden inverso, con tope por lo ya devuelto. El lote se reabre si estaba agotado o cerrado.
- [x] Subida de peso: primero los lotes de la línea y luego PEPS del mismo producto. Sin stock suficiente da `stock_insuficiente` sin ningún cambio parcial. — Caso c) de la tarea 21: 0,300 de FIL-1 y 0,700 de FIL-2 con `orden` 2; FIL-1 queda agotado. La subida imposible deja intactos `factura_item_lotes`, `movimientos` y el total.
- [x] Producto sin control de stock: movimiento sin lote y costo 0.
- [x] `costo_usd_kg` de la línea = promedio ponderado de su `factura_item_lotes` vigente. — Si solo cambia el precio, el costo no se toca (también en líneas legadas sin lotes, que dan `linea_sin_lotes` si cambia el peso).
- [x] Total por debajo de lo pagado → saldo a favor visible en la ficha de la factura y en `getSaldoPendiente` del cliente. Los pagos y su `ganancia_cambiaria_bs` no se tocan. — SQL: total 17,40 con 20 pagados → `saldo_a_favor_usd` 2,60, estado `pagada`, ganancia 70 Bs intacta. `getSaldoPendiente` resta `Σ (pagado − total)` de las facturas `pagada` (`listCerradasByCliente`), y `CreditoResumen` muestra "Saldo a favor" si el saldo es negativo. **Pendiente**: verlo en la ficha con datos reales (ver deuda).
- [x] Contado que sube → `abierta` (y vencida). Crédito que sube por encima del límite → confirmación blanda. — SQL: contado de 18,56 que sube queda `abierta` con saldo 1,16 y `fecha_vencimiento` = fecha. El límite lo comprueba `correccionFacturaService` (aumento del saldo vs `limite_credito_usd`) y el diálogo pide confirmación con `useConfirm`.
- [x] Contrato activo → aviso previo y marca "Desactualizado" derivada. Uno regenerado después de la corrección no tiene la marca. — Tarea 23 en SQL: antes de corregir `false`, después `true`, anulado `false`, regenerado `false`; la RPC devuelve el contrato y el historial guarda `contrato_id`.
- [x] El cliente no ve rastro de la corrección: el PDF de contrato y los recordatorios usan solo los valores vigentes y no leen `factura_correcciones`. — Solo leen `factura_correcciones` la RPC de trazabilidad y la vista de contratos (columna `desactualizado`, que no llega al PDF). Regla para documentos futuros: tampoco deben leerla.
- [x] Bajo lock (factura y luego lotes en orden PEPS): la corrección se serializa con abonos, notas de crédito, ventas y otras correcciones. Ningún lote queda en negativo. — Tarea 28 en Postgres local con dos sesiones: corrección lenta + abono simultáneo → el abono espera y el estado final cuadra (total 18,096, pagado 17,40, `abierta`). Corrección que sube + venta del último kg del mismo lote, en los dos órdenes → la segunda falla con `stock_insuficiente` y ningún lote queda negativo.
- [x] Paridad de stock de los lotes tocados (consulta de la tarea 29) sin diferencias. — `t.paridad(codigo)` = 0 para FIL-1, FIL-2 y FIL-C: `peso_inicial − Σ fil vigentes de facturas no anuladas + Σ devoluciones de notas emitidas − pérdidas − salidas a proceso − stock del ledger`.

## Trazabilidad, margen y señales
- [x] La cadena por línea cubre lote procesado (compra del padre → procesamiento con merma, rendimiento y costo/kg de la salida → venta), crudo vendido sin procesar, lote `inicial`, varias asignaciones de lote y producto sin lote. — La RPC se probó con una línea de 2 lotes procesados, un crudo con origen `compra` y hielo sin control de stock (`lotes: []`). `FacturaTrazabilidadLineas` arma los eslabones por origen, incluido `inicial` (sin dato de prueba de ese origen en SQL).
- [x] Merma y rendimiento son los del proceso completo (cabecera de 16, con respaldo en `Σ proceso_items` para legados). — Entrada 10 kg (cabecera) y Σ salidas 7,5 kg en la prueba; `legado` = cabecera nula.
- [x] Margen por línea y por factura (neto de notas de crédito) igual a la regla de `dashboard_lineas_venta`.
- [x] Señales `perdida`, `por_debajo` y `cobro_mayor` comparadas al centavo con `tolerancia_precio_ref_pct` (default 0). Indicadores "Sin referencia" y "Sin costo". Referencia: el snapshot ponderado por kg, con respaldo en el catálogo. Son informativas y no bloquean. — Tarea 25 en el script: 7 vs 8,05 → Pérdida; 11,50 vs 12 → Por debajo (y nada con 5 %); 120 → Cobro mayor; 12 → nada; 11,999999 vs 12 → nada; 12,60 con 5 % (borde) → nada. Además se pasaron los JSON reales de la RPC por las funciones con tolerancia 0 y 5 %.
- [x] El operador ve las filas `correccion_venta` en `movimientos_view` solo con kg (costo `null`), sin acceso al motivo ni al historial.
- [x] `scripts/probar-correccion-factura.ts` pasa.

## Dashboard (15)
- [x] Ninguna RPC `dashboard_*` cambió. Las cifras del período de la factura reflejan la corrección y los saldos a favor quedan fuera de los indicadores de cartera. — SQL: `dashboard_lineas_venta` da 25 (2,5 × 10) en la fecha de la factura; una factura con saldo a favor (−5,80) no entra en `dashboard_aging_cartera`.

## Repositorios y servicios
- [x] `IFacturaRepository.getTrazabilidad` / `corregirLinea` solo llaman a las RPC, sin lógica de negocio. — El mapeo JSON → tipos está en `trazabilidadFacturaMapper.ts` (sin Supabase, lo usa también el script).
- [x] `trazabilidadFacturaService` y `correccionFacturaService` son los únicos que usan esos métodos. Validan admin antes de llamar y mapean los `hint` a campos.
- [x] Funciones puras en `lib/facturas/` sin imports de Supabase. `invoiceService` importa `subtotalItems` / `ivaSobre` desde allí.

## UI (Atomic Design y `00-estandares-ui`)
- [x] `/facturas/[id]` solo admin (`notFound()` para el operador). `page.tsx` solo compone organisms. Tiene `loading.tsx`, `error.tsx` y `not-found.tsx`. — `page.tsx` carga y pasa props a `factura-ficha.tsx`, que compone los organisms (mismo patrón que la ficha de cliente).
- [x] `CorregirLineaFacturaDialog`: vista previa en vivo, avisos (abonos, saldo a favor, contrato, notas de crédito, contado, stock), `useForm({ disabled })`, `Button loading`, cierre protegido, errores por campo y toast.
- [x] Entradas solo para admin en `/cobros`, la ficha de cliente y `LoteTimeline`. "Desactualizado" en `/contratos` y en el `⋮`.
- [x] Tolerancia frente al precio de referencia editable en Catálogos › Configuración.
- [x] `SenalFacturaChip` y `CadenaTrazabilidad` registrados en "Componentes compartidos" de `00-estandares-ui/spec.md`.
- [ ] Revisados el modo claro/oscuro y el responsive (375/768/1024/1440; cadena vertical en `xs`, diálogo `fullScreen`). Números con `lib/format.ts`; sin `window.alert`/`confirm`. — **Diferido (2026-10-19)**: la ficha llama a RPC que aún no existen en Supabase y no hay Supabase local, así que no se pudo abrir en el navegador. El código usa solo tokens del tema, `AppDialog` (`fullScreen` en `xs`), `CadenaTrazabilidad` con `flexDirection` `xs: column / md: row`, números con `lib/format.ts` (se agregó `formatFechaHora`) y `useConfirm` / `useNotify`.

## Tipos y calidad
- [x] Tipos nuevos o cambiados en `src/types/domain.ts`, sin `any`.
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores. — Lint deja 1 warning previo en `NotaCreditoForm.tsx`, ajeno al módulo.

## Pendientes / deuda técnica
- **2026-10-19 — Migraciones sin aplicar en Supabase** (tarea 31): `20261019100000`, `…100100` y `…100200` están escritas y validadas en un Postgres local desechable. Hasta aplicarlas, `/facturas/[id]`, el listado de contratos y la elegibilidad de contratos fallan contra la base remota, porque leen la RPC y la columna `desactualizado` nuevas. **Aplicarlas antes de desplegar este código.**
- **2026-10-19 — Pruebas E2E con la app** (tareas 17, 21–27 en pantalla; PostgREST directo con la sesión del operador): cubiertas en SQL local y con el script. Falta repetirlas en la app con Supabase después de aplicar.
- **2026-10-19 — Revisión visual** en claro/oscuro y responsive: ver el ítem de UI.
- **2026-10-19 — Desviaciones menores de la spec** (no reabren decisiones):
  - `corregirLineaSchema` suma `factura_id` (el servicio comprueba que la línea es de esa factura y lo usa para el límite y la revalidación) y `forzar_limite`.
  - La RPC usa también los `hint` `peso_invalido` / `precio_invalido` (entradas fuera de rango) y `motivo_requerido` para un motivo de más de 500 caracteres.
  - `trazabilidad_factura` devuelve además `kg_devueltos` por lote: el diálogo calcula con él a qué lote vuelve cada kg al bajar el peso.
  - Notas de crédito y pagos de la ficha siempre usan `ListaResumen` (sin cambiar a `AppDataGrid` con más de 5 filas).
