# Checklist — 18-iva-opcional

## Decisiones
- [x] Decisiones del pedido cerradas por el usuario el 2026-10-19 (tabla de `spec.md`): IVA por cliente y editable en la venta, sí/no sin otro %, el total baja y corrección de emitidas solo admin con motivo y el % vigente al activar.
- [x] Decisiones de diseño aprobadas por el usuario el 2026-10-19 (tabla de `spec.md`): `iva_pct = 0` sin booleano en `facturas`, recálculo del IVA y el total de las notas emitidas, `tipo linea|iva` en `factura_correcciones`, triggers `facturas_validar_iva` y `notas_credito_iva_factura`, interruptor para quien vende, pedidos sin IVA guardado, y `sin_cambios` / `iva_config_cero`.
- [ ] `/SPEC.md` (§2, §4.4, §5), `05-ventas/spec.md` (§4.2, §4.4) y `17-trazabilidad-y-correccion-facturas/spec.md` tienen la nota "(Antes: …; reemplazado el 2026-10-19.)". `specs/README.md` registra el cambio de alcance. Las tareas agregadas están en 02, 05, 06, 09, 15 y 17.

## Datos y seguridad (migraciones + RLS)
- [ ] Dos migraciones nuevas e incrementales (`20261019110000`, `20261019110100`). No se editó ninguna migración aplicada (en particular las tres de 17).
- [ ] `clientes.aplica_iva` `not null default true`; los clientes existentes quedaron en `true`.
- [ ] `factura_correcciones`: `tipo` con check, columnas de línea nullable, columnas de IVA y créditos, check `factura_correcciones_forma` por tipo. Las filas existentes lo cumplen. RLS, `revoke` y permanencia sin cambios.
- [ ] `facturas_validar_iva` rechaza un `iva_pct` distinto de 0 y del configurado y los importes incoherentes (`iva_invalido`), también por PostgREST directo.
- [ ] `notas_credito_iva_factura` deja toda nota nueva con el IVA vigente de su factura.
- [ ] `cambiar_iva_factura` es `security definer`, exige `es_admin()` (`42501`), no tiene `grant` para `anon` y toma el lock de la factura y luego el de las notas emitidas.
- [ ] `trazabilidad_factura` recreada: devuelve las correcciones de los dos tipos (las de IVA sin línea) y el resto sin cambios.

## Reglas de negocio
- [ ] Venta (POS y entrega): el interruptor viene precargado con `clientes.aplica_iva` y cambiarlo afecta solo esa factura. Sí = `config_negocio.iva_pct`; no = 0 %.
- [ ] El total mostrado en `PedidoForm` y `EntregaPedidoDialog` (y su equivalencia en Bs y el aviso de crédito) es el total con o sin IVA que se emite (corrige el hallazgo de mostrar el subtotal).
- [ ] El límite de crédito al vender usa el total resultante.
- [ ] Facturas existentes sin cambios: conservan su `iva_pct` e importes.
- [ ] Cambio de IVA de una emitida: solo admin, motivo 5–500, anuladas no, `sin_cambios` e `iva_config_cero`. Subtotal igual; IVA, total y estado recalculados con el redondeo de `ivaSobre`. Al activar, se usa el % vigente.
- [ ] Saldo a favor al quitar el IVA de una pagada; contado que activa queda `abierta` y vencida; confirmación de límite al activar a crédito. Pagos y ganancia cambiaria intactos.
- [ ] Notas emitidas de la factura: IVA y total recalculados al % nuevo; subtotal, ítems y kg intactos; anuladas sin cambios; créditos antes y después en el historial.
- [ ] `corregir_linea_factura` sobre una factura sin IVA sigue sin IVA.
- [ ] Contrato activo: aviso previo y marca "Desactualizado" derivada, sin cambios en la vista ni en `contratoService`.
- [ ] El cliente no ve rastro de la corrección; toda factura sin IVA se rotula «Sin IVA» (PDF de contrato: «IVA: No aplica»).
- [ ] Concurrencia: cambio de IVA frente a nota de crédito y frente a abono se serializan y cuadran.

## Dashboard (15)
- [ ] Ninguna RPC `dashboard_*` cambió. Ventas y margen (sin IVA) no se mueven al cambiar el IVA; la cartera refleja el total vigente y los saldos a favor quedan fuera de los indicadores.

## Repositorios y servicios
- [ ] `IFacturaRepository.cambiarIva` solo llama a la RPC; el mapper reconoce los dos tipos de corrección sin lógica de negocio.
- [ ] `invoiceService` resuelve el IVA con `ivaPctVenta`; `correccionFacturaService.cambiarIvaFactura` valida admin, esquema y límite, y mapea los `hint`.
- [ ] Funciones puras (`lib/facturas/iva.ts`, `previsualizarCambioIva`) sin imports de Supabase; `scripts/probar-correccion-factura.ts` pasa con los casos nuevos.

## UI (Atomic Design y `00-estandares-ui`)
- [ ] "Aplica IVA" en el formulario de cliente y chip "Sin IVA" en la ficha.
- [ ] `IvaVentaSwitch` y `TotalesVenta` en POS y entrega de pedido; `NotaCreditoForm` muestra el IVA de la factura.
- [ ] Ficha de factura: «Sin IVA» en el resumen, acción «Quitar IVA» / «Aplicar IVA», `CambiarIvaFacturaDialog` con vista previa, avisos, `useForm({ disabled })`, `Button loading`, cierre protegido, confirmación del límite y toast; historial con las filas de IVA.
- [ ] `IvaVentaSwitch` y `TotalesVenta` registrados en "Componentes compartidos" de `00-estandares-ui/spec.md`.
- [ ] Revisados el modo claro/oscuro y el responsive (375/768/1024/1440; diálogo `fullScreen` en `xs`). Números con `lib/format.ts`; sin `window.alert`/`confirm`.

## Tipos y calidad
- [ ] `Cliente.aplica_iva`, `CorreccionFactura` como unión por `tipo` y `ResultadoCambioIva` en `src/types/domain.ts`, sin `any`.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores.

## Pendientes / deuda técnica
- _(anotar aquí con fecha lo que se difiera y por qué)_
