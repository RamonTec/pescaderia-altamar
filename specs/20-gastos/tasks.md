# Tareas — 20-gastos

Ejecutar en orden. Cada tarea indica archivos y criterio de hecho.

Depende de: `01-auth`, `08-tasas` y `15-dashboard` (hechos). No cambia el esquema de otros módulos; la Fase D agrega RPC y UI al dashboard, anotado como tarea agregada (2026-10-22) en `15-dashboard/tasks.md`. P5 aprobada: la tarea agregada (2026-10-22) ya está anotada en `08-tasas/tasks.md`.

Regla de avance: después de cada tarea, `npm run lint` y `npx tsc --noEmit`. Ninguna migración aplicada se edita. Prefijo timestamp ≥ `20261022000000`, después de `20261019120200_edicion_compras_contratos.sql`.

**Decisiones**: todas cerradas. Las del pedido en "Decisiones cerradas" de `spec.md`; P1–P6 aprobadas por el usuario el 2026-10-22 con la recomendación de cada una (ver `spec.md`). No hay bloqueos de decisión para ninguna fase.

Entrega por fases: cada fase deja la app compilando y usable, y puede ir en un PR propio contra `main` (rama y commit sugeridos al inicio de cada fase). Las fases van en orden: B, C y D dependen de A; D no depende de B ni de C, pero si se adelanta se verifica sin nómina ni recurrentes.

## Fase A — Esquema, categorías y gastos

Rama sugerida `feat/gastos-base`; commits `feat(gastos): esquema de categorías y gastos`, `feat(gastos): pantalla /gastos`.

1. **`supabase/migrations/20261022000000_gastos_esquema.sql`**:
   - Función genérica `fija_auditoria()` (`updated_at`, `updated_by`; no deja cambiar `created_at`/`created_by`).
   - `categorias_gasto` con columnas, índice único por padre y trigger `categorias_gasto_guard` de `spec.md`; siembra idempotente de las 7 categorías (Nómina con `clave = 'nomina'`, `es_sistema = true`).
   - `gastos` **sin** `empleado_id` ni `recurrente_id` (llegan en B y C), con checks `gastos_tasa_coherente`, `gastos_confirmado_completo`, `gastos_monto_usd`, `gastos_periodo`, `gastos_anulado_motivo`, índices, trigger `fija_tasa_registrada_por()` (0019), `fija_auditoria()` y `gastos_guard` versión A (insert solo `confirmado`; rechaza la categoría Nómina con `categoria_nomina_requiere_empleado`; transiciones y campos editables según **P1**).
   - RLS de `spec.md` en las dos tablas: `select`/`insert`/`update` solo `es_admin()`, sin `delete`, `revoke all … from anon`, `revoke delete, truncate … from authenticated`.
   - Hecho: en Postgres local, como operador `select` da 0 filas e `insert` falla; como admin, un gasto en Bs con `monto_usd` mal calculado falla por check; `delete` falla; renombrar Nómina falla con `categoria_sistema`; `confirmado → pendiente` falla con `transicion_invalida`.
2. **`src/types/domain.ts`**: `EstadoGasto`, `CategoriaGasto`, `Gasto`, `GastoDetalle`, `GastoPorCategoria`. Sin `any`.
3. **Dominio puro y validación**:
   - `src/lib/gastos/montos.ts`: `montoUsdGasto(moneda, monto, tasa)` con la misma regla y redondeo del check.
   - `src/lib/gastoValidation.ts`: `gastoFormSchema` (fecha ≤ hoy, categoría, descripción 3–200, moneda, monto > 0, `camposTasa` + `validarTasa`, método, referencia, notas, período ambos-o-ninguno), `anularGastoSchema` (motivo 5–500), `descartarGastoSchema` (motivo opcional ≤ 500).
   - `src/lib/categoriaGastoValidation.ts`: nombre 2–60, padre opcional, orden.
   - Mensajes nuevos en `src/lib/validationMessages.ts`.
4. **`scripts/probar-gastos.ts`** (`npx tsx`, `process.exit(1)` si falla): `montoUsdGasto` en USD y Bs (redondeo a 6, paridad con el check en 200 casos con `--sql` si hay Postgres local) y esquemas (fecha futura, motivo corto, período incompleto).
   - Hecho: el script pasa.
5. **Repositorios** (`src/lib/repositories/interfaces.ts`, `categoriaGastoRepository.ts`, `gastoRepository.ts`): `ICategoriaGastoRepository` (`list`, `create`, `update`) e `IGastoRepository` (`list({ desde, hasta, estado, categoriaId, empleadoId })`, `getDetalle(id)` con nombres de usuarios de `perfiles`, `create`, `update`, `anular`, `descartar`). Solo acceso y mapeo; los `hint` de Postgres se devuelven tal cual.
6. **Servicios** (`src/lib/services/categoriaGastoService.ts`, `gastoService.ts`): `requireAdmin()` en cada función; `registrarGasto` y `confirmarGasto` resuelven la tasa con `resolverTasaOperacion(entradaTasaDe(v), fecha)` y calculan `monto_usd` con `montoUsdGasto`; `anularGasto`, `descartarGasto`, `editarGasto` (campos de **P1**), `listarGastos`, `resumenGastos(rango)` (total, n.º, por categoría). Mapeo de `hint` a campos (`fecha_futura` → `fecha`, `categoria_*` → `categoria_id`, `motivo_requerido` → `motivo`; el resto al `Alert`).
   - Hecho: con sesión de operador lanzan el error de permisos antes de tocar Supabase.
7. **Organisms**: `GastoForm` (modos `crear`, `editar`, `registrar_de_nuevo`; el modo `confirmar` llega en C y `nomina` en B), `AnularGastoDialog` (`anular`/`descartar`), `GastoDetalleDialog`, `GastosTable`, `CategoriasGastoPanel`, `CategoriaGastoForm`, según "Pantallas" de `spec.md`. Reutilizar `TasaSelector`, `NumberField`, `FormSection`, `RowActionsMenu`, `KpiCard`, `RangoFechasSelector`, `EmptyState`.
8. **`src/app/(protected)/gastos/`**: `page.tsx` server (`requireAdmin()` → `notFound()`; `searchParams` como `Promise`, ver `node_modules/next/dist/docs/`), `gastos-screen.tsx` (tabs Gastos · Categorías en `?tab=`, filtros en URL), `actions.ts` (`safeParse` → servicio → `ActionState` + `revalidatePath('/gastos')` y `'/'`), `loading.tsx` (`PageLoader table`), `error.tsx`.
   - Hecho: como admin se registra un gasto en Bs con tasa referencial y otro en USD con tasa manual (con confirmación por desviación), se anula uno con motivo y queda visible con quién y cuándo; el total del rango cuadra con la suma de `monto_usd` confirmados.
9. **Menú**: ítem `/gastos` (`AccountBalanceWalletOutlined`, `adminOnly: true`) en `NAV_ITEMS` de `src/components/templates/AppShell.tsx`.
   - Hecho: el operador no ve el ítem y `/gastos` le da 404.

## Fase B — Empleados y nómina

Rama sugerida `feat/gastos-nomina`; commits `feat(gastos): empleados y pagos de nómina`.

10. **`supabase/migrations/20261022000100_gastos_nomina.sql`**:
    - `empleados` (columnas, `cedula` única, `fija_auditoria()`, RLS solo admin igual que en A).
    - `gastos.empleado_id uuid null references empleados`, índice `(empleado_id, fecha) where empleado_id is not null`.
    - `create or replace` de `gastos_guard` (versión B): categoría Nómina ⇔ `empleado_id`; nómina exige período y empleado activo (`categoria_nomina_requiere_empleado`, `empleado_requiere_nomina`, `periodo_requerido`, `empleado_inactivo`). Conserva todo lo de la versión A.
    - Hecho: un gasto de Nómina sin empleado o sin período falla; uno de Mantenimiento con empleado falla; empleado inactivo falla; como operador `empleados` da 0 filas.
11. **Tipos y dominio**: `Empleado`, `CostoEmpleado` en `domain.ts`; `montoNominaPeriodo(salarioMensual, periodoDesde, periodoHasta)` (mes completo → salario; quincena → mitad, **P3**) y `atajosPeriodo(fecha)` (1.ª quincena, 2.ª quincena, mes) en `src/lib/gastos/`; `src/lib/empleadoValidation.ts` (nombre 2–120, cédula con el formato de `RifCiField`, cargo ≤ 80, salario ≥ 0, moneda, notas ≤ 500). Casos nuevos en `scripts/probar-gastos.ts` (febrero, mes de 31 días, quincena).
12. **Repositorio y servicio**: `IEmpleadoRepository` + `empleadoRepository.ts` (`list`, `getById`, `create`, `update`, `costo(id, rango)` = lectura agregada sin lógica); `empleadoService.ts` (CRUD con `requireAdmin()`, cédula duplicada → campo `cedula`, `getCostoEmpleado` con total USD, n.º de pagos, promedio mensual y equivalente Bs a la tasa de cada pago). `gastoService.registrarPagoNomina` (precarga con `montoNominaPeriodo`, aviso de período solapado sin bloquear).
13. **UI**: `EmpleadosTable`, `EmpleadoForm`; `GastoForm` modo `nomina` (empleado + período con atajos, monto precargado editable, aviso de solapado); tab "Empleados" en `gastos-screen.tsx`; secundario "Pago de nómina" en el `PageHeader`; ficha `src/app/(protected)/gastos/empleados/[id]/` (`page.tsx` con `requireAdmin()` → `notFound()`, `empleado-ficha.tsx`, `actions.ts`, `loading.tsx` `PageLoader ficha`, `error.tsx`, `not-found.tsx`) con `FichaHeader`, `KpiCard`s de costo y pagos en `GastosTable`.
    - Hecho: dos pagos quincenales confirmados y uno anulado de un empleado dan en la ficha el costo de los dos confirmados; el gasto aparece también en `/gastos` bajo Nómina.

## Fase C — Gastos recurrentes

Rama sugerida `feat/gastos-recurrentes`; commits `feat(gastos): plantillas recurrentes y pendientes de confirmar`.

14. **`supabase/migrations/20261022000200_gastos_recurrentes.sql`**:
    - `gastos_recurrentes` (columnas y checks de `spec.md`, coherencia Nómina ⇔ empleado con el mismo criterio que `gastos_guard`, `fija_auditoria()`, RLS solo admin).
    - `gastos.recurrente_id uuid null references gastos_recurrentes` + índice único parcial `(recurrente_id, periodo_desde) where recurrente_id is not null`.
    - `create or replace` de `gastos_guard` (versión C): insert `pendiente` solo con `recurrente_id`; `pendiente → confirmado | descartado`; `recurrente_id` inmutable. Conserva lo de A y B.
    - `gasto_recurrente_monto(uuid)` (interna, sin `grant`) y `generar_gastos_recurrentes(date)` (`security definer`, `42501` si no admin, períodos y fechas programadas de **P6**, tope 12 por plantilla, `on conflict do nothing`, no genera para empleados inactivos ni fechas futuras). `revoke … from public, anon`; `grant execute … to authenticated`.
    - Hecho: llamar dos veces seguidas genera lo mismo una sola vez; un período descartado no se regenera; una plantilla con `fecha_inicio` hace 2 años genera 12; una nómina quincenal con `monto` nulo toma la mitad del salario (P3).
15. **Tipos y dominio**: `FrecuenciaGasto`, `GastoRecurrente`, `PeriodoRecurrente`; `periodosRecurrente(plantilla, hasta)` y `proximasFechas(plantilla, n)` en `src/lib/gastos/periodos.ts` (espejo de la SQL); `src/lib/gastoRecurrenteValidation.ts`. Casos en `scripts/probar-gastos.ts`: mensual con `dia_mes` 28 y `null`, quincenal en febrero, `fecha_inicio` a mitad de mes, `fecha_fin`, y paridad TS ↔ SQL con `--sql`.
16. **Repositorio y servicio**: `IGastoRecurrenteRepository` + `gastoRecurrenteRepository.ts` (`list`, `create`, `update`, `generar(hasta)` → RPC); `gastoRecurrenteService.ts` (CRUD con `requireAdmin()`, `generarPendientes()`); `gastoService.confirmarGasto` (tasa resuelta para la fecha final) y `descartarGasto`.
17. **UI**: `GastosRecurrentesTable`, `GastoRecurrenteForm` (con las próximas 3 fechas), tab "Recurrentes"; `GastoForm` modo `confirmar`; chips Pendientes y `Alert` de pendientes en la tab Gastos; `⋮` Confirmar / Descartar. `page.tsx` de `/gastos` llama a `gastoRecurrenteService.generarPendientes()` antes de listar (**P4**) y el botón "Generar pendientes" hace lo mismo por Server Action.
    - Hecho: una plantilla de alquiler mensual creada con inicio el mes anterior muestra 1–2 pendientes al abrir `/gastos`; confirmar uno con tasa referencial lo suma al total del rango; descartar otro lo saca y no vuelve.
18. **Tarea agregada en 08 (P5 aprobada el 2026-10-22)**: la lectura de "Operaciones con tasa manual" (`src/app/(protected)/tasas/operaciones-tasa-manual.ts`) incluye `gastos` confirmados con `tasa_origen = 'manual'` (tipo "Gasto", enlace a `/gastos?…`). Ya anotada en `specs/08-tasas/tasks.md` y en "Cambios de alcance registrados" de `specs/README.md`.

## Fase D — Dashboard (tarea agregada en 15-dashboard)

Rama sugerida `feat/gastos-dashboard`; commits `feat(dashboard): gastos del período y utilidad neta`.

19. **`supabase/migrations/20261022000300_dashboard_gastos.sql`**: `dashboard_gastos(p_desde, p_hasta)` y `dashboard_gastos_pendientes()` según `spec.md` (`stable`, `security definer`, `set search_path = public`, `42501` con `dashboard_exigir_admin()` de 15, `revoke … from public, anon`, `grant execute … to authenticated`). Solo `estado = 'confirmado'` y `fecha` en el rango (**P2**). Si la Fase C aún no existe, `dashboard_gastos_pendientes` devuelve 0 (o se difiere a esa fase, anotándolo).
    - Hecho: Σ `total_usd` = Σ `monto_usd` confirmados del rango; anulados, descartados y pendientes fuera; operador → `42501`.
20. **Tipos, dominio y repositorio**: `GastosPendientesResumen`, `UtilidadNeta` en `domain.ts`; `utilidadNeta(margenBruto, gastos, ventas)` en `src/lib/dashboard/utilidad.ts` (con % sobre ventas y ventas 0 → `null`), casos en `scripts/probar-dashboard.ts`; dos métodos en `IDashboardRepository` / `dashboardRepository.ts`.
21. **`dashboardService`**: bloque `gastos` (`{ ok, data } | { ok: false, error }`) solo para admin, compuesto con el margen bruto de `dashboard_productos_salida` del mismo rango (sin llamar dos veces a la RPC: reutilizar el resultado del bloque B2/B3). El resultado cambiario no se suma.
    - Hecho: con rol operador el bloque es `undefined` y no se llaman las RPC nuevas.
22. **UI**: `organisms/UtilidadNetaCard` y `organisms/GastosCategoriaChart` en la sección "Ventas y margen" de `(dashboard)/dashboard-secciones.tsx` (con `Suspense` propio), y `KpiCard` "Gastos pendientes de confirmar" en `KpisDiaRow` (admin, solo si `n > 0`). Colores solo del theme, `ChartLegendTable`, `aria-label`, `lib/format.ts`.
    - Hecho: con datos de prueba, utilidad neta = margen bruto de `ProductosSalidaTable` − gastos de `/gastos` en el mismo rango; negativa se ve en tono `error`.
23. **`specs/15-dashboard/`**: marcar como hecha la tarea agregada del 2026-10-22 en `tasks.md`.

## Fase E — Documentación y verificación (no saltarse)

24. **Documentación global**:
    - `/SPEC.md`: §5 (tablas `categorias_gasto`, `empleados`, `gastos`, `gastos_recurrentes`), §7 (pantalla "Gastos", solo admin) y §9 (aclarar que el control de gastos operativos de `specs/20-gastos` no es contabilidad formal), con nota del 2026-10-22. **No** reabrir §2 ni §9.
    - `specs/README.md`: orden y cambio de alcance (hecho al planificar el 2026-10-22; revisar que siga vigente y agregar P5 si se aprobó).
    - `specs/00-estandares-ui/spec.md`: registrar en "Componentes compartidos" cualquier componente genérico nuevo (si `AnularGastoDialog` se generaliza como diálogo de motivo, registrarlo; si no, anotar en el checklist que no hubo).
25. Aplicar las migraciones en un Postgres local (método del checklist de 16–19) sobre una base con datos sembrados, en orden A → B → C → D, y comprobar que la siembra es idempotente y que cada versión de `gastos_guard` conserva las reglas anteriores.
26. **Casos de negocio** (admin):
    - Gasto en Bs 3.650,00 a 36,50 (referencial) → $100,000000; mismo gasto con tasa manual 40,00 → $91,250000 y aparece con su procedencia (y en `/tasas` si P5).
    - Anular con motivo "pagado dos veces" → fuera del total, visible con usuario y fecha; "Registrar de nuevo" precarga los datos.
    - Editar un confirmado según P1 (b: solo descripción/referencia/notas; importe bloqueado con `gasto_inmutable`).
    - Categoría: crear "Mantenimiento › Cava", desactivar "Transporte" (sus gastos siguen en reportes), intentar desactivar Nómina → `categoria_sistema`.
    - Nómina: empleado con salario mensual $400; pago 1.ª quincena precargado en $200; costo del empleado en la ficha.
    - Recurrentes: alquiler mensual día 5 y nómina quincenal; generación idempotente; confirmar con tasa del día; descartar.
27. **Dashboard**: con un mes de ventas y gastos de prueba, utilidad neta y gastos por categoría cuadran con `/gastos`; ninguna RPC `dashboard_*` existente cambió; `dashboard_resultado_cambiario` idéntico.
28. **Sesión de operador**: `/gastos` y `/gastos/empleados/[id]` dan 404; sin ítem de menú; las 4 tablas dan 0 filas e `insert`/`update` fallan por PostgREST; `generar_gastos_recurrentes`, `dashboard_gastos` y `dashboard_gastos_pendientes` dan `42501`.
29. `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npx tsx scripts/probar-gastos.ts` y `npx tsx scripts/probar-dashboard.ts`.
30. Aplicar las migraciones en Supabase en orden. Revisión visual en claro/oscuro y en 375/768/1024/1440 px (`GastoForm` `fullScreen` en `xs`).
31. Recorrer `checklist.md`.

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "NN-modulo necesita … — agregado el <fecha>")_
