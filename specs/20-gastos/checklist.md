# Checklist — 20-gastos

## Decisiones
- [ ] Decisiones del pedido cerradas por el usuario el 2026-10-22 (tabla de `spec.md`): nómina = empleados + pagos sin deducciones, categorías editables con Nómina de sistema, moneda y tasa snapshot normalizada a USD, recurrentes con pendiente de confirmar, solo admin, dashboard con utilidad neta, trazabilidad mínima con anulación en vez de borrado.
- [x] P1–P6 respondidas por el usuario y pasadas a "Decisiones cerradas" de `spec.md` (aprobadas las seis recomendaciones el 2026-10-22).
- [ ] El módulo no es contabilidad formal (`/SPEC.md` §9 sin reabrir): sin plan de cuentas, asientos, mayor ni balance.
- [ ] `/SPEC.md` (§5, §7, §9) con nota del 2026-10-22; `specs/README.md` con orden y cambio de alcance; tarea agregada en `15-dashboard/tasks.md` y en `08-tasas/tasks.md` (P5 aprobada).

## Datos y seguridad (migraciones + RLS)
- [ ] Cuatro migraciones nuevas e incrementales (`20261022000000` … `…000300`), aplicadas en orden A → B → C → D. No se editó ninguna aplicada.
- [ ] `categorias_gasto`, `empleados`, `gastos` y `gastos_recurrentes` en `snake_case` y español, con las columnas, checks e índices de `spec.md`; dinero y tasas `numeric(14,6)`.
- [ ] RLS en las cuatro: `select`/`insert`/`update` solo `es_admin()`, sin `delete`, `revoke` de `anon` y de `delete`/`truncate` de `authenticated`. Operador: 0 filas y escrituras fallan.
- [ ] Auditoría: `created_by`/`created_at` inmutables, `updated_by`/`updated_at` por `fija_auditoria()`; `confirmado_*` y `anulado_*` los fija `gastos_guard`; `tasa_registrada_por` por `fija_tasa_registrada_por()`.
- [ ] Checks de `gastos`: tasa coherente, confirmado completo, `monto_usd` = regla de compras, período ambos-o-ninguno, motivo de anulación 5–500.
- [ ] Siembra de las 7 categorías idempotente; Nómina con `clave = 'nomina'` y `es_sistema`, no se renombra, desactiva ni recibe subcategorías.
- [ ] `generar_gastos_recurrentes` es `security definer`, exige `es_admin()` (`42501`), sin `grant` a `anon`; `gasto_recurrente_monto` sin `grant`. Idempotente por el índice único `(recurrente_id, periodo_desde)`.
- [ ] Cada versión de `gastos_guard` (A, B, C) conserva las reglas de la anterior.

## Reglas de negocio
- [ ] Alta manual nace `confirmado` con tasa resuelta por `resolverTasaOperacion` (referencial por defecto o manual con confirmación por desviación); el servidor no confía en la referencial del cliente.
- [ ] Transiciones: `pendiente → confirmado | descartado`, `confirmado → anulado`; terminales inmutables; nunca `delete`.
- [ ] Edición de confirmados según P1 (recomendado: solo descripción, beneficiario, referencia y notas; corrección de importe por anulación + "Registrar de nuevo").
- [ ] Fecha no futura (Caracas) al crear y confirmar; imputación por `gastos.fecha` (P2).
- [ ] Nómina: categoría Nómina ⇔ empleado; período obligatorio; empleado activo; precarga del salario (mensual o mitad en quincena, P3); aviso (no bloqueo) de período solapado.
- [ ] Costo por empleado = Σ `monto_usd` confirmados del rango; anulados fuera.
- [ ] Recurrentes: mensual y quincenal (P6) con las fechas programadas de la spec; tope de 12 por plantilla; descartados no se regeneran; empleado inactivo no genera; generación a demanda al abrir `/gastos` y con botón (P4).
- [ ] Totales siempre en USD; equivalente en Bs a la tasa snapshot de cada gasto, sin revaluar.
- [ ] Casos de la tarea 26 con las cifras esperadas ($100,000000 y $91,250000; $200 de 1.ª quincena).

## Dashboard (15)
- [ ] `dashboard_gastos` y `dashboard_gastos_pendientes` con el patrón de seguridad de 15 (`42501` al operador). Ninguna RPC `dashboard_*` existente cambió.
- [ ] Utilidad neta = margen bruto (B3) − gastos confirmados del rango; % sobre ventas; resultado cambiario Bs aparte (no se suma).
- [ ] Gastos por categoría cuadran con `/gastos` en el mismo rango; KPI de pendientes solo si hay.
- [ ] El operador no recibe el bloque de gastos (no se llaman las RPC nuevas).

## Repositorios y servicios
- [ ] `ICategoriaGastoRepository`, `IGastoRepository`, `IEmpleadoRepository`, `IGastoRecurrenteRepository` (+ métodos de `IDashboardRepository`) solo acceden y mapean; sin lógica de negocio.
- [ ] `categoriaGastoService`, `gastoService`, `empleadoService`, `gastoRecurrenteService` con `requireAdmin()` en cada función (operador falla antes de tocar Supabase) y mapeo de `hint` a campos.
- [ ] Funciones puras (`lib/gastos/montos.ts`, `lib/gastos/periodos.ts`, `lib/dashboard/utilidad.ts`) sin imports de Supabase ni React; `scripts/probar-gastos.ts` (con paridad TS ↔ SQL de montos y períodos) y `scripts/probar-dashboard.ts` pasan.
- [ ] Validación zod en `src/lib/gastoValidation.ts`, `categoriaGastoValidation.ts`, `empleadoValidation.ts`, `gastoRecurrenteValidation.ts`; tasa con `camposTasa` + `validarTasa`; mensajes en `validationMessages.ts`.

## UI (Atomic Design y `00-estandares-ui`)
- [ ] `/gastos` y `/gastos/empleados/[id]` solo admin (`requireAdmin()` → `notFound()`), con `loading`, `error` (y `not-found` en la ficha); `page.tsx` solo compone organisms/templates.
- [ ] Ítem de menú `/gastos` con `adminOnly: true`; el operador no lo ve.
- [ ] Tabs en `?tab=`, rango en `?desde`/`?hasta`, estado en `?estado=` (persisten al navegar).
- [ ] Listados en `AppDataGrid`; diálogos en `AppDialog` (`GastoForm` md, `fullScreen` en `xs`); ficha con `FichaHeader`; `TasaSelector` de 08 y procedencia de la tasa visible; `useForm({ disabled })`, `Button loading`, cierre protegido con `dirty`.
- [ ] Confirmaciones con `useConfirm`/`ConfirmDialog` y toasts con `useNotify` (nunca `window.alert`/`confirm`); estados vacíos y de error con `EmptyState`/`ErrorState`.
- [ ] Números con `lib/format.ts`, cifras tabulares, montos a la derecha; colores del dashboard solo del theme (sin hex).
- [ ] Componentes genéricos nuevos registrados en "Componentes compartidos" de `00-estandares-ui/spec.md` (o anotado que no hubo).
- [ ] Modo claro/oscuro y responsive (375/768/1024/1440).

## Tipos y calidad
- [ ] Tipos de la spec en `src/types/domain.ts`, sin `any` sin justificar.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores.

## Pendientes / deuda técnica
- _(anotar aquí con fecha lo que se difiera, sin borrar ítems)_
