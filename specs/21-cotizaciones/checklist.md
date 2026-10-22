# Checklist — 21-cotizaciones

## Decisiones
- [x] P1–P10 de `spec.md` respondidas por el usuario y pasadas a decisiones cerradas el 2026-10-22 (P1 sin Bs ni tasas, IVA opcional; P7 sin gracia y con páginas de respaldo; el resto con la recomendación). `spec.md` y `tasks.md` actualizados el mismo día.
- [ ] El módulo no reabre `/SPEC.md` §2: la cotización no mueve stock, no reserva lotes, no genera deuda ni factura, no guarda costos y no usa tasas de cambio.
- [ ] `/SPEC.md` (§5, §7) con nota del 2026-10-22; `specs/README.md` con orden, dependencias y cambio de alcance; tareas agregadas anotadas en `04-inventario/tasks.md`, `00-estandares-ui/tasks.md` y (si hubo Fase D) `05-ventas/tasks.md`.

## Datos y seguridad (migraciones + RLS)
- [ ] Migraciones nuevas e incrementales (`20261022100000`, `…100100` y `…100200`), aplicadas en orden. No se editó ninguna aplicada.
- [ ] `cotizaciones`, `cotizacion_items` y las columnas nuevas de `config_negocio` en `snake_case` y español, con columnas, checks e índices de `spec.md`; dinero `numeric(14,6)`, kg `numeric(12,3)`.
- [ ] Numeración por secuencia `cotizaciones_numero_seq` (P3), sin colisiones con dos altas simultáneas.
- [ ] RLS: `cotizaciones` `select`/`update` a `authenticated`, `cotizacion_items` solo `select`; sin `insert`/`delete` directos; `anon` sin acceso a tablas ni a `cotizaciones_listado_view` (`security_invoker`).
- [ ] `guardar_cotizacion` `security definer` con sesión exigida, atómica, calcula importes en SQL y reemplaza líneas; `update` directo de importes o cliente falla con `usar_guardar_cotizacion`.
- [ ] `cotizaciones_guard`: transiciones de `spec.md`, terminales inmutables, `vencida` no se acepta sin renovar, `numero`/`created_*` inmutables; cada versión (A, C, D) conserva las reglas anteriores.
- [ ] `cotizacion_publica` es la única puerta anónima: `security definer`, `grant` a `anon`; `disponible` solo con `hoy ≤ fecha_vencimiento` y solo campos públicos (sin `notas_internas`, `cliente_telefono`, ids ni usuarios); `vencida` (sin gracia, P7) solo con número y contacto del negocio; `no_disponible` idéntico para token inexistente, regenerado, revocado, borrador o anulada, sin datos de la cotización.
- [ ] Token de 32 caracteres `base64url` generado en el servidor (`crypto.randomBytes`); regenerar invalida el anterior; revocar y anular lo ponen en `null`.

## Reglas de negocio
- [ ] Totales: `subtotal − descuento + IVA` con el redondeo de `lib/facturas/totales.ts`; paridad TS ↔ SQL en 200 casos.
- [ ] IVA precargado con `clientes.aplica_iva` (18) y editable por cotización; sin IVA = `iva_pct` 0.
- [ ] Solo USD (P1): sin columnas de tasa, sin llamadas a `tasaService` y ningún importe en Bs en ficha, formulario, PDF ni página pública.
- [ ] IVA opcional por cotización (P1): interruptor precargado con `clientes.aplica_iva` y editable; sí = `iva_pct` de config, no = 0.
- [ ] Cliente registrado xor libre; bloqueado cotizable con aviso.
- [ ] Precio precargado según P9 y editable; producto inactivo rechazado.
- [ ] Estados guardados y `vencida` derivada (hoy de Caracas); renovar, duplicar, aceptar, rechazar y anular según `spec.md`.
- [ ] Compartir marca `enviada` un borrador (P10); cancelar la hoja de compartir no lo marca.
- [ ] Casos de la tarea 26 con las cifras esperadas ($174; $150 sin IVA; sin Bs).
- [ ] Una vencida no se acepta ni se comparte sin renovar; renovar conserva el enlace y lo vuelve a mostrar.
- [ ] (Fase D, P8) Conversión en pedido una sola vez, solo aceptada con cliente registrado; la cotización convertida no se anula.

## PDF
- [ ] `@react-pdf/renderer` en route handlers de Node, detrás de `ICotizacionPdfRenderer`; sin dependencias nuevas (P6).
- [ ] Identidad de Altamar Sea Food: isotipo, franjas de la borda, `brand.hull`, Barlow (o Helvetica de respaldo documentado); hex solo desde `src/theme/marca.ts`.
- [ ] Contenido de «PDF» en `spec.md`; números con `lib/format.ts`; varias páginas sin cortar filas; nunca incluye notas internas.
- [ ] Respuestas `application/pdf` con `no-store`, nombre `cotizacion-COT-000123.pdf`, `inline`/`attachment`; interno: anulada → 404; público: solo `disponible`, el resto redirige a `/c/[token]` sin generar PDF.

## Enlace público y compartir
- [ ] `/c/[token]` y `/c/[token]/pdf` accesibles sin sesión (matcher de `proxy.ts`), sin exponer rutas internas; las demás rutas siguen protegidas.
- [ ] Página pública con `DocumentoPublicoLayout`: vigente → documento, banner si aceptada/rechazada y «Descargar PDF»; vencida → respaldo con marca y WhatsApp al negocio, sin datos ni PDF; revocada/anulada/inexistente → respaldo genérico idéntico que no revela nada. `robots` noindex, `Referrer-Policy: no-referrer`, metadatos sin montos.
- [ ] Compartir una vencida pide renovarla antes.
- [ ] Web Share con archivo solo si `navigator.canShare({ files })`; WhatsApp por `wa.me` con `telefonoAWhatsApp` y fallback sin número; ambas en el mismo gesto del clic; «Copiar enlace» y «Descargar PDF» siempre disponibles.
- [ ] `SITE_URL` configurada en Vercel; el enlace copiado usa el dominio de producción.

## Repositorios y servicios
- [ ] `ICotizacionRepository` e `ICotizacionPublicaRepository` (+ impl Supabase) solo acceden y mapean; sin lógica de negocio.
- [ ] `cotizacionService`, `cotizacionPdfService`, `cotizacionPublicaService` y `cotizacionPedidoService` (Fase D) con la lógica; sesión exigida en los internos; `hint` mapeados a campos.
- [ ] Funciones puras (`lib/cotizaciones/*`, `lib/pdf/*` sin I/O salvo el registro de fuentes) sin imports de Supabase ni React DOM; `scripts/probar-cotizaciones.ts` (con `--sql` y `--pdf`) pasa.
- [ ] Validación zod en `src/lib/cotizacionValidation.ts` y `configValidation.ts`; mensajes en `validationMessages.ts`.

## UI (Atomic Design y `00-estandares-ui`)
- [ ] `page.tsx` solo componen organisms/templates; `/cotizaciones`, `/cotizaciones/[id]` con `loading`, `error` y `not-found`.
- [ ] Ítem de menú «Cotizaciones» visible para admin y operador (P4).
- [ ] `CotizacionesTable` en `AppDataGrid` con paginación en servidor y `mobileCard`; filtros `?estado=`, `?q=`, `?desde`/`?hasta` y página en la URL.
- [ ] Diálogos en `AppDialog` (`CotizacionForm` md `fullScreen` en `xs`); `useForm({ disabled })`, `Button loading`, cierre protegido con `dirty`; ficha con `FichaHeader`.
- [ ] Confirmaciones con `useConfirm` y toasts con `useNotify` (nunca `window.alert`/`confirm`); `EmptyState`/`ErrorState`.
- [ ] Números con `lib/format.ts`, cifras tabulares, montos a la derecha; colores solo del theme.
- [ ] Componentes genéricos nuevos registrados en «Componentes compartidos» de `00-estandares-ui/spec.md` (`DocumentoPublicoLayout`, `lib/pdf/marca.tsx`, `src/theme/marca.ts`).
- [ ] Modo claro/oscuro y responsive (375/768/1024/1440), incluida la página pública y el PDF abierto en móvil.

## Tipos y calidad
- [ ] Tipos de la spec en `src/types/domain.ts`, sin `any` sin justificar.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores.

## Pendientes / deuda técnica
- _(anotar aquí con fecha lo que se difiera, sin borrar ítems)_
