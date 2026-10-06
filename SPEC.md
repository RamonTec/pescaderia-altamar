# SPEC — Sistema de Gestión para Pescadería (MVP)

## 1. Visión

Sistema de gestión interna para una pescadería pequeña en Venezuela que cubre el ciclo completo del negocio: **comprar → pesar → procesar/limpiar (merma) → volver a pesar → vender por peso → cobrar**, con soporte para la realidad cambiaria venezolana (tasas BCV/paralela, pagos en divisas o Bs, crédito con ganancia cambiaria).

## 2. Decisiones de diseño (cerradas)

| Decisión | Valor |
|---|---|
| Moneda base de registro | **USD** (referente estable); Bs como moneda operativa |
| Tasa de cambio | Manual + automática (BCV y paralela vía pydolarve/dolarapi), con override |
| Snapshot de tasa | Toda transacción guarda la tasa usada; **nunca se recalcula historia** |
| Costeo de inventario | **Promedio ponderado** por kg |
| Crédito | Deuda pactada en USD; cada abono usa la **tasa del día del pago** → ganancia/pérdida cambiaria |
| Facturación | Interna (no fiscal SENIAT), con **IVA desglosado configurable** (default 16%) |
| Ventas | Venta directa (POS) **y** pedidos agendados |
| Inventario | Por peso (kg); productos crudos y procesados |

## 3. Stack

- **Next.js 16** (App Router, TS, Server Components) → Vercel
- **MUI v7** (DataGrid, DatePickers, Autocomplete) + **Tailwind v4** (layout/spacing; preflight desactivado)
- **Supabase** (Postgres, Auth, RLS)
- Arquitectura: **SOLID + Repository/Strategy/Factory + Atomic Design** (atoms → molecules → organisms → templates)

## 4. Dominio y reglas de negocio

### 4.1 Productos e inventario
- `tipo`: `crudo` (entero, tal como llega del proveedor) o `procesado` (limpio/filete).
- Stock siempre en kg con 3 decimales.
- **Costo promedio ponderado** en cada entrada:
  `nuevo_costo_kg = (stock_kg × costo_actual + entrada_kg × costo_entrada) / (stock_kg + entrada_kg)`
- Valor del inventario: `Σ(stock_kg × costo_kg)` en USD, y en Bs a tasa vigente.

### 4.2 Compras (recepción)
- Proveedor entrega producto crudo → se **pesa**, se registra costo por kg en la moneda pactada (USD o Bs) y se **congela la tasa** del día.
- Condición: `contado` (pagada al registrar) o `credito` (genera cuenta por pagar en USD).

### 4.3 Procesamiento (limpieza)
- Entrada: producto crudo + peso_kg. Salida: producto procesado + peso_kg.
- `merma_kg = peso_entrada − peso_salida`; `rendimiento = peso_salida / peso_entrada`.
- **El costo se transfiere completo**: el costo total de la entrada (`peso_entrada × costo_kg_crudo`) pasa al producto procesado → `costo_kg_procesado = costo_total / peso_salida`. **La merma encarece el kg neto.**
- El stock del crudo baja; el del procesado sube con su nuevo costo.

### 4.4 Ventas (pedidos + POS)
- **Pedido agendado**: cliente + fecha de entrega + items con peso estimado y precio/kg pactado.
- Al entregar se **pesa lo real** → se genera factura con los kg entregados.
- **Venta directa**: mismo flujo en un paso (peso real inmediato).
- Precio pactado en USD o Bs; tasa congelada al emitir la factura.
- IVA desglosado: `subtotal + iva (16% default) = total`.

### 4.5 Cobros y pagos (crédito)
- Deuda siempre expresada en USD.
- Abonos parciales permitidos; cada abono registra moneda (USD/Bs) + **tasa del día del pago** + método (efectivo, pago móvil, Zelle, transferencia, punto).
- **Ganancia cambiaria** en Bs: para la porción pagada, `(tasa_pago − tasa_factura) × USD_pagados`. Positiva si el Bs se deprecia.
- Las compras a crédito a proveedores funcionan igual (cuentas por pagar).

### 4.6 COGS y margen
- Cada `factura_item` guarda `costo_usd_kg` snapshot (costo ponderado al vender) → margen real por venta y por producto sin depender de datos históricos mutables.

## 5. Esquema de datos (Postgres/Supabase)

```sql
-- 12 tablas + soporte
tasas               (fecha, fuente bcv|paralela|manual, bs_por_usd)
productos           (codigo, nombre, tipo crudo|procesado, categoria, controla_stock)
clientes            (nombre, rif_ci, telefono, notas, activo)
proveedores         (nombre, rif_ci, telefono, notas, activo)
compras            (proveedor_id, fecha, condicion, moneda, tasa_snapshot, estado, subtotal_usd, pagado_usd)
compra_items       (compra_id, producto_id, peso_kg, costo_usd_kg)
pagos_proveedores  (compra_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo, ganancia_cambiaria_bs)
procesamientos     (fecha, notas)
proceso_items      (procesamiento_id, producto_origen_id, peso_entrada_kg, producto_destino_id, peso_salida_kg, costo_total_usd)
pedidos            (cliente_id, fecha_entrega, estado pendiente|entregado|facturado|anulado)
pedido_items       (pedido_id, producto_id, peso_estimado_kg, peso_entregado_kg, precio_usd_kg)
facturas           (numero, cliente_id, pedido_id?, fecha, condicion, tasa_snapshot, iva_pct, subtotal_usd, iva_usd, total_usd, pagado_usd, estado)
factura_items      (factura_id, producto_id, peso_kg, precio_usd_kg, costo_usd_kg)
pagos              (factura_id, fecha, monto_usd, moneda_pago, tasa_pago, metodo, ganancia_cambiaria_bs)
movimientos        (producto_id, fecha, tipo compra|proceso_in|proceso_out|venta|ajuste, peso_kg, costo_usd_kg, ref_id)  -- ledger auditable
usuarios           (via Supabase Auth; rol admin|operador)
```

Notas:
- `numeric(12,3)` para kg; `numeric(14,6)` para dinero; tasas `numeric(14,6)`.
- Número de factura secuencial por tabla contadora (o secuencia Postgres).
- RLS: `operador` ve todo excepto costos, balances y reportes de margen; `admin` ve todo. (Columnas sensibles en tablas separadas o vistas protegidas.)

## 6. Servicios (SRP)

| Servicio | Responsabilidad única |
|---|---|
| `RateService` | Obtener tasa vigente (API/manual), historial |
| `CostingService` | Promedio ponderado, transferencia de costo en procesamiento, valorización de stock |
| `InvoiceService` | Numeración, totales + IVA, snapshot de tasa y costos |
| `CreditService` | Saldos, abonos, ganancia cambiaria |
| `InventoryService` | Ledger de movimientos, stock actual |

Patrones: **Repository** (interfaces + impl Supabase → DIP, testeable), **Strategy** (condición de pago, fuente de tasa), **Factory** (creación de movimientos del ledger).

## 7. Pantallas (orden de implementación, una por una)

| # | Pantalla | Contenido |
|---|---|---|
| 1 | **Catálogos** | CRUD productos (crudo/procesado, categorías), clientes, proveedores, config (IVA, fuentes de tasa) |
| 2 | **Compras** | Registrar recepción: proveedor, pesar items, costo/kg, moneda, tasa del día, contado/crédito |
| 3 | **Procesamiento** | Lotes: peso entrada → peso salida, merma %, rendimiento, costo resultante |
| 4 | **Pedidos/POS** | Venta directa + pedidos agendados; pesar entrega; emitir factura |
| 5 | **Cobros/Pagos** | Cuentas por cobrar/pagar; registrar abonos con tasa del día y ganancia cambiaria |
| 6 | **Inventario** | Stock por producto, valorización USD/Bs, historial de movimientos |
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
