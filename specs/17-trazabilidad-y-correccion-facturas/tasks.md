# Tareas — 17-trazabilidad-y-correccion-facturas

Ejecutar en orden. Cada tarea indica archivos y criterio de hecho.

Depende de: `05-ventas`, `06-contratos`, `07-lotes`, `09-cuentas-por-cobrar`, `15-dashboard` y `16-procesamiento-multisalida` (hechos). Reabre la decisión de `05-ventas/spec.md` §4.4 ("la factura original nunca se edita"). Toca el esquema de `04`/`07` (`movimientos`, `config_negocio`) y la vista de `06`. Está anotado como tarea agregada (2026-10-19) en `04-inventario`, `05-ventas`, `06-contratos`, `07-lotes`, `09-cuentas-por-cobrar` y `15-dashboard`.

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`. Las migraciones aplicadas no se editan, en particular `20261007180400_lotes_rpc_ventas.sql`, `20261007190100_contratos.sql` y las `20261008*` del dashboard. Prefijo timestamp ≥ `20261019100000`, después de `20261019000200_procesamiento_multisalida_rpc.sql`.

**Decisiones**: todas cerradas por el usuario el 2026-10-19 (tabla "Decisiones cerradas" de `spec.md`). No hay pendientes antes de empezar.

## Fase A — Esquema y RPC

1. **`20261019100000_correccion_facturas_esquema.sql`**:
   - Tabla `factura_correcciones` con columnas, checks e índices de `spec.md` ("Modelo de datos").
   - RLS: `select` solo `es_admin()`, sin políticas de escritura, `revoke all … from anon`.
   - `movimientos_tipo_check` con `correccion_venta` (`drop` + `add`).
   - `config_negocio`: `tolerancia_precio_ref_pct numeric(5,2) not null default 0`, check 0–100.
   - Hecho:
     - como operador, `select * from factura_correcciones` devuelve 0 filas y un `insert` directo falla;
     - un movimiento `correccion_venta` se puede insertar desde una función `security definer`.
2. **`20261019100100_correccion_facturas_rpc.sql`**:
   - `corregir_linea_factura(uuid, numeric, numeric, text) → jsonb` con los pasos, las reglas de stock y los `hint` de `spec.md`:
     - lock de la factura y después de los lotes, en una sola sentencia ordenada por `fecha_ingreso, codigo`;
     - baja: orden inverso con tope por lo ya devuelto por notas de crédito;
     - sube: lotes de la línea primero, luego PEPS del mismo producto y, si no alcanza, `stock_insuficiente` sin cambios parciales;
     - `factura_item_lotes` actualizado, insertado o borrado;
     - costo snapshot, totales con el `iva_pct` de la factura y estado;
     - fila de historial con `contrato_id` activo, y movimientos con `ref_id` = corrección.
   - `trazabilidad_factura(uuid) → jsonb` (`stable`, `security definer`, `42501` si no es admin). Devuelve factura + cliente, líneas con producto (`tipo`, `controla_stock`, `precio_referencia_usd_kg`), kg devueltos, lotes con su origen (compra / inicial / proceso + lote padre + compra del padre, con cabecera de `procesamientos` o `Σ proceso_items` si es legado), stock actual del lote, notas de crédito con sus ítems, pagos, correcciones (con los movimientos de cada una y el nombre del usuario) y el contrato activo con `desactualizado`.
   - `revoke … from public, anon` y `grant execute … to authenticated` en las dos.
   - Hecho: en un Postgres local con todas las migraciones (mismo método que el checklist de 16), los casos de la tarea 21 dan las cifras esperadas a nivel SQL.
3. **`20261019100200_correccion_facturas_contratos.sql`**:
   - `create or replace view contratos_listado_view` con la misma definición de `20261007190100_contratos.sql` + al final `ultima_correccion_at` (máx. `factura_correcciones.created_at` de la factura) y `desactualizado` (`estado <> 'anulado' and ultima_correccion_at > ct.created_at`).
   - Sigue siendo `security_invoker`.
   - Hecho: un contrato generado antes de una corrección sale con `desactualizado = true`; uno generado después, con `false`.
4. **`src/types/domain.ts`**: los tipos de `spec.md` ("Arquitectura por capas"), sin `any`. `EslabonLoteVendido` es una unión discriminada por `origen` (`compra` | `inicial` | `proceso`); las líneas sin lote tienen `lotes: []`.
   - Hecho: `tsc` señala los consumidores de `TipoMovimiento` y `ConfigNegocio` a adaptar.

## Fase B — Dominio puro y validación

5. **`src/lib/facturas/totales.ts`**: se mueven `subtotalItems` e `ivaSobre` desde `invoiceService.ts`, que pasa a importarlos (tarea agregada en 05). Sin imports de Supabase.
   - Hecho: el POS y la entrega de pedidos emiten con los mismos totales que antes.
6. **`src/lib/facturas/margen.ts`** (`margenLinea`, `margenFactura` neto de notas de crédito, con la regla de `dashboard_lineas_venta`), **`senales.ts`** (`precioReferenciaLinea`, que pondera el snapshot por kg con respaldo en el catálogo; `senalesLinea(linea, toleranciaPct)`, que devuelve las señales `perdida` / `por_debajo` / `cobro_mayor` comparadas al centavo y los indicadores "sin referencia" / "sin costo"; `senalFactura`, con el peor nivel y el conteo) y **`correccion.ts`** (`previsualizarCorreccion(factura, itemId, peso, precio)`, que devuelve totales antes y después, saldo o saldo a favor, delta de kg y mínimo por notas de crédito).
7. **`src/lib/correccionFacturaValidation.ts`**: `corregirLineaSchema` (`factura_item_id` uuid, `peso_kg` > 0 con 3 decimales, `precio_usd_kg` ≥ 0 con 6 decimales, `motivo` con trim y 5–500), con los mensajes de `lib/validationMessages.ts`.
8. **`scripts/probar-correccion-factura.ts`** (`npx tsx`, sale con `process.exit(1)` si falla). Casos:
   - totales del ejemplo de la tarea 21;
   - saldo a favor;
   - mínimo por kg devueltos;
   - las 3 señales con tolerancia 0 y con tolerancia 5 %, el borde exacto (precio = referencia → sin señal) y una referencia ponderada de 11,999999 contra un precio de 12 (sin señal, por la comparación al centavo);
   - los indicadores "sin referencia" y "sin costo";
   - precio de referencia ponderado, con lotes parcialmente sin snapshot y con respaldo en el catálogo;
   - margen neto con nota de crédito;
   - paridad de `subtotalItems` / `ivaSobre` con la fórmula SQL en 200 casos aleatorios.
   - Hecho: el script pasa.

## Fase C — Repositorios y servicios

9. **`interfaces.ts` + `facturaRepository.ts`**: `getTrazabilidad(id)` (RPC de lectura, mapea a `TrazabilidadFactura` sin lógica) y `corregirLinea(input)` (RPC de escritura).
10. **`trazabilidadFacturaService.ts`**: `requireAdmin()`, repositorio, `tolerancia_precio_ref_pct` de `config_negocio` y funciones puras → `DetalleFactura` (líneas con margen y señales, factura con margen neto, saldo y saldo a favor).
    - Hecho: con sesión de operador lanza el error de permisos antes de llamar a la RPC.
11. **`correccionFacturaService.ts`**:
    - valida con el esquema;
    - en factura a crédito que sube, comprueba el límite con `getSaldoPendiente` y lanza `LimiteCreditoExcedido` salvo `forzar_limite`;
    - llama al repositorio;
    - mapea los `hint` a campos (`peso_menor_devuelto` / `stock_insuficiente` / `linea_sin_lotes` → `peso_kg`, `motivo_requerido` → `motivo`; el resto, al `Alert`).
12. **`clienteBalanceService.getSaldoPendiente`** (tarea agregada en 05): resta además `Σ (pagado − total)` de las facturas no anuladas con `pagado > total`. Si hace falta, agregar al repositorio de facturas una lectura de esas facturas, sin lógica.
    - Hecho: la ficha del cliente muestra el saldo a favor del caso de la tarea 21.
13. **`contratoService`** (tarea agregada en 06): `ElegibilidadContrato` del contrato activo suma `desactualizado` (desde `contratos_listado_view`); `ContratoListado` suma `desactualizado`.

## Fase D — UI

14. **Componentes base**:
    - `atoms/SenalFacturaChip` (chip `soft` 22 px por nivel, tooltip con la regla y las cifras);
    - `molecules/CadenaTrazabilidad` (eslabones genéricos `{ icono, titulo, lineas, href? }`, horizontal en `md+` y vertical en `xs`, solo tokens del tema).
    - Registrar ambos en la tabla "Componentes compartidos" de `specs/00-estandares-ui/spec.md`.
15. **`organisms/FacturaTotalesCard`, `FacturaTrazabilidadLineas`, `HistorialCorreccionesFactura`** según `spec.md` ("Pantallas"). Números con `lib/format.ts` y cifras tabulares.
16. **`organisms/CorregirLineaFacturaDialog`**: `AppDialog sm`, vista previa con `previsualizarCorreccion`, avisos, `useForm({ disabled })`, `Button loading`, `dirty`, confirmación del límite con `useConfirm`, errores por campo.
17. **`app/(protected)/facturas/[id]/`**:
    - `page.tsx` server con `requireAdmin()` → `notFound()`; `params` es una `Promise` en Next 16 (revisar la guía en `node_modules/next/dist/docs/`);
    - `factura-ficha.tsx` compone los organisms;
    - `actions.ts` (`safeParse` → servicio → `ActionState` + `revalidatePath` de `/facturas/[id]`, `/cobros`, `/clientes/[id]`, `/inventario` y `/contratos`);
    - `loading.tsx`, `error.tsx`, `not-found.tsx`.
    - Hecho: como admin se ve la cadena de una línea con lotes procesados, otra con un crudo y otra sin control de stock.
18. **Entradas**:
    - `/cobros` y la ficha de cliente: `getRowHref` y `⋮` "Ver detalle y trazabilidad", solo admin (tarea agregada en 09);
    - `LoteTimeline`: enlace de la factura para admin (tarea agregada en 07);
    - `ContratosTable` y `useContratoAcciones`: chip y etiqueta "Desactualizado" (tarea agregada en 06).
19. **`ConfigNegocioForm` + `configValidation.ts` + `configRepository`**: `FormSection` "Señales de facturas" con "Tolerancia frente al precio de referencia (%)" (`NumberField` con sufijo %, 0–100, ayuda «0 % marca cualquier diferencia»). Tarea agregada en 04.

## Fase E — Documentación y verificación (no saltarse)

20. **Documentación global** (hecha al planificar el 2026-10-19; revisar que siga vigente al cerrar):
    - nota "(Antes: …; reemplazado el 2026-10-19.)" en `/SPEC.md` §4.4 y en `05-ventas/spec.md` §4.4;
    - `/SPEC.md` §2 (tasa), §4.6 y §5;
    - `specs/README.md` (orden y cambio de alcance);
    - tareas agregadas en 04, 05, 06, 07, 09 y 15.
21. **Caso del cliente** (admin, Postgres local y luego Supabase). Factura a crédito con IVA 16 % y línea de filete de 2,000 kg × $12 del lote FIL-1 (costo/kg 8,053691, caso de 16): subtotal 24,00, IVA 3,84 y total 27,84. Abono de $20 en Bs.
    - Peso 2,000 → 1,500: total 20,88, saldo 0,88; FIL-1 recibe +0,500 kg (movimiento `correccion_venta`) y se reabre si estaba agotado.
    - Precio 12 → 10: total 17,40 y **saldo a favor 2,60**. Estado `pagada`. La ganancia cambiaria del abono no cambia.
    - Peso 1,500 → 2,500 con FIL-1 en 0,300 kg y FIL-2 abierto: toma 0,300 de FIL-1 y 0,700 de FIL-2 (`orden` 2). El costo snapshot queda ponderado y FIL-1 pasa a `agotado`.
    - El historial muestra las 3 correcciones con usuario, motivo, antes → después y lotes movidos.
22. **Notas de crédito**: con una nota emitida de 1,000 kg sobre la línea, bajar a 0,900 da `peso_menor_devuelto` (en la UI y por llamada directa a la RPC). Bajar a 1,200 devuelve a los lotes sin superar lo vendido menos lo devuelto por lote. Después, anular la nota sigue revirtiendo exactamente sus kg.
23. **Contrato**: con contrato `firmado`, el diálogo avisa. Tras corregir, `/contratos` y el `⋮` muestran "Desactualizado". Anular y generar otro deja el nuevo sin la marca. El PDF nuevo no menciona la corrección.
24. **Bordes**:
    - factura anulada → `factura_anulada` (forzando el estado en local);
    - `sin_cambios`;
    - motivo corto;
    - subida sin stock → `stock_insuficiente` sin cambios parciales;
    - producto sin control de stock: mueve el ledger sin lote y el costo queda en 0;
    - contado que sube → `abierta` y vencida;
    - límite de crédito → confirmación.
25. **Señales** (tolerancia 0):
    - precio 7 con costo 8,05 → Pérdida;
    - precio 11,50 con referencia 12 → Por debajo;
    - precio 120 con referencia 12 → Cobro mayor;
    - precio 12 con referencia 12 → sin señal;
    - crudo sin referencia → "Sin referencia";
    - producto sin control de stock → "Sin costo".

    Con la tolerancia en 5 % en Configuración, el precio 11,50 deja de marcarse y la ficha recalcula.
26. **Dashboard**: tras corregir una factura de un período, `dashboard_lineas_venta` y los KPIs de ese período reflejan los valores nuevos. El saldo a favor no entra en aging, top deudores ni CxC. Ninguna RPC `dashboard_*` cambió.
27. **Sesión de operador**:
    - `/facturas/[id]` da 404;
    - en `/cobros` no hay enlace ni acción;
    - `trazabilidad_factura` y `corregir_linea_factura` dan `42501` por PostgREST directo;
    - `factura_correcciones` devuelve 0 filas;
    - no hay `update` directo sobre `facturas` ni `factura_items`.
28. **Concurrencia**:
    - corrección y abono simultáneos sobre la misma factura → se serializan y el estado final cuadra;
    - corrección que sube y venta simultánea sobre el último kg del mismo lote → una falla con `stock_insuficiente` y ningún lote queda negativo.
29. Paridad de stock: para cada lote tocado, `lote_stock` = `peso_inicial` − Σ `factura_item_lotes` vigentes + Σ devoluciones de notas emitidas − pérdidas − salidas a proceso (consulta en el checklist).
30. `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npx tsx scripts/probar-correccion-factura.ts`.
31. Aplicar las 3 migraciones en Supabase en orden. Revisión visual en claro/oscuro y en 375/768/1024/1440 px.
32. Recorrer `checklist.md`.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "NN-modulo necesita … — agregado el <fecha>")_
- **18-iva-opcional (2026-10-19)**: se amplía la corrección de este módulo (nota de reemplazo en `spec.md`). El admin puede activar o quitar el IVA de una factura emitida con la RPC nueva `cambiar_iva_factura`.
  - `factura_correcciones` (migración `20261019110000_iva_opcional_esquema.sql`, sin editar las de este módulo) suma `tipo linea|iva`, `iva_pct_anterior`/`_nuevo` y `creditos_anterior_usd`/`_nuevo`. `factura_item_id` y las columnas de línea pasan a nullable, y `factura_correcciones_cambio_real` se reemplaza por `factura_correcciones_forma`, con un check por tipo. Las filas existentes son `tipo = 'linea'`.
  - `trazabilidad_factura` se recrea (`20261019110100_iva_opcional_rpc.sql`): `left join` a la línea en `correcciones` y campos nuevos. `corregir_linea_factura` **no cambia**: ya usa el `iva_pct` de la factura.
  - `CorreccionFactura` pasa a unión por `tipo`. Se adaptan `trazabilidadFacturaMapper.ts`, `HistorialCorreccionesFactura` (fila «IVA 16 % → Sin IVA»), `FacturaTotalesCard` («Sin IVA» y la acción Quitar/Aplicar IVA), `factura-ficha.tsx`, `facturas/[id]/actions.ts`, `correccionFacturaService.ts` y `scripts/probar-correccion-factura.ts`.
  - El contrato desactualizado, el chip "Corregida · N" y el permiso solo admin no cambian de regla.
- **19-edicion-compras (2026-10-19)**: la edición de una compra recalcula `factura_item_lotes.costo_usd_kg` y `factura_items.costo_usd_kg` de las líneas ya vendidas de sus lotes (y de sus hijos procesados). Precios, totales, IVA, pagado y estado de las facturas no cambian. **Sin cambios de código ni de RPC** en este módulo: el margen y la señal "Pérdida" de `/facturas/[id]` se recalculan solos. `factura_correcciones.costo_*` no se reescribe (es historial de su momento). El patrón de este módulo (RPC atómica, motivo, historial solo admin, contrato desactualizado derivado, saldo a favor) se reutiliza en 19.
