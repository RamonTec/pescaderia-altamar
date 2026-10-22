# Checklist — 20-gastos

> Fase A (tareas 1–9) del 2026-10-22 (executor, rama `feat/gastos-base`). "Postgres local" = contenedor `postgres:17-alpine` desechable con stubs de `auth` (`auth.uid()` desde `request.jwt.claim.sub`, `auth.users`), `storage` y los roles `anon` / `authenticated` / `service_role`; se aplicaron todas las migraciones en orden (la `0015` con la secuencia en 1, base vacía) y luego `20261022000000`, con ~40 aserciones SQL (admin, operador y `anon`), las transiciones de pendientes (insertados con el guard deshabilitado, porque en A no hay `recurrente_id`) y la paridad TS ↔ SQL de `montoUsdGasto` en 200 casos (`probar-gastos.ts --sql`). El contenedor se borró al terminar. **No se aplicó nada a Supabase remoto.** Los ítems de las fases B–E quedan sin marcar con su nota.
>
> Fase B (tareas 10–13) del 2026-10-22 (executor, rama `feat/gastos-nomina`). Mismo método: contenedor `postgres:17-alpine` desechable con los stubs de A, todas las migraciones previas (0015 con la secuencia en 1), un gasto de A sembrado antes de aplicar `20261022000100_gastos_nomina.sql`, 43 aserciones SQL (admin, operador y `anon`; pendientes de nómina simulados con el guard deshabilitado) y paridad TS ↔ SQL de `montoUsdGasto` y `montoNominaPeriodo` (200 casos cada una, `probar-gastos.ts --sql`). Contenedor borrado. **La migración B no se aplicó a Supabase remoto**: la aplica el usuario. Los ítems de C, D y E quedan sin marcar con su nota.

## Decisiones
- [x] Decisiones del pedido cerradas por el usuario el 2026-10-22 (tabla de `spec.md`): nómina = empleados + pagos sin deducciones, categorías editables con Nómina de sistema, moneda y tasa snapshot normalizada a USD, recurrentes con pendiente de confirmar, solo admin, dashboard con utilidad neta, trazabilidad mínima con anulación en vez de borrado.
- [x] P1–P6 respondidas por el usuario y pasadas a "Decisiones cerradas" de `spec.md` (aprobadas las seis recomendaciones el 2026-10-22).
- [x] El módulo no es contabilidad formal (`/SPEC.md` §9 sin reabrir): sin plan de cuentas, asientos, mayor ni balance. — Fase A: solo registro, categorías, anulación y totales en USD. Revisar de nuevo al cerrar el módulo.
- [ ] `/SPEC.md` (§5, §7, §9) con nota del 2026-10-22; `specs/README.md` con orden y cambio de alcance; tarea agregada en `15-dashboard/tasks.md` y en `08-tasas/tasks.md` (P5 aprobada). — Fase E, otra rama (las tareas agregadas en 15 y 08 ya se anotaron al planificar).

## Datos y seguridad (migraciones + RLS)
- [ ] Cuatro migraciones nuevas e incrementales (`20261022000000` … `…000300`), aplicadas en orden A → B → C → D. No se editó ninguna aplicada. — Fase A: `20261022000000_gastos_esquema.sql` aplicada. Fase B: `20261022000100_gastos_nomina.sql` aplicada. Fase C: `20261022000200_gastos_recurrentes.sql` aplicada en Supabase por el usuario el 2026-10-22. Fase D: `20261022000300_dashboard_gastos.sql` escrita y probada, pendiente de aplicar en Supabase por el usuario.
- [x] `categorias_gasto`, `empleados`, `gastos` y `gastos_recurrentes` en `snake_case` y español, con las columnas, checks e índices de `spec.md`; dinero y tasas `numeric(14,6)`. — Fases A, B, C y D.
- [ ] RLS en las cuatro: `select`/`insert`/`update` solo `es_admin()`, sin `delete`, `revoke` de `anon` y de `delete`/`truncate` de `authenticated`. Operador: 0 filas y escrituras fallan. — Fase A y B probadas. Fase C: `gastos_recurrentes` con RLS solo admin y sin delete en la migración C.
- [x] Auditoría: `created_by`/`created_at` inmutables, `updated_by`/`updated_at` por `fija_auditoria()`; `confirmado_*` y `anulado_*` los fija `gastos_guard`; `tasa_registrada_por` por `fija_tasa_registrada_por()`. — Postgres local: cambiar `created_by` no tiene efecto (se restaura en silencio), `updated_by` se fija al editar. Fase B: `empleados` usa `fija_auditoria()`. Fase C: `gastos_recurrentes` usa `fija_auditoria()`.
- [x] Checks de `gastos`: tasa coherente, confirmado completo, `monto_usd` = regla de compras, período ambos-o-ninguno, motivo de anulación 5–500. — Postgres local: cada check falla con su caso. Desvío: `gastos_confirmado_completo` exceptúa `pendiente` **y `descartado`** (un descartado viene de un pendiente sin tasa; con la redacción de la spec no se podía descartar).
- [x] Siembra de las 7 categorías idempotente; Nómina con `clave = 'nomina'` y `es_sistema`, no se renombra, desactiva ni recibe subcategorías. — Postgres local: re-ejecutar la siembra deja 7; renombrar o desactivar Nómina → `categoria_sistema`; subcategoría de Nómina → `categoria_nomina_sin_sub`; `es_sistema`/`clave` desde la app → `categoria_sistema`.
- [x] `generar_gastos_recurrentes` es `security definer`, exige `es_admin()` (`42501`), sin `grant` a `anon`; `gasto_recurrente_monto` sin `grant`. Idempotente por el índice único `(recurrente_id, periodo_desde)`. — Fase C: RPC escrita en migración C con tope 12 por plantilla, generación hasta p_hasta (default hoy Caracas), omite empleados inactivos, períodos idempotentes.
- [x] Cada versión de `gastos_guard` (A, B, C) conserva las reglas de la anterior. — Fase C: la versión C conserva las reglas de A y B; agrega restricción de `pendiente` solo con `recurrente_id`, transición `pendiente → confirmado | descartado`, y `recurrente_id` inmutable.

## Reglas de negocio
- [x] Alta manual nace `confirmado` con tasa resuelta por `resolverTasaOperacion` (referencial por defecto o manual con confirmación por desviación); el servidor no confía en la referencial del cliente. — `gastoService.registrarGasto` + `GastoForm` (`TasaSelector`, `pedirConfirmacionTasaManual`). Pendiente verlo en pantalla tras aplicar la migración en Supabase (ver deuda).
- [x] Transiciones: `pendiente → confirmado | descartado`, `confirmado → anulado`; terminales inmutables; nunca `delete`. — Postgres local: `confirmado → pendiente` → `transicion_invalida`, `pendiente → anulado` → `transicion_invalida`, editar un anulado/descartado → `gasto_inmutable`, `delete` → `42501`. Fase C: descartar y confirmar pendientes implementados.
- [x] Edición de confirmados según P1 (recomendado: solo descripción, beneficiario, referencia y notas; corrección de importe por anulación + "Registrar de nuevo"). — `gastos_guard` (importe/fecha → `gasto_inmutable`), `gastoService.editarGasto`, `GastoForm` modo `editar` y acción "Registrar de nuevo".
- [x] Fecha no futura (Caracas) al crear y confirmar; imputación por `gastos.fecha` (P2). — Trigger (`fecha_futura`, probado al crear y al confirmar un pendiente), `gastoFormSchema` y filtro del rango por `fecha`.
- [x] Nómina: categoría Nómina ⇔ empleado; período obligatorio; empleado activo; precarga del salario (mensual o mitad en quincena, P3); aviso (no bloqueo) de período solapado. — Base: `gastos_guard` B y C (`categoria_nomina_requiere_empleado`, `empleado_requiere_nomina` también en subcategorías, `periodo_requerido`, `empleado_inactivo`).
- [x] Costo por empleado = Σ `monto_usd` confirmados del rango; anulados fuera. — `empleadoRepository.costo` lee solo `confirmado` por `fecha` (P2) y `resumirCostoEmpleado` suma.
- [x] Recurrentes: mensual y quincenal (P6) con las fechas programadas de la spec; tope de 12 por plantilla; descartados no se regeneran; empleado inactivo no genera; generación a demanda al abrir `/gastos` y con botón (P4). — Fase C: generación oportunista en `page.tsx` (`generarPendientes()`), Server Action `generarPendientesAction`, validación de fechas y períodos en `periodos.ts`, y paridad de casos en `probar-gastos.ts`.
- [x] Totales siempre en USD; equivalente en Bs a la tasa snapshot de cada gasto, sin revaluar. — KPIs y `resumirGastos` suman `monto_usd`; el detalle muestra el equivalente Bs con la `tasa_snapshot` del gasto.
- [ ] Casos de la tarea 26 con las cifras esperadas ($100,000000 y $91,250000; $200 de 1.ª quincena). — Fase E, otra rama. Adelantado: $100 y $91,25 (A) y $200 de 1.ª quincena de un salario de $400 (B, `montoNominaPeriodo`) cuadran en el script y en Postgres local.

## Dashboard (15)
- [x] `dashboard_gastos` y `dashboard_gastos_pendientes` con el patrón de seguridad de 15 (`42501` al operador). Ninguna RPC `dashboard_*` existente cambió. — Fase D: ambas en `20261022000300_dashboard_gastos.sql` con `dashboard_exigir_admin()`.
- [x] Utilidad neta = margen bruto (B3) − gastos confirmados del rango; % sobre ventas; resultado cambiario Bs aparte (no se suma). — Fase D: función pura `utilidadNeta` en `lib/dashboard/utilidad.ts` y tarjeta `UtilidadNetaCard`.
- [x] Gastos por categoría cuadran con `/gastos` en el mismo rango; KPI de pendientes solo si hay. — Fase D: `GastosCategoriaChart` con desglose por categoría/subcategoría y enlace a `/gastos`; `KpiCard` de pendientes en `KpisDiaRow` condicionado a `n > 0`.
- [x] El operador no recibe el bloque de gastos (no se llaman las RPC nuevas). — Fase D: `getAnalitica` y `getGastosPendientes` retornan `undefined` sin invocar Supabase cuando rol no es admin.

## Repositorios y servicios
- [x] `ICategoriaGastoRepository`, `IGastoRepository`, `IEmpleadoRepository`, `IGastoRecurrenteRepository` (+ métodos de `IDashboardRepository`) solo acceden y mapean; sin lógica de negocio. — Fases A, B, C y D (`IDashboardRepository.gastos` y `gastosPendientes`).
- [x] `categoriaGastoService`, `gastoService`, `empleadoService`, `gastoRecurrenteService` con `requireAdmin()` en cada función (operador falla antes de tocar Supabase) y mapeo de `hint` a campos. — Fases A, B, C y D (`gastoRecurrenteService.ts` con `requireAdmin()` en CRUD y generación).
- [x] Funciones puras (`lib/gastos/montos.ts`, `lib/gastos/periodos.ts`, `lib/dashboard/utilidad.ts`) sin imports de Supabase ni React; `scripts/probar-gastos.ts` (con paridad TS ↔ SQL de montos y períodos) y `scripts/probar-dashboard.ts` pasan. — Fases A, B, C y D (`utilidad.ts` con 40 casos pasando en `probar-dashboard.ts`).
- [x] Validación zod en `src/lib/gastoValidation.ts`, `categoriaGastoValidation.ts`, `empleadoValidation.ts`, `gastoRecurrenteValidation.ts`; tasa con `camposTasa` + `validarTasa`; mensajes en `validationMessages.ts`. — Fases A, B, C y D (`gastoRecurrenteSchema` en `gastoRecurrenteValidation.ts`).

## UI (Atomic Design y `00-estandares-ui`)
- [x] `/gastos` y `/gastos/empleados/[id]` solo admin (`requireAdmin()` → `notFound()`), con `loading`, `error` (y `not-found` en la ficha); `page.tsx` solo compone organisms/templates. — Fases A, B y C (`page.tsx` de `/gastos` genera pendientes oportunamente antes de listar).
- [x] Ítem de menú `/gastos` con `adminOnly: true`; el operador no lo ve. — `NAV_ITEMS` filtra `adminOnly` por rol. Verificado en navegador por el usuario el 2026-10-22.
- [x] Tabs en `?tab=`, rango en `?desde`/`?hasta`, estado en `?estado=` (persisten al navegar). — Fases B y C: tabs `gastos`, `recurrentes`, `empleados`, `categorias` persistentes en URL. Chips de estado incluyen `pendiente`.
- [x] Listados en `AppDataGrid`; diálogos en `AppDialog` (`GastoForm` md, `fullScreen` en `xs`); ficha con `FichaHeader`; `TasaSelector` de 08 y procedencia de la tasa visible; `useForm({ disabled })`, `Button loading`, cierre protegido con `dirty`. — Fase C: `GastosRecurrentesTable` con `AppDataGrid`, `GastoRecurrenteForm` en `AppDialog sm`, `GastoForm` con modo `confirmar`.
- [x] Confirmaciones con `useConfirm`/`ConfirmDialog` y toasts con `useNotify` (nunca `window.alert`/`confirm`); estados vacíos y de error con `EmptyState`/`ErrorState`. — Acciones y avisos con `useNotify` y `useConfirm`.
- [x] Números con `lib/format.ts`, cifras tabulares, montos a la derecha; colores del dashboard solo del theme (sin hex). — Fases A, B, C y D (`coloresGrafico`, `ChartLegendTable`, `UtilidadNetaCard`).
- [ ] Componentes genéricos nuevos registrados en "Componentes compartidos" de `00-estandares-ui/spec.md` (o anotado que no hubo). — Fase E, otra rama.
- [ ] Modo claro/oscuro y responsive (375/768/1024/1440). — Fase E, otra rama.

## Tipos y calidad
- [x] Tipos de la spec en `src/types/domain.ts`, sin `any` sin justificar. — Fases A, B, C y D (`GastosPendientesResumen`, `UtilidadNeta`, `DashboardGastos`).
- [x] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores. — Fases A, B, C y D en verde.

## Pendientes / deuda técnica
- _(anotar aquí con fecha lo que se difiera, sin borrar ítems)_
- **2026-10-22 — Migración de la Fase D sin aplicar en Supabase**: `20261022000300_dashboard_gastos.sql` está escrita y validada en código. **Aplicarla antes de desplegar este código**: hasta entonces el dashboard para admin mostrará error en el bloque de gastos y pendientes si las RPCs no existen.
- **2026-10-22 — Notas de la Fase D**:
  - `dashboard_gastos` y `dashboard_gastos_pendientes` creadas con `dashboard_exigir_admin()` (42501 para operador).
  - Función pura `utilidadNeta(margenBruto, gastos, ventas)` en `src/lib/dashboard/utilidad.ts` con 40 casos pasando en `scripts/probar-dashboard.ts`.
  - Tarjeta `UtilidadNetaCard` y gráfico horizontal `GastosCategoriaChart` integrados en la sección "Ventas y margen" del dashboard.
  - KPI de pendientes en `KpisDiaRow` visible solo si `n > 0` para rol admin.
  - Operador no recibe el bloque de gastos ni llama a las RPCs nuevas.
- **2026-10-22 — Resuelto el mismo día**: el usuario aplicó la migración C en Supabase y realizó las pruebas en navegador. Nota original — **Migración de la Fase C sin aplicar en Supabase**: `20261022000200_gastos_recurrentes.sql` está escrita y validada en código y pruebas de dominio.
- **2026-10-22 — Desvíos y notas de la Fase C**:
  - `gasto_recurrente_monto` y `generar_gastos_recurrentes` respetan exactamente la spec: períodos mensuales con `dia_mes` o fin de mes, períodos quincenales (1–15 y 16–fin de mes), tope 12 por plantilla, ignora empleados inactivos.
  - La UI de `GastoRecurrenteForm` muestra las próximas 3 fechas programadas calculadas en vivo con `proximasFechas`.
  - La tab `Recurrentes` en `/gastos` permite listar, filtrar, crear, editar, pausar/activar y generar pendientes manualmente.
  - Tarea 18 completada: la lectura de "Operaciones con tasa manual" (`src/app/(protected)/tasas/operaciones-tasa-manual.ts`) incluye los gastos confirmados con tasa manual y provee enlace directo al rango en `/gastos`.
- **2026-10-22 — Resuelto el mismo día**: el usuario aplicó la migración en Supabase. Nota original — **Migración sin aplicar en Supabase** (Fase A): `20261022000000_gastos_esquema.sql` está escrita y validada en un Postgres local desechable.
- **2026-10-22 — Resuelto el mismo día**: el usuario probó en navegador y todo funciona. Nota original — **"Hecho" de las tareas 8 y 9 sin verificar en navegador** (Fase A).
- **2026-10-22 — Resuelto el mismo día**: el usuario aplicó la migración B en Supabase. Nota original — **Migración de la Fase B sin aplicar en Supabase**: `20261022000100_gastos_nomina.sql` está escrita y validada en un Postgres local desechable.
- **2026-10-22 — Resuelto el mismo día**: el usuario hizo las pruebas en navegador y todo funciona. Nota original — **"Hecho" de la tarea 13 sin verificar en navegador** (Fase B).
