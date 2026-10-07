# Checklist — 08-tasas

## Obtención
- [x] El scraping del BCV obtiene USD, EUR y fecha valor (selectores verificados contra la página real, con fixture guardado). Verificado el 2026-10-07 con fixture y `--live` (usd=873.867, eur=984.26261811, fechaValor=2026-10-07). Dominio real: `www.bcv.org.ve` (`bcv.gob.ve` no resuelve DNS).
- [x] La conexión TLS al BCV funciona **sin** desactivar la verificación de certificados (CA intermedia de Sectigo vía `Agent` de undici; `rejectUnauthorized` siempre activo).
- [x] Si el BCV falla o no es accesible, se usa dolarapi automáticamente y el origen queda registrado (`tasaService.actualizarTasas`: cadena BCV → dolarapi, origen `dolarapi` con `fallo_con_respaldo`).
- [x] La paralela (USD y EUR) se obtiene de dolarapi (confirmado en la respuesta del cron: `origen: dolarapi`).
- [x] Los controles de sanidad descartan valores absurdos (≤ 0, desvío > 20 %) y registran el error (observado en vivo: descartó USD por desvío contra la última guardada del esquema viejo).
- [x] El cron está protegido con `CRON_SECRET` y escribe con `service_role` solo desde el servidor (verificado en runtime: 401 sin secreto y con secreto inválido, 200 con secreto correcto; cliente admin solo en servidor).
- [x] La obtención bajo demanda no consulta la fuente en cada render (deduplicación + caché si falla) (`asegurarTasaDeHoy` en `tasaService`).

## Datos y seguridad
- [x] `tasas` tiene `valor_bs`, `moneda`, `origen`; unique `(fecha, fuente, moneda)` (migración `0018_tasas_monedas.sql` escrita; backfill a `USD` incluido). Falta aplicarla en Supabase: ver Pendientes.
- [ ] Un operador no puede insertar ni modificar tasas (UI ni PostgREST). RLS solo-admin en `0018` escrita, migraciones aplicadas el 2026-10-07; falta la prueba real vía PostgREST.
- [x] `tasa_vigente` usa la de mayor fecha ≤ X: fines de semana y feriados funcionan con la tasa arrastrada (función en `0018` + `getTasaVigente` en `tasaService`). El escenario real de fin de semana queda en Pendientes (tarea 22).
- [x] Compras, facturas, cobros y pagos a proveedores guardan `tasa_origen`, `tasa_fuente`, `tasa_referencial` y `tasa_registrada_por` (fijado por trigger) (migración `0019_tasa_operaciones.sql`).
- [x] La historia no se recalcula: corregir la tasa de un día no cambia operaciones ya registradas (las operaciones guardan snapshot propio; nada en el módulo toca filas existentes).

## Operaciones
- [x] Compra, venta directa, entrega de pedido, cobro y pago a proveedor ofrecen la referencial por defecto y permiten una manual (`TasaSelector` integrado en los 5 forms, Fase D).
- [x] La referencial propuesta corresponde a la **fecha de la operación**, no siempre a hoy (`TasaSelector` recalcula al cambiar la fecha; `resolverTasaOperacion` usa la fecha de la operación).
- [x] La tasa manual > 0 se valida en zod, servicio y base; una desviación sobre el umbral pide confirmación (`tasaValidation.tasaSchema` + check en `0019` + `ConfirmDialog` en `TasaSelector` con `umbral_desviacion_tasa_pct`).
- [x] El servidor recalcula la referencial y no confía en el valor que envía el cliente (`resolverTasaOperacion` en `tasaService`; lo usan compra/invoice/pedido/pago).
- [x] El POS ya no falla con "No hay tasa registrada hoy" (hallazgos 1, 2 y 5 corregidos en código: `invoiceService` acepta la tasa elegida, `getTasaVigente` arrastra, `TasaSelector` permite manual). Prueba end-to-end con la app corriendo queda en Pendientes.

## UI/UX
- [x] Indicador de tasas en la barra superior con tooltip y aviso de tasa arrastrada; responsive (`TasaIndicador` en `AppShell`, Fase D).
- [x] `/tasas`: tarjetas vigentes con variación y origen, "Actualizar ahora" con loader y toast por fuente, registro manual del día (admin), historial filtrable, operaciones con tasa manual (admin) (Fase D).
- [x] `TasaSelector` con `Collapse` en el campo manual, diferencia % en vivo y equivalencia Bs ↔ USD (Fase D).
- [ ] `loading.tsx`/`error.tsx`/`EmptyState`; modo claro y oscuro y 375 px revisados. Implementados en Fase D; falta la **revisión visual** en 375 px en ambos modos.

## Cierre
- [x] `/SPEC.md` §2 y §5 actualizados (fuentes BCV/dolarapi/manual con `www.bcv.org.ve`, EUR de referencia, tasa vigente por fecha valor, procedencia de la tasa por operación, RLS tasas solo admin, `tasaService` reemplaza `rateService`).
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores (verificado el 2026-10-07).

## Pendientes / deuda técnica
- [x] **(2026-10-07)** Aplicar `supabase/migrations/0018_tasas_monedas.sql` y `0019_tasa_operaciones.sql` en Supabase (el usuario las aplica por SQL Editor). Tras aplicar: verificar que las tasas existentes quedan `moneda = 'USD'` y que las filas viejas de operaciones quedan `referencial` con `tasa_referencial = tasa_snapshot`. _(Aplicadas; confirmado por el usuario el 2026-10-07. La comprobación de datos posterior queda en la tarea 19 y en los escenarios 22–26.)_
- [ ] **(2026-10-07)** Prueba RLS como operador vía PostgREST: insert/update en `tasas` debe fallar con rol `authenticated` operador (tarea 19).
- [ ] **(2026-10-07)** Cron real en Vercel: desplegar `vercel.json` (horarios corregidos el 2026-10-07 a 21:30 UTC y 12:00 UTC según `spec.md`; antes estaba 17:00 UTC, antes de la publicación del BCV) y configurar `CRON_SECRET` en el entorno de producción; confirmar que la ejecución diaria actualiza (tarea 21 en producción).
- [ ] **(2026-10-07)** Escenarios con la app corriendo y migraciones aplicadas (tareas 22–26): venta en fin de semana con tasa arrastrada y su aviso; venta con tasa manual 10 % mayor (queda `manual` + `tasa_referencial` + usuario) y confirmación con desvío de un orden de magnitud; compra con fecha de ayer propone la referencial de ayer; abono en Bs con tasa manual usa esa tasa para la ganancia cambiaria; `/tasas` como operador sin acciones de admin.
- [ ] **(2026-10-07)** Revisión visual de `/tasas` y `TasaSelector` en 375 px, modo claro y oscuro.