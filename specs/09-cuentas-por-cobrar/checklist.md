# Checklist — 09-cuentas-por-cobrar

## Decisiones
- [x] Decisiones confirmadas con el usuario (2026-10-07): días de crédito variables por cliente y por factura; recordatorios solo admin por ahora.

## Datos y seguridad
- [ ] Toda factura tiene `dias_credito` y `fecha_vencimiento = fecha + dias_credito` (contado: 0 días).
- [ ] `cartera_clientes_view` y `estadoCartera()` dan los mismos conteos para el mismo cliente.
- [ ] El operador no recibe montos ni el texto de los recordatorios (UI y PostgREST).
- [ ] Solo un admin puede registrar o enviar recordatorios (verificado en la action, no solo ocultando el botón).
- [ ] La ficha del cliente ya no consulta Supabase desde el navegador; todo pasa por servicios.

## Dominio y SOLID
- [ ] `lib/cartera/` no importa Supabase, React ni tipos de `Factura` (solo `DocumentoCartera`).
- [ ] Canales de recordatorio como Strategy: agregar un canal no requiere modificar `recordatorioService`.
- [ ] `scripts/probar-cartera.ts` pasa (estados, incluida la nota de crédito, y teléfonos).
- [ ] Los componentes de cartera reciben `DocumentoCartera`/`ResumenCartera` y se usan en ficha y `/cobros` sin duplicar código.

## Listado de clientes
- [ ] Columna "Facturas" con color por peor estado, badge correcto, tooltip con conteos (y montos solo admin) y último recordatorio.
- [ ] Tooltip accesible por teclado y táctil sin abrir la ficha; columna visible en 375 px.
- [ ] Orden por gravedad y filtro "Con facturas vencidas".
- [ ] Una sola consulta para el resumen de todos los clientes (sin N+1).

## Ficha y recordatorios
- [ ] Sección "Facturas y cobranza": tarjetas que filtran la tabla, tabla ordenada por gravedad, días para vencer o vencida.
- [ ] El diálogo preselecciona vencidas y por vencer, recalcula el total y muestra la disponibilidad de cada canal con su motivo.
- [ ] WhatsApp abre con el número y el mensaje editado, sin bloqueo de popup, y queda registrado.
- [ ] El correo se envía por Resend, se ve bien (HTML + texto plano) y queda `enviado`/`fallido` con "Reintentar"; sin configuración, el canal aparece deshabilitado.
- [ ] Aviso si ya hubo un recordatorio en las últimas 24 h; historial visible en la ficha.
- [ ] Los datos del cliente se escapan en el HTML del correo.

## Ventas y cobros
- [ ] La venta a crédito precarga los días de crédito del cliente (o el default), se pueden cambiar al emitir y la factura guarda los días otorgados.
- [ ] `/cobros` usa `DocumentosCarteraTable` con estado, filtro de vencidas y acciones "Registrar abono" y "Recordar"; los abonos siguen funcionando.

## UI/UX y cierre
- [ ] Loaders internos, toasts, `EmptyState` por filtro, `Collapse`/`Fade` con tokens del theme; 375 px y claro/oscuro revisados.
- [ ] Componentes nuevos registrados en `00-estandares-ui/spec.md`.
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build` sin errores.

## Pendientes / deuda técnica
- [ ] (2026-10-07) Verificar un dominio en Resend y cargar `RESEND_API_KEY` y `RECORDATORIO_EMAIL_FROM` en Vercel; sin eso, el canal correo queda deshabilitado (WhatsApp funciona).
