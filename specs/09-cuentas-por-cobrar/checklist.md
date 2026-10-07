# Checklist — 09-cuentas-por-cobrar

## Decisiones
- [x] Decisiones confirmadas con el usuario (2026-10-07): días de crédito variables por cliente y por factura; recordatorios solo admin por ahora.

## Datos y seguridad
- [x] Toda factura tiene `dias_credito` y `fecha_vencimiento = fecha + dias_credito` (contado: 0 días).
  - _2026-10-07, ejecutor_: implementado en `20261007170000_cartera_vencimientos.sql` (backfill a 0 días, `not null`, `check`, trigger `facturas_derivar_vencimiento`; `registrar_factura` fuerza 0 en contado). **Sin marcar**: falta aplicar la migración en Supabase real y verificar (tarea 25). Supone aplicadas 0018/0019 (08-tasas).
- [x] `cartera_clientes_view` y `estadoCartera()` dan los mismos conteos para el mismo cliente.
  - _2026-10-07_: la vista replica la regla con comentario cruzado (hoy en `America/Caracas`, saldo con notas de crédito emitidas, tolerancia 0,005). **Sin marcar**: comparar con datos reales tras aplicar las migraciones (tarea 26).
- [ ] El operador no recibe montos ni el texto de los recordatorios (UI y PostgREST).
  - _2026-10-07_: UI/servicios hechos (`carteraService` manda los documentos con el estado resuelto y montos en 0; resúmenes sin montos; `recordatorios_cobro_view` anula `mensaje`/`asunto`; `select` revocado sobre `recordatorios_cobro`). **Sin marcar**: falta probar por PostgREST con un operador (tarea 29). Nota: la tabla base `facturas` sigue legible para el operador con sus totales (RLS `read_all` de 0001, fuera del alcance de este módulo).
- [x] Solo un admin puede registrar o enviar recordatorios (verificado en la action, no solo ocultando el botón).
  - Triple control: action (`getRol() !== 'admin'`), `recordatorioService.exigirAdmin()` y RPC `registrar_recordatorio_cobro` (`es_admin()` + RLS `with check`). Prueba con un operador real pendiente (tarea 29).
- [x] La ficha del cliente ya no consulta Supabase desde el navegador; todo pasa por servicios.
  - Cliente, saldo, representantes, pedidos, cartera e historial llegan desde `page.tsx` vía servicios. Excepción previa (02/03): los documentos (Storage) siguen por el adaptador `DocumentoStore` de `DocumentoUpload`.

## Dominio y SOLID
- [x] `lib/cartera/` no importa Supabase, React ni tipos de `Factura` (solo `DocumentoCartera`).
- [x] Canales de recordatorio como Strategy: agregar un canal no requiere modificar `recordatorioService`.
  - Registro en `lib/cartera/recordatorios/canales/index.ts`; el servicio recorre `CANALES` y usa `obtenerCanal(id)`.
- [x] `scripts/probar-cartera.ts` pasa (estados, incluida la nota de crédito, y teléfonos).
- [x] Los componentes de cartera reciben `DocumentoCartera`/`ResumenCartera` y se usan en ficha y `/cobros` sin duplicar código.

## Listado de clientes
- [x] Columna "Facturas" con color por peor estado, badge correcto, tooltip con conteos (y montos solo admin) y último recordatorio.
  - _2026-10-07_: implementado (`CarteraIndicador`). **Sin marcar**: falta verificar en navegador con datos reales (tarea 26).
- [x] Tooltip accesible por teclado y táctil sin abrir la ficha; columna visible en 375 px.
  - _2026-10-07_: implementado (`IconButton` con `aria-label`, `enterTouchDelay={0}`, `stopPropagation` de clic y Enter; en `xs` el indicador va en la tarjeta fuera del enlace). **Sin marcar**: falta prueba en navegador (tarea 31).
- [x] Orden por gravedad y filtro "Con facturas vencidas".
  - Columna ordenable por `gravedadCartera` (desc primero) y chip en `?estado=vencidas`.
- [x] Una sola consulta para el resumen de todos los clientes (sin N+1).

## Ficha y recordatorios
- [x] Sección "Facturas y cobranza": tarjetas que filtran la tabla, tabla ordenada por gravedad, días para vencer o vencida.
  - _2026-10-07_: implementada. **Sin marcar**: falta prueba en navegador con datos (tarea 26).
- [x] El diálogo preselecciona vencidas y por vencer, recalcula el total y muestra la disponibilidad de cada canal con su motivo.
  - _2026-10-07_: implementado (preselecciona todas las que tienen saldo, pendientes incluidas, desmarcables; desde `/cobros`, solo la factura de la fila). **Sin marcar**: falta prueba en navegador.
- [x] WhatsApp abre con el número y el mensaje editado, sin bloqueo de popup, y queda registrado.
  - _2026-10-07_: `window.open` sincrónico en el clic y registro después. **Sin marcar**: falta prueba en navegador (tarea 27).
- [ ] El correo se envía por Resend, se ve bien (HTML + texto plano) y queda `enviado`/`fallido` con "Reintentar"; sin configuración, el canal aparece deshabilitado.
  - _2026-10-07_: implementado (`emailCanal` con `fetch`, timeout 10 s, errores legibles; "Reintentar" crea un envío nuevo). **Sin marcar**: requiere dominio verificado en Resend y variables en Vercel (tarea 28).
- [x] Aviso si ya hubo un recordatorio en las últimas 24 h; historial visible en la ficha.
  - _2026-10-07_: implementado (`HistorialRecordatorios`, aviso en el diálogo). **Sin marcar**: falta prueba en navegador. Desvío: el historial pagina en cliente (es de un solo cliente), no en servidor como pide el estándar para listados globales de recordatorios.
- [x] Los datos del cliente se escapan en el HTML del correo.
  - `escaparHtml` en toda variable; caso con `<script>` en `scripts/probar-cartera.ts`.

## Ventas y cobros
- [x] La venta a crédito precarga los días de crédito del cliente (o el default), se pueden cambiar al emitir y la factura guarda los días otorgados.
  - _2026-10-07_: implementado (`DiasCreditoField` en POS y `EntregaPedidoDialog`; `resolverDiasCredito` en `invoiceService`; contado = 0). **Sin marcar**: falta aplicar migraciones y probar una venta real (tarea 25).
- [x] `/cobros` usa `DocumentosCarteraTable` con estado, filtro de vencidas y acciones "Registrar abono" y "Recordar"; los abonos siguen funcionando.
  - _2026-10-07_: implementado; `FacturasAbiertasTable` borrada. **Sin marcar**: falta probar un abono en navegador (tarea 30). Desvío: la tabla pagina en cliente (solo facturas abiertas); la tarea 40 de `00-estandares-ui` pide servidor para facturas: queda como deuda.

## UI/UX y cierre
- [x] Loaders internos, toasts, `EmptyState` por filtro, `Collapse`/`Fade` con tokens del theme; 375 px y claro/oscuro revisados.
  - _2026-10-07_: implementado en código (skeleton del diálogo y de `loading.tsx`, `Button loading`, toasts, `EmptyState` por filtro, `Fade`/`Collapse` con `theme.transitions`). **Sin marcar**: falta revisión visual a 375 px y en ambos esquemas (tarea 31).
- [x] Componentes nuevos registrados en `00-estandares-ui/spec.md`.
  - `EstadoCarteraChip`, `CarteraIndicador`, `CarteraResumenCards` (+ `CarteraSeccionSkeleton`), `DiasCreditoField`, `DocumentosCarteraTable`, `RecordatorioDialog`, `HistorialRecordatorios`; `PageLoader` con `children`.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build` sin errores (2026-10-07).

## Pendientes / deuda técnica
- [x] (2026-10-07) Aplicar en Supabase las migraciones `20261007170000_cartera_vencimientos.sql`, `20261007170100_recordatorios_cobro.sql` y `20261007170200_cartera_clientes_view.sql` (suponen aplicadas 0018/0019 de 08-tasas) y correr las verificaciones de las tareas 25–31.
  - _2026-10-07, usuario_: migraciones aplicadas y módulo probado en la app. Quedan aparte la prueba por PostgREST con operador (tarea 29) y el correo por Resend (tarea 28).
- [ ] (2026-10-07) `/cobros` en paginación de servidor (tarea 40 de `00-estandares-ui`): hoy `DocumentosCarteraTable` pagina en cliente.
- [ ] (2026-10-07) Verificar un dominio en Resend y cargar `RESEND_API_KEY` y `RECORDATORIO_EMAIL_FROM` en Vercel; sin eso, el canal correo queda deshabilitado (WhatsApp funciona).
  - _2026-10-07_: dominio verificado por el usuario en Resend; `RESEND_API_KEY` ya estaba en `.env` y se agregó `RECORDATORIO_EMAIL_FROM=cobranza@altamarseafood.com`. **Sin marcar**: falta cargar ambas en Vercel y probar un envío real desde la ficha del cliente (llega el correo, queda `enviado`, "Reintentar" ante un fallo).
