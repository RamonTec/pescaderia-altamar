# Checklist — 20-gastos

> Fase A (tareas 1–9) del 2026-10-22 (executor, rama `feat/gastos-base`). "Postgres local" = contenedor `postgres:17-alpine` desechable con stubs de `auth` (`auth.uid()` desde `request.jwt.claim.sub`, `auth.users`), `storage` y los roles `anon` / `authenticated` / `service_role`; se aplicaron todas las migraciones en orden (la `0015` con la secuencia en 1, base vacía) y luego `20261022000000`, con ~40 aserciones SQL (admin, operador y `anon`), las transiciones de pendientes (insertados con el guard deshabilitado, porque en A no hay `recurrente_id`) y la paridad TS ↔ SQL de `montoUsdGasto` en 200 casos (`probar-gastos.ts --sql`). El contenedor se borró al terminar. **No se aplicó nada a Supabase remoto.** Los ítems de las fases B–E quedan sin marcar con su nota.

## Decisiones
- [x] Decisiones del pedido cerradas por el usuario el 2026-10-22 (tabla de `spec.md`): nómina = empleados + pagos sin deducciones, categorías editables con Nómina de sistema, moneda y tasa snapshot normalizada a USD, recurrentes con pendiente de confirmar, solo admin, dashboard con utilidad neta, trazabilidad mínima con anulación en vez de borrado.
- [x] P1–P6 respondidas por el usuario y pasadas a "Decisiones cerradas" de `spec.md` (aprobadas las seis recomendaciones el 2026-10-22).
- [x] El módulo no es contabilidad formal (`/SPEC.md` §9 sin reabrir): sin plan de cuentas, asientos, mayor ni balance. — Fase A: solo registro, categorías, anulación y totales en USD. Revisar de nuevo al cerrar el módulo.
- [ ] `/SPEC.md` (§5, §7, §9) con nota del 2026-10-22; `specs/README.md` con orden y cambio de alcance; tarea agregada en `15-dashboard/tasks.md` y en `08-tasas/tasks.md` (P5 aprobada). — Fase E, otra rama (las tareas agregadas en 15 y 08 ya se anotaron al planificar).

## Datos y seguridad (migraciones + RLS)
- [ ] Cuatro migraciones nuevas e incrementales (`20261022000000` … `…000300`), aplicadas en orden A → B → C → D. No se editó ninguna aplicada. — Fase A: `20261022000000_gastos_esquema.sql` escrita y aplicada solo en Postgres local (sin tocar migraciones previas). B/C/D: otra rama.
- [ ] `categorias_gasto`, `empleados`, `gastos` y `gastos_recurrentes` en `snake_case` y español, con las columnas, checks e índices de `spec.md`; dinero y tasas `numeric(14,6)`. — Fase A: `categorias_gasto` y `gastos` hechas (sin `empleado_id` ni `recurrente_id`). `empleados` (B) y `gastos_recurrentes` (C): otra rama.
- [ ] RLS en las cuatro: `select`/`insert`/`update` solo `es_admin()`, sin `delete`, `revoke` de `anon` y de `delete`/`truncate` de `authenticated`. Operador: 0 filas y escrituras fallan. — Fase A: `categorias_gasto` y `gastos` probadas en Postgres local (operador 0 filas, `insert` falla; `anon` → `42501`; `delete` del admin → `42501`). `empleados` y `gastos_recurrentes`: fase B/C, otra rama.
- [x] Auditoría: `created_by`/`created_at` inmutables, `updated_by`/`updated_at` por `fija_auditoria()`; `confirmado_*` y `anulado_*` los fija `gastos_guard`; `tasa_registrada_por` por `fija_tasa_registrada_por()`. — Postgres local: cambiar `created_by` no tiene efecto (se restaura en silencio), `updated_by` se fija al editar. `empleados`/`gastos_recurrentes` reutilizarán `fija_auditoria()` en B/C.
- [x] Checks de `gastos`: tasa coherente, confirmado completo, `monto_usd` = regla de compras, período ambos-o-ninguno, motivo de anulación 5–500. — Postgres local: cada check falla con su caso. Desvío: `gastos_confirmado_completo` exceptúa `pendiente` **y `descartado`** (un descartado viene de un pendiente sin tasa; con la redacción de la spec no se podía descartar).
- [x] Siembra de las 7 categorías idempotente; Nómina con `clave = 'nomina'` y `es_sistema`, no se renombra, desactiva ni recibe subcategorías. — Postgres local: re-ejecutar la siembra deja 7; renombrar o desactivar Nómina → `categoria_sistema`; subcategoría de Nómina → `categoria_nomina_sin_sub`; `es_sistema`/`clave` desde la app → `categoria_sistema`.
- [ ] `generar_gastos_recurrentes` es `security definer`, exige `es_admin()` (`42501`), sin `grant` a `anon`; `gasto_recurrente_monto` sin `grant`. Idempotente por el índice único `(recurrente_id, periodo_desde)`. — Fase C, otra rama.
- [ ] Cada versión de `gastos_guard` (A, B, C) conserva las reglas de la anterior. — Fase B/C, otra rama (la versión A compara la fila como `jsonb` sin las columnas editables: `empleado_id` y `recurrente_id` quedarán inmutables en un confirmado sin tocar esa parte).

## Reglas de negocio
- [x] Alta manual nace `confirmado` con tasa resuelta por `resolverTasaOperacion` (referencial por defecto o manual con confirmación por desviación); el servidor no confía en la referencial del cliente. — `gastoService.registrarGasto` + `GastoForm` (`TasaSelector`, `pedirConfirmacionTasaManual`). Pendiente verlo en pantalla tras aplicar la migración en Supabase (ver deuda).
- [x] Transiciones: `pendiente → confirmado | descartado`, `confirmado → anulado`; terminales inmutables; nunca `delete`. — Postgres local: `confirmado → pendiente` → `transicion_invalida`, `pendiente → anulado` → `transicion_invalida`, editar un anulado/descartado → `gasto_inmutable`, `delete` → `42501`.
- [x] Edición de confirmados según P1 (recomendado: solo descripción, beneficiario, referencia y notas; corrección de importe por anulación + "Registrar de nuevo"). — `gastos_guard` (importe/fecha → `gasto_inmutable`), `gastoService.editarGasto`, `GastoForm` modo `editar` y acción "Registrar de nuevo".
- [x] Fecha no futura (Caracas) al crear y confirmar; imputación por `gastos.fecha` (P2). — Trigger (`fecha_futura`, probado al crear y al confirmar un pendiente), `gastoFormSchema` y filtro del rango por `fecha`.
- [ ] Nómina: categoría Nómina ⇔ empleado; período obligatorio; empleado activo; precarga del salario (mensual o mitad en quincena, P3); aviso (no bloqueo) de período solapado. — Fase B, otra rama (en A la categoría Nómina se rechaza con `categoria_nomina_requiere_empleado` y no aparece en el selector).
- [ ] Costo por empleado = Σ `monto_usd` confirmados del rango; anulados fuera. — Fase B, otra rama.
- [ ] Recurrentes: mensual y quincenal (P6) con las fechas programadas de la spec; tope de 12 por plantilla; descartados no se regeneran; empleado inactivo no genera; generación a demanda al abrir `/gastos` y con botón (P4). — Fase C, otra rama.
- [x] Totales siempre en USD; equivalente en Bs a la tasa snapshot de cada gasto, sin revaluar. — KPIs y `resumirGastos` suman `monto_usd`; el detalle muestra el equivalente Bs con la `tasa_snapshot` del gasto.
- [ ] Casos de la tarea 26 con las cifras esperadas ($100,000000 y $91,250000; $200 de 1.ª quincena). — Fase E, otra rama. Adelantado en Fase A: $100 y $91,25 cuadran en el script y en Postgres local.

## Dashboard (15)
- [ ] `dashboard_gastos` y `dashboard_gastos_pendientes` con el patrón de seguridad de 15 (`42501` al operador). Ninguna RPC `dashboard_*` existente cambió. — Fase D, otra rama.
- [ ] Utilidad neta = margen bruto (B3) − gastos confirmados del rango; % sobre ventas; resultado cambiario Bs aparte (no se suma). — Fase D, otra rama.
- [ ] Gastos por categoría cuadran con `/gastos` en el mismo rango; KPI de pendientes solo si hay. — Fase D, otra rama.
- [ ] El operador no recibe el bloque de gastos (no se llaman las RPC nuevas). — Fase D, otra rama.

## Repositorios y servicios
- [ ] `ICategoriaGastoRepository`, `IGastoRepository`, `IEmpleadoRepository`, `IGastoRecurrenteRepository` (+ métodos de `IDashboardRepository`) solo acceden y mapean; sin lógica de negocio. — Fase A: `ICategoriaGastoRepository` e `IGastoRepository` hechos. Empleados (B), recurrentes (C) y dashboard (D): otra rama.
- [ ] `categoriaGastoService`, `gastoService`, `empleadoService`, `gastoRecurrenteService` con `requireAdmin()` en cada función (operador falla antes de tocar Supabase) y mapeo de `hint` a campos. — Fase A: `categoriaGastoService` y `gastoService` hechos (`contexto()` exige admin antes de crear repositorios). `empleadoService` (B) y `gastoRecurrenteService` (C): otra rama.
- [ ] Funciones puras (`lib/gastos/montos.ts`, `lib/gastos/periodos.ts`, `lib/dashboard/utilidad.ts`) sin imports de Supabase ni React; `scripts/probar-gastos.ts` (con paridad TS ↔ SQL de montos y períodos) y `scripts/probar-dashboard.ts` pasan. — Fase A: `lib/gastos/montos.ts` y `probar-gastos.ts` (paridad de montos en 200 casos, también contra Postgres local) pasan. Períodos (B/C) y `utilidad.ts` (D): otra rama.
- [ ] Validación zod en `src/lib/gastoValidation.ts`, `categoriaGastoValidation.ts`, `empleadoValidation.ts`, `gastoRecurrenteValidation.ts`; tasa con `camposTasa` + `validarTasa`; mensajes en `validationMessages.ts`. — Fase A: `gastoValidation.ts` y `categoriaGastoValidation.ts` hechos. `empleadoValidation.ts` (B) y `gastoRecurrenteValidation.ts` (C): otra rama.

## UI (Atomic Design y `00-estandares-ui`)
- [ ] `/gastos` y `/gastos/empleados/[id]` solo admin (`requireAdmin()` → `notFound()`), con `loading`, `error` (y `not-found` en la ficha); `page.tsx` solo compone organisms/templates. — Fase A: `/gastos` con `requireAdmin()` → `notFound()`, `loading` y `error`. La ficha `/gastos/empleados/[id]`: fase B, otra rama.
- [x] Ítem de menú `/gastos` con `adminOnly: true`; el operador no lo ve. — `NAV_ITEMS` filtra `adminOnly` por rol. Verificado en navegador por el usuario el 2026-10-22.
- [x] Tabs en `?tab=`, rango en `?desde`/`?hasta`, estado en `?estado=` (persisten al navegar). — Además `?categoria=`. Tab, estado y categoría con `writeUrlParams` (sin recargar, como `?pagina=`); el rango con `RangoFechasSelector` (lo pide el servidor).
- [ ] Listados en `AppDataGrid`; diálogos en `AppDialog` (`GastoForm` md, `fullScreen` en `xs`); ficha con `FichaHeader`; `TasaSelector` de 08 y procedencia de la tasa visible; `useForm({ disabled })`, `Button loading`, cierre protegido con `dirty`. — Fase A cumplida en `GastosTable`, `GastoForm` (md, `fullScreen` en `xs` por `AppDialog`), `AnularGastoDialog`, `GastoDetalleDialog` y `CategoriaGastoForm`. La ficha con `FichaHeader`: fase B, otra rama.
- [x] Confirmaciones con `useConfirm`/`ConfirmDialog` y toasts con `useNotify` (nunca `window.alert`/`confirm`); estados vacíos y de error con `EmptyState`/`ErrorState`. — Desactivar categoría y tasa manual con `useConfirm`; toasts con `useNotify`; `EmptyState` en la tabla y el panel; `ErrorState` en `error.tsx`.
- [ ] Números con `lib/format.ts`, cifras tabulares, montos a la derecha; colores del dashboard solo del theme (sin hex). — Fase A: `lib/format.ts`, `tabular-nums` y montos a la derecha en tabla, diálogos y KPIs. Colores del dashboard: fase D, otra rama.
- [ ] Componentes genéricos nuevos registrados en "Componentes compartidos" de `00-estandares-ui/spec.md` (o anotado que no hubo). — Fase E, otra rama. En Fase A no se creó ningún genérico (`AnularGastoDialog` no se generalizó; `lib/gastos/textos.ts` es del dominio).
- [ ] Modo claro/oscuro y responsive (375/768/1024/1440). — Fase E, otra rama (migración ya aplicada; revisión visual de claro/oscuro y tamaños pendiente).

## Tipos y calidad
- [ ] Tipos de la spec en `src/types/domain.ts`, sin `any` sin justificar. — Fase A: `EstadoGasto`, `CategoriaGasto`, `Gasto`, `GastoDetalle`, `GastoPorCategoria` (+ `ResumenGastos`), sin `any`. Los de B/C/D: otra rama.
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores. — Fase A en verde el 2026-10-22; repetir al cerrar cada fase.

## Pendientes / deuda técnica
- _(anotar aquí con fecha lo que se difiera, sin borrar ítems)_
- **2026-10-22 — Resuelto el mismo día**: el usuario aplicó la migración en Supabase. Nota original — **Migración sin aplicar en Supabase** (Fase A): `20261022000000_gastos_esquema.sql` está escrita y validada en un Postgres local desechable. **Aplicarla antes de desplegar este código**: hasta entonces `/gastos` falla (no existen `categorias_gasto` ni `gastos`).
- **2026-10-22 — Resuelto el mismo día**: el usuario probó en navegador y todo funciona. Nota original — **"Hecho" de las tareas 8 y 9 sin verificar en navegador**: registrar un gasto en Bs con tasa referencial y otro en USD con tasa manual (con la confirmación por desviación), anular uno con motivo y ver quién y cuándo, total del rango = Σ `monto_usd` confirmados; y con sesión de operador, sin ítem de menú y `/gastos` → 404. Requiere la migración aplicada; las reglas están probadas a nivel SQL y por código.
- **2026-10-22 — Desvíos de la Fase A** (conservadores, sin reabrir decisiones):
  - `gastos_confirmado_completo` exceptúa `pendiente` y `descartado` (la spec solo `pendiente`; sin esto un pendiente sin tasa no podía descartarse en la Fase C).
  - `categorias_gasto.created_by` admite `null` (= sembrada por la migración, sin sesión). En `gastos` es `not null` como dice la spec.
  - `fija_auditoria()` no lanza error si se intenta cambiar `created_*`: restaura el valor anterior en silencio.
  - "Solo la migración fija `es_sistema`/`clave`": el guard lo detecta con `current_user in ('authenticated', 'anon')` (sesiones de PostgREST).
  - Un `confirmado` tampoco cambia `metodo_pago` ni el período (P1 = b lista solo descripción, beneficiario, referencia y notas).
  - Al operador, un `insert` en `gastos` falla antes por `gastos_guard` (no ve la categoría: "La categoría no existe", `categoria_inactiva`) que por la RLS; igual falla.
  - `IGastoRepository.list` recibe `categoriaIds` (categoría + subcategorías, las arma el servicio) en lugar de `categoriaId`; `empleadoId` está en la interfaz pero no se usa hasta la Fase B.
  - Estado y categoría se filtran en el cliente sobre los gastos del rango (el servidor trae el rango completo, paginando de a 1000 en PostgREST).
  - El chip "Pendientes", el `Alert` de pendientes y el secundario "Pago de nómina" del `PageHeader` se dejaron para las fases C y B (no hay pendientes ni empleados en A).

