# Tareas — 18-iva-opcional

Ejecutar en orden. Cada tarea indica archivos y criterio de hecho.

Depende de: `02-clientes`, `05-ventas`, `06-contratos`, `09-cuentas-por-cobrar`, `15-dashboard` y `17-trazabilidad-y-correccion-facturas` (hechos). Modifica la regla de `/SPEC.md` §2 ("IVA desglosado configurable, default 16 %", aplicada a toda venta) y la decisión de 17 de corregir "solo peso y precio/kg de una línea". Toca el esquema de `02` (`clientes`), `05` (triggers en `facturas` y `notas_credito`) y `17` (`factura_correcciones`, `trazabilidad_factura`). Está anotado como tarea agregada (2026-10-19) en `02-clientes`, `05-ventas`, `06-contratos`, `09-cuentas-por-cobrar`, `15-dashboard` y `17-trazabilidad-y-correccion-facturas`.

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`. Las migraciones aplicadas no se editan, en particular `20261007180400_lotes_rpc_ventas.sql` y las tres de 17 (`20261019100000`–`20261019100200`). Prefijo timestamp ≥ `20261019110000`, después de `20261019100200_correccion_facturas_contratos.sql`.

**Decisiones**: todas cerradas por el usuario el 2026-10-19 (tabla "Decisiones cerradas" de `spec.md`). No hay pendientes antes de empezar.

## Fase A — Esquema y RPC

1. **`20261019110000_iva_opcional_esquema.sql`**:
   - `clientes`: `add column if not exists aplica_iva boolean not null default true` + `comment on column`.
   - `factura_correcciones`: `tipo` (default `'linea'`, check), `drop not null` en `factura_item_id` y en las seis columnas de línea, columnas `iva_pct_anterior`/`_nuevo` y `creditos_anterior_usd`/`_nuevo`, `drop constraint factura_correcciones_cambio_real` y `add constraint factura_correcciones_forma` (texto exacto en `spec.md`). Actualizar el `comment on table`.
   - Trigger `facturas_validar_iva` (`before insert`, función `security definer` con `search_path = public`): `iva_pct in (0, config_negocio.iva_pct)` y coherencia de `iva_usd` / `total_usd` con tolerancia 0,000001; si no, `P0001` / `iva_invalido`.
   - Trigger `notas_credito_iva_factura` (`before insert`): recalcula `iva_usd` y `total_usd` con el `iva_pct` vigente de la factura.
   - Hecho:
     - los clientes existentes quedan con `aplica_iva = true`;
     - las filas existentes de `factura_correcciones` cumplen el check nuevo (la migración no falla);
     - un `insert` de factura con `iva_pct = 5` da `iva_invalido`; con 0 y con 16 (coherentes) pasa;
     - una nota insertada con `iva_usd` distinto al de su factura queda con el valor recalculado.
2. **`20261019110100_iva_opcional_rpc.sql`**:
   - `cambiar_iva_factura(uuid, boolean, text) → jsonb` con los pasos, el orden de locks (factura → notas emitidas por `id`) y los `hint` de `spec.md`.
   - `create or replace function trazabilidad_factura` con la misma definición de `20261019100100_correccion_facturas_rpc.sql` y estos cambios en `correcciones`: `left join` a `factura_items` y `productos` (`producto_nombre` `null` en `tipo = 'iva'`), y los campos `tipo`, `iva_pct_anterior`, `iva_pct_nuevo`, `creditos_anterior_usd`, `creditos_nuevo_usd`. El resto, idéntico.
   - `revoke … from public, anon` y `grant execute … to authenticated` en las dos.
   - Hecho: en un Postgres local con todas las migraciones (método del checklist de 17), los casos de la tarea 18 dan las cifras esperadas a nivel SQL.
3. **`src/types/domain.ts`**: `Cliente.aplica_iva: boolean`; `CorreccionFactura` = `CorreccionLinea` (`tipo: 'linea'`, los campos de hoy) \| `CorreccionIva` (`tipo: 'iva'`, `factura_item_id: null`, sin campos de línea ni `movimientos`, con `iva_pct_anterior`, `iva_pct_nuevo`, `creditos_anterior_usd`, `creditos_nuevo_usd`); `ResultadoCambioIva`. Sin `any`.
   - Hecho: `tsc` señala los consumidores de `CorreccionFactura` (`HistorialCorreccionesFactura`, mapper, script de 17) a adaptar.

## Fase B — Dominio puro y validación

4. **`src/lib/facturas/iva.ts`**: `ivaPctVenta(aplica, configPct)`, `facturaConIva({ iva_pct })` (`iva_pct > 0`) y `etiquetaIva(pct)` («IVA (16 %)» o «Sin IVA», con formato `es-VE`). Sin imports de Supabase.
5. **`src/lib/facturas/correccion.ts`**: `previsualizarCambioIva(factura, notasEmitidas, aplicar, configPct)` → IVA y total antes y después, créditos antes y después, saldo o saldo a favor, `sin_cambios` / `iva_config_cero` como resultado sin lanzar. Mismo redondeo que `ivaSobre` / `redondea6`.
6. **Validación**:
   - `clienteValidation.ts`: `aplica_iva: z.boolean()` (default `true` en el formulario).
   - `pedidoValidation.ts`: `aplica_iva: z.boolean()` en `pedidoFormSchema` (obligatorio con entrega inmediata) y en `entregaPedidoSchema`.
   - `correccionFacturaValidation.ts`: `cambiarIvaSchema` (`factura_id` uuid, `aplica_iva` boolean, `motivo` con trim y 5–500, `forzar_limite` opcional), con los mensajes de `lib/validationMessages.ts`.
7. **`scripts/probar-correccion-factura.ts`**: casos nuevos:
   - `ivaPctVenta` con sí/no y con config 0;
   - quitar IVA de $100 + 16 % = $116 → total $100;
   - pagada con $116 → saldo a favor $16;
   - activar en contado pagada → saldo positivo;
   - nota emitida de subtotal $25 (+ $4 IVA) → créditos $29 → $25 al quitar;
   - `sin_cambios` y `iva_config_cero`;
   - paridad de `previsualizarCambioIva` con la fórmula SQL en 200 casos aleatorios.
   - Hecho: el script pasa.

## Fase C — Repositorios y servicios

8. **`interfaces.ts` + `facturaRepository.ts`**: `cambiarIva(input)` (RPC de escritura, sin lógica). **`trazabilidadFacturaMapper.ts`**: mapea las correcciones por `tipo` a la unión.
9. **`clienteService.ts`** (+ `clientes/actions.ts` si arma el input): persiste `aplica_iva` en alta y edición.
10. **`invoiceService.ts`**: `CrearFacturaInput.aplica_iva?: boolean`; si falta, `cliente.aplica_iva`; `iva_pct` con `ivaPctVenta`; límite de crédito con el total resultante. Mapear `iva_invalido` a un `InvoiceError` general. **`pedidoService.entregarPedido`** y **`pedidos/actions.ts`** pasan `aplica_iva` en venta inmediata y entrega.
    - Hecho: una venta a un cliente con `aplica_iva = false` y sin tocar el interruptor nace con `iva_pct = 0`; con el interruptor encendido, al 16 %.
11. **`correccionFacturaService.ts`**: `cambiarIvaFactura(input)`:
    - `requireAdmin()` y validación con el esquema;
    - al **activar** en factura a crédito, comprueba el límite con `getSaldoPendiente` (aumento = IVA nuevo) y lanza `LimiteCreditoExcedido` salvo `forzar_limite`;
    - llama al repositorio;
    - mapea `motivo_requerido` → `motivo`; el resto (`factura_anulada`, `sin_cambios`, `iva_config_cero`), al `Alert`.

## Fase D — UI

12. **Componentes base**:
    - `molecules/IvaVentaSwitch` (`Switch` + etiqueta con el % de config + ayuda si difiere del habitual del cliente; integrable con `react-hook-form`);
    - `molecules/TotalesVenta` (subtotal, IVA o «Sin IVA» y total, cifras tabulares, `lib/format.ts`).
    - Registrar ambos en la tabla "Componentes compartidos" de `specs/00-estandares-ui/spec.md`.
13. **Clientes**: `ClienteFormFields` + `ClienteForm` (default `true` en alta, valor del cliente en edición) y chip "Sin IVA" en el `meta` de `cliente-ficha.tsx`. Tarea agregada en 02.
14. **Ventas**: `PedidoForm` (interruptor solo con entrega inmediata, precarga al elegir o cambiar de cliente, `TotalesVenta`, equivalencia en Bs y aviso de crédito con el total con IVA) y `EntregaPedidoDialog` (interruptor precargado con el cliente del pedido, `TotalesVenta` con los pesos reales). `NotaCreditoForm`: IVA de la factura y total a acreditar. `ConfigNegocioForm`: etiqueta y ayuda del IVA. Tarea agregada en 05.
    - Hecho: el total que muestra el formulario coincide con el `total_usd` de la factura emitida, con IVA y sin IVA.
15. **Ficha de factura**:
    - `FacturaTotalesCard`: «Sin IVA» y la acción «Quitar IVA» / «Aplicar IVA (16 %)», deshabilitada con tooltip si está anulada;
    - `organisms/CambiarIvaFacturaDialog` según `spec.md` ("Pantallas");
    - `HistorialCorreccionesFactura`: render de `tipo = 'iva'`;
    - `facturas/[id]/page.tsx` pasa el `iva_pct` de config a la ficha; `actions.ts` suma `cambiarIvaFacturaAction` (`safeParse` → servicio → `ActionState` + `revalidatePath` de `/facturas/[id]`, `/cobros`, `/clientes/[id]` y `/contratos`).
    - Tarea agregada en 17.
16. **PDF de contrato** (`lib/contratos/plantillas/bloques.tsx`): fila «IVA: No aplica» con `iva_pct = 0`. Tarea agregada en 06.

## Fase E — Documentación y verificación (no saltarse)

17. **Documentación global** (hecha al planificar el 2026-10-19; revisar que siga vigente al cerrar):
    - nota "(Antes: …; reemplazado el 2026-10-19.)" en `/SPEC.md` §2 (Facturación) y §4.4, y en `05-ventas/spec.md` §4.2 y §4.4;
    - nota en `17-trazabilidad-y-correccion-facturas/spec.md` (Corrección, Historial, Notas de crédito ya emitidas y Fuera de alcance);
    - `/SPEC.md` §5 (`clientes`, `factura_correcciones`);
    - `specs/README.md` (orden y cambio de alcance);
    - tareas agregadas en 02, 05, 06, 09, 15 y 17.
18. **Caso del cliente** (admin, Postgres local y luego Supabase). Cliente con `aplica_iva = false`; factura a crédito de 2,000 kg × $50 emitida con el interruptor encendido: subtotal 100,00, IVA 16,00 y total 116,00. Abono de $116 en Bs.
    - Quitar IVA: total 100,00, **saldo a favor 16,00**, estado `pagada`. La ganancia cambiaria del abono no cambia. Historial con «IVA 16 % → Sin IVA».
    - Corregir después el precio de la línea (17) a $40: total 80,00, sigue sin IVA.
    - Aplicar IVA con `config_negocio.iva_pct` cambiado a 15: total 92,00 (15 %), saldo a favor 24,00, y el diálogo avisa «Se aplicará el 15 % vigente».
19. **Notas de crédito**: con una nota emitida de 0,500 kg × $50 (subtotal 25, IVA 4, total 29), quitar el IVA deja la nota en total 25 y el saldo de la factura cuadra (`total − pagado − 25`). Una nota anulada no cambia. Emitir una nota nueva sobre la factura sin IVA la crea sin IVA, aunque el payload traiga IVA (trigger).
20. **Contrato**: con contrato `firmado`, el diálogo avisa. Tras el cambio, `/contratos` y el `⋮` muestran "Desactualizado". El PDF regenerado dice «IVA: No aplica».
21. **Bordes**:
    - factura anulada → `factura_anulada`;
    - quitar en una factura sin IVA o aplicar en una con IVA → `sin_cambios`;
    - aplicar con config 0 → `iva_config_cero`;
    - motivo corto → error en el campo;
    - contado pagada que activa IVA → `abierta` y vencida;
    - crédito que activa IVA por encima del límite → confirmación;
    - `registrar_factura` por PostgREST con `iva_pct = 5` → `iva_invalido`.
22. **Venta**: POS y entrega de pedido con un cliente "Sin IVA" (precarga apagada) y con uno normal; cambiar el interruptor en una sola venta no cambia `clientes.aplica_iva`.
23. **Dashboard**: ninguna RPC `dashboard_*` cambió. Ventas y margen del período no cambian al quitar el IVA; CxC sí baja y el saldo a favor queda fuera de aging y top deudores.
24. **Sesión de operador**: `cambiar_iva_factura` da `42501` por PostgREST; puede usar el interruptor en la venta y editar "Aplica IVA" del cliente; no ve la ficha de factura.
25. **Concurrencia**: cambio de IVA y emisión de nota simultáneos sobre la misma factura → se serializan y la nota queda con el IVA final de la factura; cambio de IVA y abono simultáneos → el estado final cuadra.
26. `npm run lint`, `npx tsc --noEmit`, `npm run build` y `npx tsx scripts/probar-correccion-factura.ts`.
27. Aplicar las 2 migraciones en Supabase en orden. Revisión visual en claro/oscuro y en 375/768/1024/1440 px.
28. Recorrer `checklist.md`.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "NN-modulo necesita … — agregado el <fecha>")_
