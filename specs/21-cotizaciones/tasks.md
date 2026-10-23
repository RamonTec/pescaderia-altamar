# Tareas — 21-cotizaciones

Ejecutar en orden. Cada tarea indica archivos y criterio de hecho.

Depende de: `02-clientes`, `04-inventario`, `18-iva-opcional` y `00-estandares-ui` Fase 2 (hechos); reutiliza piezas de `06-contratos` y `09-cuentas-por-cobrar`. La Fase D usa `05-ventas`. No depende de `20-gastos`, pero usa su función `fija_auditoria()` (Fase A de 20, ya aplicada). Cambia `config_negocio` (tarea agregada el 2026-10-22 en `04-inventario/tasks.md`) y extrae constantes de marca compartidas (tarea agregada el 2026-10-22 en `00-estandares-ui/tasks.md`).

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`. Ninguna migración aplicada se edita. Prefijo timestamp ≥ `20261022100000` (después de las reservadas por 20-gastos, `20261022000000`–`20261022000300`).

**Decisiones**: todas cerradas. P1–P10 respondidas por el usuario el 2026-10-22 (ver `spec.md`): ocho con la recomendación; **P1** sin equivalente en Bs ni tasas (IVA opcional por cotización) y **P7** sin gracia: vencida → página de respaldo sin datos ni PDF; revocada/anulada → respaldo genérico. P8 aprobada: la Fase D se ejecuta. No hay bloqueos de decisión.

Entrega por fases: cada fase deja la app compilando y usable y puede ir en un PR propio contra `main`. Planificación en su propio commit: `docs(specs): planificar 21-cotizaciones` (rama `docs/cotizaciones`).

## Fase A — Esquema, cotizaciones, listado y ficha

Rama sugerida `feat/cotizaciones-base`; commits `feat(cotizaciones): esquema y RPC de guardado` (solo la migración), `feat(cotizaciones): listado, ficha y formulario`.

1. **`supabase/migrations/20261022100000_cotizaciones_esquema.sql`**:
   - `config_negocio` + `cotizacion_validez_dias` (default 7, 1–90) y `cotizacion_terminos` (≤ 2000).
   - Secuencia `cotizaciones_numero_seq`; tablas `cotizaciones` y `cotizacion_items` con columnas, checks e índices de `spec.md` **sin** `token_*` (Fase C) ni `pedido_id` (Fase D); `fija_auditoria()` (de 20) en `cotizaciones`.
   - Trigger `cotizaciones_guard` (transiciones, inmutables, `enviada_*`/`respondida_*`/`anulada_*`, `cotizacion_vencida`, columnas que solo fija la RPC con `current_user = 'authenticated'` → `usar_guardar_cotizacion`).
   - RPC `guardar_cotizacion(uuid, jsonb, jsonb)` (`security definer`, valida, copia `producto_nombre`, calcula importes en SQL, reemplaza líneas, `for update` al editar).
   - Vista `cotizaciones_listado_view` (`security_invoker = true`, `estado_efectivo` con hoy de Caracas).
   - RLS de `spec.md`: `cotizaciones` `select`/`update` a `authenticated`; `cotizacion_items` solo `select`; `revoke all … from anon`; `revoke delete, truncate … from authenticated`; `grant execute` de la RPC a `authenticated`, `revoke … from public, anon`.
   - Hecho (Postgres local, método del checklist de 20): crear como operador por la RPC funciona y el total cuadra a mano; `insert` directo falla; `update` directo de `total_usd` → `usar_guardar_cotizacion`; `aceptada → borrador` → `transicion_invalida`; editar una aceptada por la RPC → `cotizacion_inmutable`; `anon` no lee la tabla ni la vista; descuento > subtotal → `descuento_mayor_subtotal`.
2. **`src/types/domain.ts`**: `EstadoCotizacion`, `EstadoEfectivoCotizacion`, `Cotizacion`, `CotizacionItem`, `CotizacionListado`, `CotizacionDetalle`, `CotizacionInput`, `TotalesCotizacion`; `ConfigNegocio` + `cotizacion_validez_dias`, `cotizacion_terminos`. Sin `any`.
3. **Dominio puro y validación**:
   - `src/lib/cotizaciones/totales.ts`: `totalesCotizacion(items, descuento, ivaPct)` reutilizando `subtotalItems`, `ivaSobre`, `redondea6` de `src/lib/facturas/totales.ts` (P2).
   - `src/lib/cotizaciones/estado.ts`: `estadoEfectivo(c, hoy)`, `accionesPermitidas(estadoEfectivo, tienePedido)` (espejo del guard).
   - `src/lib/cotizaciones/numero.ts`: `formatNumeroCotizacion(n)` → `COT-000123`; `parseBusquedaNumero(q)` (`cot123`, `COT-000123`, `123` → 123).
   - `src/lib/cotizacionValidation.ts`: `cotizacionFormSchema` (cliente registrado xor libre, 1–50 líneas, kg > 0 con 3 dec., precio ≥ 0, descuento ≤ subtotal, validez 1–90, fecha ≤ hoy, textos con sus topes), `responderCotizacionSchema`, `anularCotizacionSchema`. Mensajes en `src/lib/validationMessages.ts`.
4. **`scripts/probar-cotizaciones.ts`** (`npx tsx`, `process.exit(1)` si falla): totales con y sin IVA, con descuento, redondeo a 6 y paridad TS ↔ SQL de `guardar_cotizacion` en 200 casos con `--sql`; `estadoEfectivo` (vence hoy = vigente, ayer = vencida; aceptada nunca vencida); `parseBusquedaNumero`; esquemas (cliente vacío, 0 líneas, descuento mayor).
   - Hecho: el script pasa.
5. **Repositorio** (`src/lib/repositories/interfaces.ts`, `cotizacionRepository.ts`): `ICotizacionRepository` con `listar({ estado, q, desde, hasta, pagina, tamano })` sobre la vista con `.range()` + `count`, `getDetalle(id)` (cabecera + líneas + cliente + nombres de usuarios de `perfiles`), `guardar(id | null, cabecera, items)` → RPC, `cambiarEstado(id, patch)`. Solo acceso y mapeo `numeric → number`; `hint` tal cual.
6. **Servicio** (`src/lib/services/cotizacionService.ts`): sesión requerida (admin u operador, P4); `guardarCotizacion` resuelve `iva_pct` con `ivaPctVenta` según el interruptor (P1; sin tasas), precarga validez y términos desde config al crear; `listarCotizaciones`, `getCotizacion`, `marcarEnviada` (no-op si no es borrador), `aceptar`, `rechazar`, `anular`, `renovar`, `duplicar`. Mapeo de `hint` a campos (`cliente_requerido` → `cliente_id`, `producto_inactivo` → `items.N.producto_id`, `descuento_mayor_subtotal` → `descuento_usd`, `fecha_futura` → `fecha`; el resto al `Alert`).
   - Hecho: sin sesión falla antes de tocar Supabase; una cotización de cliente con `aplica_iva = false` nace con `iva_pct = 0`.
7. **Organisms de lectura y estado**: `organisms/CotizacionDocumento` (vista de solo lectura: cliente, líneas, totales en USD, notas y términos; reutilizable en la ficha y en la página pública de la Fase C, sin datos internos por prop), `organisms/CotizacionesTable` (`AppDataGrid` servidor, `mobileCard`, `⋮` según `accionesPermitidas`), `ResponderCotizacionDialog`, `AnularCotizacionDialog`. Chip de estado con `StatusChips`/`Chip` del theme (vencida en `warning`, anulada en `default`, aceptada `success`, rechazada `error`).
8. **`CotizacionForm` + `molecules/CotizacionItemsFieldArray`**: modos `crear` / `editar` / `duplicar` / `renovar`; conmutador cliente registrado/libre; precio precargado con `precio_referencia_usd_kg` (P9); interruptor de IVA precargado con `aplica_iva` y editable (P1); totales en vivo con `totalesCotizacion`, solo USD; aviso de cliente bloqueado; `useForm({ disabled })`, `Button loading`, `dirty`, `fullScreen` en `xs` (lo da `AppDialog md`).
9. **Rutas y menú**:
   - `src/app/(protected)/cotizaciones/`: `page.tsx` server (sesión; `searchParams` como `Promise`, ver `node_modules/next/dist/docs/`), `cotizaciones-screen.tsx` (chips `?estado=`, búsqueda `?q=`, rango, página en URL), `actions.ts` (`safeParse` → servicio → `ActionState` + `revalidatePath`), `loading.tsx` (`PageLoader table`), `error.tsx`.
   - `src/app/(protected)/cotizaciones/[id]/`: `page.tsx`, `cotizacion-ficha.tsx` (`FichaHeader`, secciones de `spec.md` salvo «Enlace público», que llega en C), `actions.ts`, `loading.tsx` (`PageLoader ficha`), `error.tsx`, `not-found.tsx`.
   - `NAV_ITEMS` de `src/components/templates/AppShell.tsx`: `/cotizaciones` con `RequestQuoteOutlined`, sin `adminOnly` (P4), junto a Pedidos.
   - Hecho: como operador se crea una cotización de 3 líneas con descuento, se edita, se marca aceptada y se duplica; el total del listado = total de la ficha; filtros y búsqueda por `cot12` persisten al volver de la ficha.
10. **Tarea agregada en 04 (config)**: `ConfigNegocioForm` con `FormSection` «Cotizaciones» (validez en días, términos por defecto), `configFormSchema` y `configRepository` con los dos campos. Anotada en `specs/04-inventario/tasks.md`.
    - Hecho: cambiar la validez a 10 hace que una cotización nueva venza a los 10 días.

## Fase B — PDF con la identidad de la marca

Rama sugerida `feat/cotizaciones-pdf`; commits `refactor(marca): constantes de marca compartidas`, `feat(cotizaciones): PDF de la cotización`.

11. **Tarea agregada en 00 (marca compartida)**: `src/theme/marca.ts` exporta los hex de la paleta `brand` del modo claro (`hull`, `ochre`, `trim`, `red`) y `src/lib/marca/isotipo.ts` las coordenadas del isotipo (`viewBox`, `path` del casco y `polygon` de las franjas). `theme.ts`, `atoms/BrandMark` y `src/app/icon.svg` (comentario) pasan a usar esas fuentes sin cambiar el resultado visual. Anotada en `specs/00-estandares-ui/tasks.md`.
    - Hecho: `BrandMark` se ve idéntico en claro/oscuro; `rg '#0E4A5C' src` solo aparece en `marca.ts` (y en el dark si aplica).
12. **PDF base de marca** (P6): `src/lib/pdf/fuentes/` con Barlow 400/600 y Barlow Condensed 600 (TTF, licencia OFL incluida), `src/lib/pdf/fuentes.ts` (`registrarFuentesMarca()` idempotente con `Font.register` y ruta absoluta vía `path.join(process.cwd(), …)`; si falla, Helvetica) y `src/lib/pdf/marca.tsx` (`EncabezadoMarca`: isotipo con `Svg`/`Path`/`Polygon` de react-pdf + nombre + datos del negocio + franjas de la borda; `PiePagina` con número de página). Verificar que `next build` incluya los TTF en el bundle del servidor (`outputFileTracingIncludes` en `next.config.ts` si hace falta; ver `node_modules/next/dist/docs/`).
13. **Plantilla y servicio**: `DatosCotizacionPdf` en `domain.ts`; `src/lib/cotizaciones/pdf/CotizacionPdf.tsx` (contenido de «PDF» en `spec.md`, formato con `lib/format.ts`, tabla que parte página sin cortar filas, solo USD sin Bs — P1); `src/lib/services/cotizacionPdfService.ts` con `ICotizacionPdfRenderer` (Strategy) e implementación `renderToBuffer`; `datosPdfDesdeDetalle(detalle, config)` puro.
14. **Entrega interna**: `src/app/(protected)/cotizaciones/[id]/pdf/route.ts` (sesión; `z.uuid()`; 404 si no existe o anulada; `inline` o `attachment` con `?descargar=1`; `Cache-Control: no-store`). «Descargar PDF» en el `⋮` del listado y de la ficha (enlace directo en el mismo clic, patrón de 06). `scripts/probar-cotizaciones.ts --pdf` renderiza un PDF de 60 líneas a `/tmp` y verifica que empieza con `%PDF`.
    - Hecho: el PDF abre en Chrome y en el visor de Android, con la marca, Barlow, 2 páginas para 60 líneas, totales iguales a la ficha; una cotización sin IVA dice «Sin IVA».

## Fase C — Enlace público y compartir

Rama sugerida `feat/cotizaciones-compartir`; commits `feat(cotizaciones): enlace público con token`, `feat(cotizaciones): compartir por WhatsApp y Web Share`.

15. **`supabase/migrations/20261022100100_cotizaciones_enlace_publico.sql`**: columnas `token_publico` (unique, check 32), `token_generado_at`, `token_generado_por`; check `cotizaciones_token_estado`; `create or replace` de `cotizaciones_guard` (anular pone el token en `null`; el token se puede cambiar en `aceptada`/`rechazada`; conserva todo lo de la Fase A); RPC `cotizacion_publica(text)` según `spec.md` (P7: `negocio` siempre + `resultado` `disponible` / `vencida` / `no_disponible`, sin gracia) con `grant execute … to anon, authenticated` y `revoke … from public`.
    - Hecho (Postgres local): como `anon`, token vigente → `disponible` sin `notas_internas` ni ids; `fecha_vencimiento` = ayer (enviada o aceptada) → `vencida` solo con `numero` y `negocio` (sin fechas, cliente, líneas ni importes); `fecha_vencimiento` = hoy → `disponible`; token inexistente, regenerado (el viejo), revocado, borrador o anulada → `no_disponible` con solo `negocio`, idéntico en los cinco casos; `select` directo de `cotizaciones` como `anon` → `42501`.
16. **Acceso público y enlace**: `src/lib/supabase/anon.ts` (`createAnonClient()` sin cookies, solo servidor); `CotizacionPublica` en `domain.ts`; `ICotizacionPublicaRepository` + `cotizacionPublicaRepository.ts` (llama a la RPC); `cotizacionPublicaService.ts` (`getPorToken` → unión discriminada `disponible` / `vencida` / `no_disponible`; un token con formato inválido da `no_disponible` sin llamar a la base, pero sí lee el contacto del negocio); en `cotizacionService`: `crearEnlace` (si no hay), `regenerarEnlace`, `revocarEnlace` con `crypto.randomBytes(24).toString('base64url')`; `src/lib/cotizaciones/enlace.ts` (`urlPublica(token, base)` con `SITE_URL` y respaldo del `origin`).
17. **Ruta pública**:
    - `proxy.ts`: excluir `c/` del matcher; comprobar que `/cotizaciones`, `/catalogos`, `/clientes`, `/cobros`, `/compras` y `/contratos` siguen protegidas.
    - `templates/DocumentoPublicoLayout` (marca + franjas, sin `AppShell`).
    - `organisms/CotizacionNoDisponible` (variantes `vencida` y `generica`, con marca y botón de WhatsApp al negocio con los mensajes de `spec.md`; sin datos de la cotización salvo el número en `vencida`). Mensajes puros en `src/lib/cotizaciones/mensaje.ts` (`mensajeCotizacionVencida`, `mensajeCotizacionGenerica`).
    - `src/app/c/[token]/`: `layout.tsx`, `page.tsx` (dinámica; por `resultado`: `disponible` → `CotizacionDocumento` de la tarea 7 con banner si aceptada/rechazada, «Descargar PDF» y WhatsApp al negocio; `vencida` / `no_disponible` → `CotizacionNoDisponible`; `generateMetadata` con `robots` noindex, sin montos y sin número en los respaldos), `not-found.tsx` con la variante genérica, `pdf/route.ts` (solo `disponible` genera el PDF; cualquier otro resultado → 302 a `/c/[token]`; `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `no-store`).
    - Hecho: en una ventana privada (sin sesión) un enlace vigente muestra la cotización y descarga el PDF; al cambiar `fecha` para que venza ayer, la página muestra el respaldo «venció» con WhatsApp al negocio y `/c/[token]/pdf` redirige a la página sin descargar nada; tras revocar o anular, y con un token alterado, se ve el mismo respaldo genérico (HTML idéntico salvo el token); sin redirección a `/login`.
18. **Compartir** (P10): `src/lib/cotizaciones/mensaje.ts` (`mensajeWhatsAppCotizacion`, puro, con casos en el script); `organisms/CompartirCotizacionDialog` según `spec.md` (vencida → pide renovar y no comparte; Server Action `prepararEnvio`, PDF precargado como `File`, `navigator.canShare({ files })`, `navigator.share` y `window.open(urlWhatsApp(…))` **en el mismo gesto del clic**, `AbortError` ignorado, `marcarEnviada` en segundo plano, `CopyableText`, descarga). Primario «Compartir» en la ficha y `⋮` del listado.
    - Hecho: en Android (Chrome) «Compartir PDF» abre la hoja del sistema con el archivo y se puede elegir WhatsApp; en escritorio no aparece y «Enviar por WhatsApp» abre `wa.me` con el número del cliente y el enlace; sin móvil válido abre `wa.me/?text=`; el borrador pasa a «Enviada».
19. **Sección «Enlace público» en la ficha**: URL con `CopyableText`, generado por/cuándo, Crear / Regenerar / Revocar con `useConfirm` («El enlace anterior dejará de funcionar»), «Ver como el cliente»; ícono de enlace en `CotizacionesTable`; aviso «Actualizada después de enviar» cuando `updated_at > enviada_at`.

## Fase D — Convertir en pedido (P8 aprobada el 2026-10-22)

Rama sugerida `feat/cotizaciones-pedido`; commit `feat(cotizaciones): convertir cotización aceptada en pedido`.

20. **`supabase/migrations/20261022100200_cotizaciones_pedido.sql`**: `cotizaciones.pedido_id uuid null unique references pedidos`; `cotizaciones_guard` (versión D): `pedido_id` solo se fija una vez y solo en `aceptada` con `cliente_id`; una aceptada con pedido no se anula; recrear `cotizaciones_listado_view` con `pedido_id`. No cambia `pedidos` ni `pedido_items`.
21. **Servicio**: `cotizacionPedidoService.convertirEnPedido(id, fechaEntrega)`: exige `aceptada` (o la acepta si está `enviada` y vigente), cliente registrado y productos activos; llama a `pedidoService.crearPedido` (05) con peso estimado = kg y `precio_usd_kg` de cada línea; luego fija `pedido_id`. Si el segundo paso falla, el pedido queda creado y se informa (sin borrarlo; se reintenta enlazar) — o se mueve a una RPC única si `crearPedido` ya es RPC (revisar al ejecutar y anotar).
22. **UI**: `⋮` «Convertir en pedido» (diálogo `xs` con fecha de entrega); cotización con cliente libre muestra «Registra el cliente para convertir» con enlace a `/clientes`; la ficha enlaza al pedido y el pedido no necesita cambios (enlace solo desde la cotización).
    - Hecho: una aceptada genera un pedido con las mismas líneas y precios; convertir dos veces falla; anular esa cotización falla.
23. **`specs/05-ventas/tasks.md`**: anotar como tarea agregada (con fecha de ejecución) que `pedidoService.crearPedido` tiene un consumidor nuevo, sin cambio de esquema.

## Fase E — Documentación y verificación (no saltarse)

24. **Documentación global**:
    - `/SPEC.md`: §5 (`cotizaciones`, `cotizacion_items`, columnas nuevas de `config_negocio`), §7 (pantalla «Cotizaciones» y página pública) con nota del 2026-10-22. No reabrir §2.
    - `specs/README.md`: revisar que el orden y el cambio de alcance (registrados al planificar, con P1–P10 cerradas el 2026-10-22) sigan vigentes.
    - `specs/00-estandares-ui/spec.md`: registrar en «Componentes compartidos» `templates/DocumentoPublicoLayout`, `CotizacionNoDisponible` si se generaliza como página de respaldo, `lib/pdf/marca.tsx` + `lib/pdf/fuentes.ts`, `src/theme/marca.ts` y, si se generaliza, `CotizacionDocumento`.
25. Aplicar las migraciones en un Postgres local en orden A → C → D sobre una base con datos sembrados y comprobar que cada versión de `cotizaciones_guard` conserva las reglas anteriores.
26. **Casos de negocio**:
    - 2 líneas: 10 kg a $8,50 y 5,5 kg a $12 = $151,000000; descuento $1 → base $150; IVA 16 % = $24; total $174. Sin IVA → $150. Ningún importe en Bs en ficha, PDF ni enlace.
    - Vencida (fecha de hace 10 días, validez 7): chip «Vencida», no se puede aceptar ni compartir sin renovar; su enlace muestra el respaldo «venció» y no da el PDF; renovar la deja vigente y el mismo enlace vuelve a mostrarla.
    - Editar una enviada: el enlace muestra los precios nuevos y «Actualizada el …».
    - Cliente libre sin teléfono → WhatsApp sin número; cliente con `0414-1234567` → `wa.me/584141234567`.
27. **Seguridad del enlace**: `anon` no puede leer `cotizaciones`, `cotizacion_items` ni la vista por PostgREST; la RPC no devuelve `notas_internas`, `cliente_telefono` ni ids; `vencida` no expone más que el número y `no_disponible` nada de la cotización; el PDF público no se genera fuera de `disponible`; la página pública no carga datos de sesión; `robots` noindex y `Referrer-Policy` presentes; un token de otra longitud no llega a la base.
28. `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx tsx scripts/probar-cotizaciones.ts` (y `--sql`, `--pdf`).
29. Aplicar las migraciones en Supabase en orden; configurar `SITE_URL` en Vercel. Revisión visual en claro/oscuro y en 375/768/1024/1440 px (formulario `fullScreen` en `xs`, página pública en 375 px, PDF en móvil).
30. Recorrer `checklist.md`.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "NN-modulo necesita … — agregado el <fecha>")_
- **00-estandares-ui Fase 3, rediseño "Puerto" (tarea agregada el 2026-10-22)**: la tarea 76 de `00-estandares-ui/tasks.md` pasa el PDF a la marca nueva.
  - `lib/pdf/fuentes.ts`: Fraunces + Instrument Sans, en lugar de Barlow.
  - `lib/pdf/marca.tsx`: filete de latón, en lugar de las franjas.
  - `CotizacionPdf.tsx`: `MARCA_CLARO.midnight`, en lugar de `hull`.
  - `DocumentoPublicoLayout`: filete de latón (tarea 74).

  No cambian datos, RPC ni el contenido del PDF. Verificar con `npx tsx scripts/probar-cotizaciones.ts --pdf`.
