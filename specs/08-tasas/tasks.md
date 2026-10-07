# Tareas — 08-tasas

Depende de: `01-auth` (rol admin), `04-inventario` (compras y pagos a proveedores) y `05-ventas` (facturas y cobros), todos implementados. **Se ejecuta antes que `07-lotes`** (ver `spec.md`).

Numeración de migraciones: tomar el **primer número libre** al ejecutar (`0018` y `0019` si `07-lotes` todavía no empezó). En ese caso `07-lotes` corre su numeración. Nunca dejar una migración con número menor que otra ya aplicada.

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`.

## Fase A — Esquema

1. **`NNNN_tasas_monedas.sql`**: en `tasas`, renombrar `bs_por_usd` → `valor_bs`; agregar `moneda`, `origen`, `registrada_por`, `publicada_en`; reemplazar el unique `(fecha, fuente)` por `(fecha, fuente, moneda)` y el índice por `(fuente, moneda, fecha desc)`. Las filas existentes quedan `moneda = 'USD'`, `origen = 'manual'` si `fuente = 'manual'` y `'dolarapi'` en otro caso. RLS: quitar `write_all`/`update_all` y crear insert/update solo `es_admin()`. Función `tasa_vigente(p_fecha, p_fuente, p_moneda)` (`stable`, mayor `fecha ≤ p_fecha`).
2. **`NNNN_tasa_operaciones.sql`**: en `compras`, `facturas`, `pagos` y `pagos_proveedores`, agregar `tasa_origen`, `tasa_fuente`, `tasa_referencial`, `tasa_registrada_por` (las filas existentes quedan `referencial` con `tasa_referencial = tasa_snapshot` o `tasa_pago`); check de coherencia; trigger `before insert` que fija `tasa_registrada_por = auth.uid()`. Actualizar las RPC `registrar_compra`, `registrar_pago_proveedor`, `registrar_factura` y `registrar_pago` para que inserten las columnas nuevas desde el JSON (`create or replace`, misma firma). En `config_negocio`, agregar `umbral_desviacion_tasa_pct`.
3. **`src/types/domain.ts`**: `Tasa` (`valor_bs`, `moneda`, `origen`, `registrada_por`, `publicada_en`), `MonedaTasa = 'USD' | 'EUR'`, `OrigenTasa`, `TasaOperacion { tasa_origen; tasa_fuente; tasa_referencial; tasa_snapshot }`, `TasaVigente { tasa; arrastrada: boolean; fecha_valor }`. Actualizar las 14 referencias a `bs_por_usd`.

## Fase B — Obtención

4. **`src/lib/tasas/bcvScraper.ts`**: `parsearPaginaBcv(html)` (pura) + `obtenerTasasBcv()` (fetch con timeout de 10 s, `Agent` de `undici` con el certificado intermedio del BCV si hace falta; **nunca** desactivar la verificación TLS). Guardar un HTML real en `src/lib/tasas/__fixtures__/bcv.html` y dejar `scripts/probar-scraper-bcv.ts` (ejecutable con `npx tsx`) que parsea el fixture y, con `--live`, la página real. **Primero verificar los selectores con la página real**: no se pudo durante la planificación.
5. **`src/lib/tasas/dolarApi.ts`**: `obtenerTasasDolarApi()` → oficial y paralelo de USD y EUR (`/v1/dolares`, `/v1/euros`), validando la forma del JSON con zod. Reemplaza `fetchTasaRemota` de `rateService`.
6. **`services/tasaService.ts`** (reemplaza `rateService.ts`; mantener un re-export temporal si hace falta para no romper imports):
   - `actualizarTasas({ forzar })`: cadena BCV → dolarapi para el oficial y dolarapi para la paralela; controles de sanidad (≤ 0, desvío > 20 % contra la última guardada, discrepancia BCV/dolarapi > 0,5 %); upsert con el cliente admin; devuelve el resultado por fuente y moneda.
   - `getTasaVigente(fecha, fuente, moneda, db)`; `asegurarTasaDeHoy(fuente)`: obtención bajo demanda con deduplicación en memoria y caché de 15 min si falla.
   - `registrarTasaManualDelDia(...)` (admin) y `listTasas(filtros)`.
   - `resolverTasaOperacion(input, fecha, db)`: recalcula la referencial en el servidor, valida la manual y devuelve el `TasaOperacion` final. **La usan todos los servicios que guardan una tasa.**
7. **`app/api/cron/tasas/route.ts`** (verificar en `node_modules/next/dist/docs/` la convención de route handlers de esta versión de Next) + **`vercel.json`** con los cron (ver los horarios y el límite del plan Hobby en `spec.md`) + `CRON_SECRET` en `.env.example`.

## Fase C — Validación y servicios de operaciones

8. **`src/lib/tasaValidation.ts`**: `tasaSchema` compartido (`tasa_origen`, `tasa_fuente`, `tasa > 0`, requerido si es manual) y `desviacionPct(manual, referencial)`. Mensajes nuevos en `validationMessages.ts`.
9. **`compraValidation` / `compraService`**: usar `tasaSchema` y `resolverTasaOperacion`; eliminar `getTasaSugerida` (la reemplaza `getTasaVigente`).
10. **`invoiceService` / `pedidoService` / esquemas de venta**: aceptar la tasa elegida (referencial o manual) en lugar de leer siempre la del día. **Corrige los hallazgos 1, 2 y 5.**
11. **`pagoService` / `compraService.registrarPagoProveedor` / `pagoValidation`**: igual, con la fecha del abono.
12. **Server Actions** de compras, pedidos/POS y cobros: `safeParse` con el esquema actualizado; mapear el aviso "la referencial cambió" a `success` + `info`.

## Fase D — UI

13. **`organisms/TasaSelector.tsx`** (+ `molecules/TasaChip.tsx` para mostrar valor, fuente, fecha valor y si es arrastrada): según `spec.md`. Recibe `fecha` y recalcula la referencial con una Server Action `getTasaVigenteAction` (debounce y `Skeleton` pequeño mientras carga). Registrar ambos en la tabla de componentes de `00-estandares-ui/spec.md`.
14. **Integrar `TasaSelector`** en `CompraForm`, `PedidoForm` (venta directa), `EntregaPedidoDialog`, `RegistrarPagoDialog` y `PagoProveedorDialog`, reemplazando los campos de tasa actuales. Mantener la equivalencia en vivo que ya muestran.
15. **`molecules/TasaIndicador.tsx` en `AppShell`**: el chip de la barra superior (datos desde el layout protegido, en el servidor).
16. **`/tasas`**: `page.tsx` (server: rol + datos), `tasas-screen.tsx`, `loading.tsx`, `error.tsx`; tarjetas vigentes, "Actualizar ahora", `TasaManualDialog` (admin), historial, y la pestaña "Operaciones con tasa manual" (admin). Ítem en `AppShell` (`CurrencyExchangeIcon`).
17. **`ConfigNegocioForm`**: campo "Umbral de desviación de tasa (%)".

## Fase E — Verificación

18. `npm run lint`, `npx tsc --noEmit`, `npm run build`.
19. Aplicar las migraciones en Supabase; comprobar que las tasas existentes quedan `USD` y que un operador ya no puede insertar ni modificar `tasas` por PostgREST.
20. `npx tsx scripts/probar-scraper-bcv.ts --live`: el scraping devuelve USD, EUR y fecha valor coherentes con lo que muestra la página. Si `bcv.gob.ve` no es accesible desde Vercel, confirmar que `actualizarTasas` usa dolarapi y lo registra como origen.
21. Llamar `/api/cron/tasas` sin secreto (debe dar 401) y con secreto (actualiza y devuelve el resumen).
22. **Fin de semana**: con la última tasa del viernes (fecha valor lunes) o del jueves, una venta el sábado propone la tasa arrastrada con su aviso y se puede emitir.
23. Venta con tasa manual 10 % mayor: se guarda con `tasa_origen = 'manual'`, `tasa_referencial` y el usuario. Con una tasa manual de un orden de magnitud distinto, aparece la confirmación.
24. Compra con fecha de ayer: la referencial propuesta es la de ayer.
25. Abono en Bs con tasa manual: la ganancia cambiaria usa la tasa manual.
26. `/tasas` como operador: ve tarjetas e historial, pero no "Actualizar ahora", ni el registro manual, ni las operaciones con tasa manual.
27. Recorrer `checklist.md`.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "07-lotes reescribe registrar_factura — conservar las columnas de tasa — <fecha>")_
- **09-cuentas-por-cobrar (2026-10-07)**: agrega `facturas.fecha_vencimiento` y la pasa en `registrar_factura`. Si este módulo reescribe esa RPC después, **conservar** la columna.
