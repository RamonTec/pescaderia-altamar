# SPEC — Sistema de Gestión para Pescadería (MVP)

## 1. Visión

Sistema de gestión interna para una pescadería pequeña en Venezuela que cubre el ciclo completo del negocio: **comprar → pesar → procesar/limpiar (merma) → volver a pesar → vender por peso → cobrar**, con soporte para la realidad cambiaria venezolana (tasas BCV/paralela, pagos en divisas o Bs, crédito con ganancia cambiaria).

## 2. Decisiones de diseño (cerradas)

| Decisión | Valor |
|---|---|
| Moneda base de registro | **USD** (referente estable); Bs como moneda operativa |
| Tasa de cambio | Automática: **BCV oficial por scraping de www.bcv.org.ve (USD y EUR)**, con dolarapi como respaldo y como fuente de la paralela; tasa del día manual (admin). En cada operación, referencial por defecto o **manual** (cualquier usuario, queda registrado quién y cuánto difería). EUR solo de referencia. Escritura de `tasas` solo admin; las automáticas van con `service_role` desde el servidor. *(Ampliado el 2026-10-07, ver `specs/08-tasas`.)* |
| Snapshot de tasa | Toda transacción guarda la tasa usada y su procedencia (referencial/manual, fuente, referencial vigente); **nunca se recalcula historia**. Tasa vigente para una fecha = última publicada con fecha valor ≤ esa fecha. La corrección de una factura (`specs/17-trazabilidad-y-correccion-facturas`) cambia peso y precio de una línea, **nunca la tasa**. |
| Costeo de inventario | **Por lote** (costo propio de cada lote; PEPS sugerido al vender). *Reabierto el 2026-10-07: antes era promedio ponderado por kg. Ver `specs/07-lotes`.* |
| Crédito | Deuda pactada en USD; cada abono usa la **tasa del día del pago** → ganancia/pérdida cambiaria |
| Facturación | Interna (no fiscal SENIAT), con **IVA desglosado configurable** (default 16%) |
| Ventas | Venta directa (POS) **y** pedidos agendados |
| Inventario | Por peso (kg) y **por lote** físico; productos crudos y procesados |

## 3. Stack

- **Next.js 16** (App Router, TS, Server Components) → Vercel
- **MUI v7** (DataGrid, DatePickers, Autocomplete) + **Tailwind v4** (layout/spacing; preflight desactivado)
- **Supabase** (Postgres, Auth, RLS)
- Arquitectura: **SOLID + Repository/Strategy/Factory + Atomic Design** (atoms → molecules → organisms → templates)

## 4. Dominio y reglas de negocio

### 4.1 Productos e inventario
- `tipo`: `crudo` (entero, tal como llega del proveedor) o `procesado` (limpio/filete).
- Stock siempre en kg con 3 decimales.
- **Lotes**: cada recepción (línea de compra) es un lote físico separado, con código propio, aunque sea del mismo producto y proveedor. Stock del producto = Σ stock de sus lotes.
- **Costo por lote**: cada lote conserva su costo/kg USD, moneda y tasa de compra; toda salida (proceso, venta, pérdida) usa el costo del lote del que sale. *(Antes: promedio ponderado; reemplazado el 2026-10-07.)*
- Valor del inventario: `Σ(stock_lote × costo_lote)` en USD, y en Bs a tasa vigente.
- Pérdidas fuera del procesamiento (dañado, vencido, faltante) se registran por lote con motivo.

### 4.2 Compras (recepción)
- Proveedor entrega producto crudo → se **pesa**, se registra costo por kg en la moneda pactada (USD o Bs) y se **congela la tasa** del día.
- Condición: `contado` (pagada al registrar) o `credito` (genera cuenta por pagar en USD).

### 4.3 Procesamiento (limpieza)
- Entrada: **un lote** de producto crudo (elegido por el operador) + **un** peso de entrada. Salidas: **N productos procesados distintos** de ese crudo, cada uno con su peso_kg → **un lote procesado por salida**, ligado al lote padre. No se mezclan lotes crudos: otro lote = otro registro. *(Antes: un lote crudo daba un lote procesado; reemplazado el 2026-10-19, ver `specs/16-procesamiento-multisalida`.)*
- `merma_kg = peso_entrada − Σ peso_salidas`; `rendimiento = Σ peso_salidas / peso_entrada`. Ambos son del proceso completo, no de cada salida; `Σ salidas ≤ entrada`.
- **El costo total de la entrada** (`peso_entrada × costo_kg_lote_crudo`) **se reparte entre las salidas por valor de venta**: `costo_salida_i = costo_total × (kg_i × precio_ref_i) / Σ(kg × precio_ref)` y `costo_kg_i = costo_salida_i / kg_i`, donde `precio_ref` es el precio de referencia USD/kg del procesado (snapshot en la línea). Si `Σ(kg × precio_ref) = 0`, el reparto es por kg. Con una sola salida, el costo pasa completo. **La merma encarece el kg neto.** *(Antes: el costo se transfería completo a una única salida, `costo_total / peso_salida`; reemplazado el 2026-10-19.)*
- El stock del lote crudo baja; cada lote procesado nace con su costo asignado.

### 4.4 Ventas (pedidos + POS)
- **Pedido agendado**: cliente + fecha de entrega + items con peso estimado y precio/kg pactado.
- Al entregar se **pesa lo real** → se genera factura con los kg entregados.
- **Venta directa**: mismo flujo en un paso (peso real inmediato).
- Precio pactado en USD o Bs; tasa congelada al emitir la factura.
- IVA desglosado: `subtotal + iva (16% default) = total`.
- Cada línea vendida se asigna a lotes **PEPS** (más antiguo primero), editable por el vendedor; no se vende más de lo que hay en los lotes.
- **Corrección de factura** (solo admin): se pueden editar el peso y el precio/kg de una línea emitida, con motivo obligatorio e historial que solo ve el admin. Se recalculan subtotal, IVA, total y saldo; si el total queda por debajo de lo pagado, queda saldo a favor. El cambio de peso mueve stock de los lotes de la línea. Las anuladas no se editan y el peso no baja de lo devuelto por notas de crédito. *(Antes: la factura emitida nunca se editaba y toda corrección iba por nota de crédito; reemplazado el 2026-10-19, ver `specs/17-trazabilidad-y-correccion-facturas`.)*

### 4.5 Cobros y pagos (crédito)
- Deuda siempre expresada en USD.
- Toda factura tiene `fecha_vencimiento` (crédito: fecha + `dias_credito` indicados al emitir, precargados con los del cliente o el default; contado: la misma fecha). Estado de cobro derivado: pagada, pendiente, por vencer, vencida, anulada. Recordatorios de cobro por WhatsApp (`wa.me`) y correo (Resend), registrados. *(Agregado el 2026-10-07, ver `specs/09-cuentas-por-cobrar`.)*
- Abonos parciales permitidos; cada abono registra moneda (USD/Bs) + **tasa del día del pago** + método (efectivo, pago móvil, Zelle, transferencia, punto).
- **Ganancia cambiaria** en Bs: para la porción pagada, `(tasa_pago − tasa_factura) × USD_pagados`. Positiva si el Bs se deprecia.
- Las compras a crédito a proveedores funcionan igual (cuentas por pagar).

### 4.6 COGS y margen
- Cada `factura_item` guarda `costo_usd_kg` snapshot (promedio de los lotes asignados) y su detalle por lote (`factura_item_lotes`) → margen real por venta, por producto y **por lote**, con resultado en USD y en Bs a las tasas de compra y de venta. Una corrección de peso (§4.4) actualiza la asignación y recalcula ese promedio. *(Agregado el 2026-10-19.)*

## 5. Esquema de datos (Postgres/Supabase)

```sql
-- 12 tablas + soporte
tasas               (fecha [valor], fuente bcv|paralela|manual, moneda USD|EUR, valor_bs, origen bcv_scraping|dolarapi|manual, registrada_por)
-- compras/facturas/pagos/pagos_proveedores: + tasa_origen referencial|manual, tasa_fuente, tasa_referencial, tasa_registrada_por
productos           (codigo, nombre, tipo crudo|procesado, categoria, controla_stock, producto_origen_id?, precio_referencia_usd_kg? [solo procesados])
clientes            (nombre, rif_ci, telefono, notas, activo)
proveedores         (nombre, rif_ci, telefono, notas, activo)
compras            (proveedor_id, fecha, condicion, moneda, tasa_snapshot, estado, subtotal_usd, pagado_usd)
compra_items       (compra_id, producto_id, peso_kg, costo_usd_kg)
pagos_proveedores  (compra_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo, ganancia_cambiaria_bs)
procesamientos     (fecha, notas, lote_origen_id, peso_entrada_kg, costo_total_usd, reparto_costo valor|peso)  -- cabecera: entrada única (16, 2026-10-19)
proceso_items      (procesamiento_id, producto_origen_id, lote_origen_id, peso_entrada_kg [prorrateo por kg], producto_destino_id, peso_salida_kg, costo_total_usd [costo asignado], precio_referencia_usd_kg [snapshot])  -- una fila por salida
-- procesamientos/proceso_items: lectura vía procesamientos_view / proceso_items_view (costo null si no admin); escritura solo por RPC
pedidos            (cliente_id, fecha_entrega, estado pendiente|entregado|facturado|anulado)
pedido_items       (pedido_id, producto_id, peso_estimado_kg, peso_entregado_kg, precio_usd_kg)
facturas           (numero, cliente_id, pedido_id?, fecha, dias_credito, fecha_vencimiento, condicion, tasa_snapshot, iva_pct, subtotal_usd, iva_usd, total_usd, pagado_usd, estado)
factura_items      (factura_id, producto_id, peso_kg, precio_usd_kg, costo_usd_kg)
pagos              (factura_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo, ganancia_cambiaria_bs)
movimientos        (producto_id, lote_id, fecha, tipo compra|proceso_in|proceso_out|venta|ajuste|perdida|correccion_venta, peso_kg, costo_usd_kg, ref_id)  -- ledger auditable; correccion_venta: 17, 2026-10-19
factura_correcciones (factura_id, factura_item_id, peso/precio/costo anterior y nuevo, totales anterior y nuevo, pagado_usd, estado anterior y nuevo, contrato_id?, motivo, usuario_id, created_at)  -- 17 (2026-10-19); historial solo admin, escritura solo por RPC
lotes              (codigo, producto_id, origen compra|proceso|inicial, compra_item_id?, proceso_item_id?, lote_padre_id?, proveedor_id, fecha_ingreso, peso_inicial_kg, costo_usd_kg, moneda, tasa_snapshot, estado abierto|agotado|cerrado)
factura_item_lotes (factura_item_id, lote_id, peso_kg, costo_usd_kg)
perdidas_lote      (lote_id, fecha, peso_kg, motivo, detalle, usuario_id)
recordatorios_cobro (cliente_id, canal whatsapp|email, destinatario, asunto?, mensaje, estado generado|enviado|fallido, enviado_por) + recordatorio_facturas
contratos          (numero, tipo venta_credito|compra_credito, factura_id?, compra_id?, fecha, dias_credito, fecha_vencimiento, estado generado|enviado|firmado|anulado, url_storage, notas, generado_por, estado_cambiado_por/_at)  -- 06-contratos; PDF inmutable en bucket privado `contratos`; solo admin
config_negocio     (singleton: iva_pct, fuente_tasa_default, umbrales, dias_credito_default, ..., nombre_comercial, razon_social, rif, direccion, telefono, tolerancia_precio_ref_pct)  -- razon_social..telefono: encabezado de contratos (06); tolerancia_precio_ref_pct: señales de facturas (17)
usuarios           (via Supabase Auth; rol admin|operador)
```

Notas:
- `numeric(12,3)` para kg; `numeric(14,6)` para dinero; tasas `numeric(14,6)`.
- Número de factura secuencial por tabla contadora (o secuencia Postgres).
- RLS: `operador` ve todo excepto costos, balances y reportes de margen; `admin` ve todo. (Columnas sensibles en tablas separadas o vistas protegidas.) En `tasas`: lectura para `authenticated`, escritura solo `admin` (insert/update via `es_admin()`); las tasas automáticas se escriben con `service_role` desde el servidor, nunca desde el navegador.

## 6. Servicios (SRP)

| Servicio | Responsabilidad única |
|---|---|
| `TasaService` (`tasaService`, antes `rateService`) | Obtener tasas (scraping BCV → dolarapi → manual), tasa vigente por fecha valor, resolver la tasa de cada operación, historial |
| `CostingService` | Reparto del costo del procesamiento entre sus salidas (por valor de venta), valorización de stock por lote |
| `LoteService` | Asignación PEPS, pérdidas/cierre de lote, trazabilidad y resultado por lote |
| `InvoiceService` | Numeración, totales + IVA, snapshot de tasa y costos |
| `CreditService` | Saldos, abonos, ganancia cambiaria |
| `InventoryService` | Ledger de movimientos, stock actual |

Patrones: **Repository** (interfaces + impl Supabase → DIP, testeable), **Strategy** (condición de pago, fuente de tasa), **Factory** (creación de movimientos del ledger).

## 7. Pantallas (orden de implementación, una por una)

| # | Pantalla | Contenido |
|---|---|---|
| 1 | **Catálogos** | CRUD productos (crudo/procesado, categorías), clientes, proveedores, config (IVA, fuentes de tasa) |
| 2 | **Compras** | Registrar recepción: proveedor, pesar items, costo/kg, moneda, tasa del día, contado/crédito |
| 3 | **Procesamiento** | Lote crudo: peso entrada → N salidas, merma %, rendimiento, costo/kg de cada salida (admin) |
| 4 | **Pedidos/POS** | Venta directa + pedidos agendados; pesar entrega; emitir factura |
| 5 | **Cobros/Pagos** | Cuentas por cobrar/pagar; registrar abonos con tasa del día y ganancia cambiaria |
| 6 | **Inventario** | Stock por producto y por lote, valorización USD/Bs, pérdidas, trazabilidad de lote |
| 7 | **Dashboard** | KPIs: tasa del día, ventas/margen del día, CxC/CxP, alertas de stock |

## 8. Flujo por pantalla (proceso acordado)

Por cada pantalla: **spec detallado → OK del usuario → implementar → verificar → siguiente.**

## 9. Fuera de alcance (MVP)

- Facturación fiscal SENIAT, retenciones ISLR/IVA
- Multi-empresa / multi-sucursal
- E-commerce, app móvil
- Integración bancaria automática
- Contabilidad formal (mayor, balance)

## 10. Deploy

- Vercel (App Router, Server Components).
- Supabase proyecto cloud; migraciones en `supabase/migrations/`.
- Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
