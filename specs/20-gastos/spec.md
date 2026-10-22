# 20 — Gastos operativos y nómina

## Contexto

Pedido del usuario (2026-10-22): un módulo para **llevar los gastos de la empresa** (mantenimiento, pago de nómina, servicios, etc.), **medirlos y tener trazabilidad** de ellos.

**No es contabilidad formal.** `/SPEC.md` §9 deja fuera "Contabilidad formal (mayor, balance)" y eso **no se reabre**: este módulo es un **control de gastos operativos** (registro, categorías, nómina por empleado, recurrentes y su efecto en la utilidad del dashboard). No hay plan de cuentas, asientos de partida doble, mayor, balance general, cierres de período ni conciliación bancaria.

Lo que existe hoy y se reutiliza (sin recalcularlo de otra forma):

| Pieza existente | Dónde | Uso en este módulo |
|---|---|---|
| Moneda base USD, Bs operativa; snapshot de tasa con procedencia | `/SPEC.md` §2; columnas `tasa_origen`, `tasa_fuente`, `tasa_referencial`, `tasa_registrada_por` y el check `*_tasa_coherente` (`supabase/migrations/0019_tasa_operaciones.sql`) | Mismas columnas, check y trigger `fija_tasa_registrada_por()` en `gastos` |
| Resolución de tasa de una operación | `tasaService.resolverTasaOperacion` (`src/lib/services/tasaService.ts`), `camposTasa` + `validarTasa` (`src/lib/tasaValidation.ts`), `TasaSelector` (`src/components/organisms/TasaSelector.tsx`, 08) | Registrar y confirmar un gasto: referencial por defecto o manual, igual que compras |
| Conversión a USD de un monto pactado | Regla de `costoUsdKg` / `costo_kg_pactado` (`specs/19-edicion-compras/spec.md`, "Costo pactado en la moneda de la compra") | `monto_usd = moneda = 'usd' ? round(monto, 6) : round(monto / tasa, 6)` |
| Métodos de pago | Check de `pagos.metodo` (`0001_initial_schema.sql`) | Mismo dominio en `gastos.metodo_pago` |
| Rol admin | `es_admin()` (`0002_roles_y_perfiles.sql`), `requireAdmin()` (`src/lib/services/authService.ts`), `adminOnly` en `NAV_ITEMS` (`src/components/templates/AppShell.tsx`) | RLS de todas las tablas nuevas, página y menú |
| "Hoy" de Venezuela | `(now() at time zone 'America/Caracas')::date`, `fechaHoy()` en `lib/format.ts` | Fecha no futura, generación de recurrentes |
| Dashboard por período | `15-dashboard` (`?desde`/`?hasta`, `dashboard_productos_salida` = margen bruto B3, regla "margen USD y resultado cambiario Bs nunca se suman") | Gastos confirmados del período y utilidad neta (ver "Efecto en 15-dashboard") |
| Componentes de 00 Fase 2 | `AppDataGrid`, `AppDialog`, `FichaHeader`, `FormSection`, `NumberField`, `RifCiField`, `StatusChips`, `EmptyState`, `RangoFechasSelector`, `KpiCard`, `ChartCard`, `ListaResumen` (tabla de `specs/00-estandares-ui/spec.md`) | Toda la UI del módulo |

Depende de `01-auth` (roles), `08-tasas` y `15-dashboard` (hechos). No toca el esquema de ningún otro módulo; solo agrega una RPC al dashboard (tarea agregada en `15-dashboard/tasks.md`).

## Decisiones cerradas (2026-10-22, con el usuario)

| Tema | Decisión |
|---|---|
| Nómina | Tabla `empleados` (nombre, cédula, cargo, salario base, moneda, activo). Cada **pago de nómina es un gasto** de la categoría Nómina ligado a **un empleado** y a un **período** (desde/hasta). Permite ver el costo por empleado. **Sin conceptos ni deducciones** (bonos, IVSS, FAOV, anticipos, etc.). |
| Categorías | Catálogo administrable `categorias_gasto` con **subcategoría opcional** (un nivel). Se siembran: Mantenimiento, Nómina, Servicios, Transporte, Hielo / insumos, Alquiler, Otros. **Nómina es de sistema**: no se borra, no se desactiva ni se renombra, y a ella caen los pagos de nómina. |
| Moneda y tasa | Cada gasto en **USD o Bs** con la tasa guardada como **snapshot** y su procedencia (referencial por defecto o manual), con la resolución de 08 igual que compras (`/SPEC.md` §2). El monto se **normaliza a USD** (`monto_usd`) para los reportes. |
| Recurrentes | **Plantillas** (p. ej. alquiler mensual, nómina quincenal por empleado) que generan el gasto en estado **pendiente de confirmar** en cada período; el admin **confirma** (ajustando monto y tasa) o **descarta**. |
| Permisos | **Solo admin**: RLS con `es_admin()` en todas las tablas nuevas (lectura y escritura) y menú `adminOnly`. El operador no ve nada del módulo. |
| Dashboard | `15-dashboard` suma los **gastos confirmados** del período y muestra **utilidad neta = margen bruto − gastos**, y los gastos por categoría. |
| Trazabilidad | Sin comprobante adjunto ni historial completo de cambios (no lo pidió el usuario). Trazabilidad mínima: `created_by` / `updated_by` + timestamps, quién confirmó y cuándo, y **anulación con motivo en lugar de borrado** (nunca `delete`). |

## Decisiones de diseño P1–P6 (cerradas el 2026-10-22)

El usuario aprobó el 2026-10-22 la **recomendación** de las seis; la spec y las tareas ya están escritas con ella. Las otras opciones quedan como registro de lo descartado.

| # | Tema | Opciones | Aprobada | Afecta |
|---|---|---|---|---|
| P1 | **¿Se edita un gasto confirmado?** | a) Edición libre de todos los campos, solo con `updated_by`/`updated_at` (se pierde el valor anterior). b) **Solo anular y re-registrar**: confirmado inmutable en importe, moneda, tasa, fecha, categoría y empleado; editable solo en descripción, beneficiario, referencia y notas. Para corregir importe se anula con motivo y se usa "Registrar de nuevo" (precarga un gasto nuevo con los mismos datos). | **b**: sin tabla de historial, la anulación con motivo es la única forma de que el valor anterior no se pierda; el costo de captura es un clic. | Trigger `gastos_guard`, `gastoService.editarGasto`, `GastoForm` (modo edición); tareas 1, 6 y 7 |
| P2 | **Fecha de imputación** (en qué período cuenta un gasto) | a) **`gastos.fecha`** (fecha en que se pagó o incurrió). b) Fecha del período que cubre (`periodo_hasta`). | **a**: una sola regla para todos los gastos; el período queda informativo (la nómina de la 2.ª quincena de octubre pagada el 31/10 cuenta en octubre por cualquiera de las dos). | `dashboard_gastos`, filtros de `/gastos`; tareas 6 y 19 |
| P3 | **Salario base y nómina quincenal** | a) **`salario_base` es mensual**; la plantilla quincenal precarga `salario_base / 2` y la mensual el salario completo. b) `salario_base` es por período de pago (el empleado lleva su frecuencia). | **a**: es como se pacta el salario en Venezuela; el monto se ajusta al confirmar. | `gasto_recurrente_monto`, `EmpleadoForm`, `montoNominaPeriodo`; tareas 11 y 14 |
| P4 | **Cuándo se generan los pendientes** | a) **A demanda**: al abrir `/gastos` (y con un botón "Generar pendientes") el servidor llama a una RPC idempotente que crea los que falten hasta hoy. b) Cron diario de Vercel (como `/api/cron/tasas`) con `service_role`. | **a**: sin `service_role` ni cron nuevo; idempotente por índice único; el admin ve los pendientes justo cuando entra a revisarlos. El dashboard no los necesita (solo cuenta confirmados). | Tarea 17; `vercel.json` (no se toca con a) |
| P5 | **Gastos con tasa manual en `/tasas`** | a) **Sí**: la pestaña "Operaciones con tasa manual" de 08 incluye los gastos con `tasa_origen = 'manual'`. b) No, solo se ve en `/gastos`. | **a**: el control de tasas manuales del admin queda completo. Requiere tarea agregada en `08-tasas` (lectura nueva, sin cambiar su esquema). | Tarea 18; anotada en `specs/08-tasas/tasks.md` el 2026-10-22 |
| P6 | **Frecuencias de recurrentes** | a) **Mensual y quincenal**. b) Además semanal. | **a**: cubre los ejemplos del pedido (alquiler mensual, nómina quincenal); semanal queda fuera de alcance. | Check de `gastos_recurrentes.frecuencia`, `periodosRecurrente` |

## Decisión de diseño

### Un pago de nómina es un gasto

No hay tabla `pagos_nomina` aparte: un pago de nómina es una fila de `gastos` con `empleado_id` y la categoría de sistema Nómina. Así el total de gastos, el dashboard, la anulación, la tasa y la trazabilidad son **una sola regla** para todo, y el costo por empleado es `Σ monto_usd` de sus gastos confirmados. La coherencia la asegura un trigger: `empleado_id` no nulo ⇔ categoría Nómina, y la nómina exige `periodo_desde` / `periodo_hasta`.

### Estados del gasto

| Estado | Cómo nace / llega | Cuenta en reportes | Editable |
|---|---|---|---|
| `pendiente` | Solo lo crea la generación de recurrentes. Puede no tener tasa ni `monto_usd` | No | Sí (monto, moneda, fecha, descripción, etc.) |
| `confirmado` | Alta manual (nace confirmado) o confirmación de un pendiente (con tasa resuelta) | **Sí** | Según **P1** (recomendado: solo descripción, beneficiario, referencia y notas) |
| `descartado` | Desde `pendiente` (motivo opcional) | No | No (terminal; impide que el período se regenere) |
| `anulado` | Desde `confirmado`, **motivo obligatorio** (5–500) | No | No (terminal) |

Transiciones permitidas: `pendiente → confirmado | descartado`, `confirmado → anulado`. Nada vuelve atrás y no hay `delete` (sin política y `revoke delete`).

### Escritura directa con RLS + triggers (sin RPC salvo la generación)

A diferencia de compras o correcciones (multitabla, con locks), un gasto es **una fila**: el repositorio escribe directo en `gastos`, `categorias_gasto`, `empleados` y `gastos_recurrentes` bajo RLS `es_admin()`, y los **triggers** hacen cumplir las invariantes (transiciones, `monto_usd`, coherencia de nómina, categoría de sistema, `updated_by`/`updated_at`, `confirmado_por`/`anulado_por`). La única RPC es `generar_gastos_recurrentes`, porque inserta N filas idempotentes. El servicio resuelve la tasa con `resolverTasaOperacion` antes de escribir (nunca confía en la referencial del cliente).

### Normalización a USD

`monto` se guarda en la moneda del gasto (`numeric(14,6)`; la UI captura 2 decimales) y `monto_usd` con la regla de compras. Un check lo garantiza para todo gasto con tasa. Los reportes **solo** suman `monto_usd`: los gastos en Bs quedan valorados a la tasa del día del gasto y **no se revalúan** (no hay resultado cambiario de gastos; un gasto se paga al registrarlo, no hay cuenta por pagar).

### Generación de recurrentes (idempotente)

`generar_gastos_recurrentes(p_hasta date default hoy)` recorre las plantillas activas y, por cada período cuya **fecha programada** sea ≥ `fecha_inicio`, ≤ `coalesce(fecha_fin, p_hasta)` y ≤ `p_hasta`, inserta un gasto `pendiente` si no existe ya uno para `(recurrente_id, periodo_desde)` (índice único parcial, `on conflict do nothing`). Un período descartado o anulado **no se vuelve a generar**. Tope de 12 períodos por plantilla y llamada, para no inundar si una plantilla se crea con fecha antigua. Períodos (P6):

| Frecuencia | Períodos | Fecha programada |
|---|---|---|
| `mensual` | Mes calendario (`periodo_desde` = día 1, `periodo_hasta` = último día) | `dia_mes` del mes (1–28) o, si es `null`, el último día |
| `quincenal` | 1–15 y 16–último día | Día 15 y último día |

Monto del pendiente: el de la plantilla; si la plantilla es de nómina y su `monto` es `null`, el salario vigente del empleado (`salario_base` entero en mensual, `/ 2` en quincenal, P3) y su moneda. Un empleado inactivo no genera. El espejo TS de los períodos (`periodosRecurrente`) vive en `src/lib/gastos/periodos.ts` y se prueba en paridad con la SQL.

## Modelo de datos

Dinero `numeric(14,6)`, tasas `numeric(14,6)` (`/SPEC.md` §5). Todas las tablas: `created_at timestamptz not null default now()`, `created_by uuid not null default auth.uid() references perfiles`, `updated_at timestamptz not null default now()`, `updated_by uuid null references perfiles`, mantenidos por el trigger genérico nuevo `fija_auditoria()` (pone `updated_at = now()` y `updated_by = auth.uid()` en cada `update`, y no deja cambiar `created_*`).

### `categorias_gasto` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `nombre` | text not null | `btrim`, 2–60. Único sin distinguir mayúsculas **dentro del mismo padre**: índice único `(coalesce(categoria_padre_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nombre)))` |
| `categoria_padre_id` | uuid null FK `categorias_gasto` | `null` = categoría; no nulo = subcategoría. Un solo nivel: el padre no puede tener padre (trigger) |
| `clave` | text null unique | Solo las de sistema: `'nomina'` |
| `es_sistema` | boolean not null default false | |
| `activo` | boolean not null default true | Desactivar en lugar de borrar |
| `orden` | smallint not null default 0 | Orden de presentación |
| auditoría | | Ver arriba |

Siembra (en la migración, idempotente por nombre): Mantenimiento, **Nómina** (`clave = 'nomina'`, `es_sistema = true`), Servicios, Transporte, Hielo / insumos, Alquiler, Otros.

Trigger `categorias_gasto_guard`: una de sistema no cambia `nombre`, `clave`, `es_sistema`, `activo` ni `categoria_padre_id`; nadie fija `es_sistema`/`clave` desde la app (solo la migración); Nómina no admite subcategorías; el padre debe ser de primer nivel. Errores `P0001` con `hint` `categoria_sistema`, `categoria_nivel`, `categoria_nomina_sin_sub`.

### `empleados` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `nombre` | text not null | 2–120 |
| `cedula` | text not null unique | Formato de `RifCiField` (`V-`/`E-`), normalizada como en clientes |
| `cargo` | text null | ≤ 80 |
| `salario_base` | numeric(14,6) not null, check ≥ 0 | **Mensual** (P3), en `moneda` |
| `moneda` | text not null check `in ('usd','bs')` | |
| `activo` | boolean not null default true | Desactivar en lugar de borrar |
| `notas` | text null | ≤ 500 |
| auditoría | | |

Cambiar el salario no toca pagos hechos (cada gasto es snapshot). Sin historial de salario (fuera de alcance).

### `gastos` (nueva)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `fecha` | date not null | Fecha del gasto (imputación, P2). No futura (Caracas) al crear o confirmar |
| `categoria_id` | uuid not null FK `categorias_gasto` | Categoría o subcategoría **activa** al crear/confirmar |
| `descripcion` | text not null | Concepto, 3–200 |
| `beneficiario` | text null | A quién se pagó (texto libre, ≤ 120) |
| `moneda` | text not null check `in ('usd','bs')` | |
| `monto` | numeric(14,6) not null, check > 0 | En `moneda` |
| `tasa_snapshot` | numeric(14,6) null, check > 0 | Obligatoria salvo en `pendiente` |
| `tasa_origen` | text null check `in ('referencial','manual')` | Ídem |
| `tasa_fuente` | text null check `in ('bcv','paralela')` | |
| `tasa_referencial` | numeric(14,6) null | |
| `tasa_registrada_por` | uuid null FK `perfiles` | Trigger `fija_tasa_registrada_por()` (0019) |
| `monto_usd` | numeric(14,6) null | Obligatorio salvo en `pendiente` |
| `metodo_pago` | text null | Dominio de `pagos.metodo` |
| `referencia` | text null | N.º de transferencia, factura del proveedor del servicio, etc. (≤ 80) |
| `notas` | text null | ≤ 500 |
| `periodo_desde`, `periodo_hasta` | date null | Período que cubre (alquiler de octubre, quincena). Ambos o ninguno; `desde ≤ hasta`. Obligatorios en nómina |
| `empleado_id` | uuid null FK `empleados` | **Fase B**. No nulo ⇔ categoría Nómina |
| `recurrente_id` | uuid null FK `gastos_recurrentes` | **Fase C**. Plantilla que lo generó |
| `estado` | text not null default `'confirmado'` check `in ('pendiente','confirmado','descartado','anulado')` | Ver "Estados del gasto" |
| `confirmado_por`, `confirmado_at` | uuid null FK `perfiles`, timestamptz null | Los fija el trigger al pasar a `confirmado` (o al nacer confirmado) |
| `anulado_por`, `anulado_at` | uuid null FK `perfiles`, timestamptz null | Los fija el trigger al pasar a `anulado` o `descartado` |
| `motivo_anulacion` | text null | Obligatorio (5–500) en `anulado`; opcional en `descartado` |
| auditoría | | |

Checks:

- `gastos_tasa_coherente`: `tasa_origen <> 'referencial' or tasa_referencial = tasa_snapshot` (patrón 0019).
- `gastos_confirmado_completo`: `estado = 'pendiente' or (tasa_snapshot is not null and tasa_origen is not null and monto_usd is not null)`.
- `gastos_monto_usd`: `monto_usd is null or monto_usd = case moneda when 'usd' then round(monto, 6) else round(monto / tasa_snapshot, 6) end`.
- `gastos_periodo`: `(periodo_desde is null) = (periodo_hasta is null) and (periodo_desde is null or periodo_desde <= periodo_hasta)`.
- `gastos_anulado_motivo`: `estado <> 'anulado' or char_length(btrim(motivo_anulacion)) between 5 and 500`.

Trigger `gastos_guard` (`before insert or update`):

- Insert: `estado = 'confirmado'`, o `pendiente` **solo** si `recurrente_id` no es nulo (lo usa la RPC). Fecha no futura. Categoría activa. Si la categoría es Nómina, `empleado_id` y período obligatorios y empleado activo; si no, `empleado_id` nulo (en Fase A, la categoría Nómina se rechaza con `categoria_nomina_requiere_empleado` hasta que exista Fase B).
- Update: solo las transiciones de "Estados del gasto"; `descartado` y `anulado` inmutables; en `confirmado`, solo cambian los campos que permita **P1** (o la transición a `anulado`); `recurrente_id`, `created_*` no cambian nunca. Fija `confirmado_*` / `anulado_*`.
- Errores `P0001`, `hint`: `transicion_invalida`, `gasto_inmutable`, `fecha_futura`, `categoria_inactiva`, `categoria_nomina_requiere_empleado`, `empleado_requiere_nomina`, `empleado_inactivo`, `periodo_requerido`, `motivo_requerido`.

Índices: `(fecha) where estado = 'confirmado'`, `(categoria_id, fecha)`, `(empleado_id, fecha) where empleado_id is not null`, `(estado) where estado = 'pendiente'`, único parcial `(recurrente_id, periodo_desde) where recurrente_id is not null`.

### `gastos_recurrentes` (nueva, Fase C)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `nombre` | text not null | "Alquiler del local", "Nómina — Pedro Pérez" (2–80) |
| `categoria_id` | uuid not null FK `categorias_gasto` | |
| `empleado_id` | uuid null FK `empleados` | No nulo ⇔ categoría Nómina (mismo trigger que gastos) |
| `descripcion` | text not null | Se copia al gasto generado |
| `beneficiario` | text null | Se copia |
| `moneda` | text not null check `in ('usd','bs')` | En nómina con `monto` nulo, se usa la del empleado |
| `monto` | numeric(14,6) null, check > 0 | `null` solo en nómina = salario vigente del empleado (P3) |
| `frecuencia` | text not null check `in ('mensual','quincenal')` | P6 |
| `dia_mes` | smallint null check `between 1 and 28` | Solo mensual; `null` = último día |
| `fecha_inicio` | date not null | |
| `fecha_fin` | date null | ≥ `fecha_inicio` |
| `metodo_pago` | text null | Se copia como sugerencia |
| `activo` | boolean not null default true | Pausar sin perder lo generado |
| auditoría | | |

Sin `delete`: se desactiva. Desactivar no toca los pendientes ya generados (se confirman o descartan).

### RLS (las cuatro tablas)

`enable row level security`; políticas `select`, `insert`, `update` **solo `es_admin()`**; **sin** política de `delete`; `revoke all … from anon`; `revoke delete, truncate … from authenticated`. Mismo patrón de solo admin que `contratos` (06).

### RPC

| Función | Tipo | Nota |
|---|---|---|
| `generar_gastos_recurrentes(p_hasta date default null) → jsonb` | `security definer`, `set search_path = public`, `42501` si no `es_admin()` | Ver "Generación de recurrentes". `p_hasta` nulo = hoy (Caracas); no acepta fechas futuras. Devuelve `{ generados, por_recurrente: [{ recurrente_id, n }] }`. `grant execute … to authenticated`, `revoke … from public, anon` |
| `gasto_recurrente_monto(p_recurrente_id uuid) → table(moneda, monto)` | interna, sin `grant` | Monto del pendiente (plantilla o salario, P3) |
| `dashboard_gastos(p_desde date, p_hasta date) → table(...)` | `stable`, `security definer`, `42501` si no admin (patrón de 15) | Gastos `confirmado` con `fecha` en el rango (P2), por categoría de primer nivel y subcategoría: `categoria_id`, `categoria`, `es_sistema`, `subcategoria_id`, `subcategoria`, `total_usd`, `n_gastos`. Va en la migración de la Fase D |
| `dashboard_gastos_pendientes() → table(n, monto_usd_estimado)` | ídem | Pendientes hasta hoy (USD estimado solo de los que están en USD; los de Bs cuentan en `n`) |

## Reglas de negocio

- **Alta manual**: nace `confirmado`; la tasa se resuelve con `resolverTasaOperacion(entrada, fecha)` (referencial por defecto de `fuente_tasa_default`, o manual con la confirmación por desviación de 08). Con moneda USD también se guarda la tasa (para el equivalente en Bs, como compras).
- **Confirmar un pendiente**: el admin ajusta fecha (≤ hoy), monto, moneda, tasa (resuelta para la fecha final), método, referencia y notas; pasa a `confirmado`.
- **Descartar** un pendiente: motivo opcional; el período no se regenera.
- **Anular** un confirmado: motivo obligatorio 5–500; deja de contar en reportes y en el costo del empleado; queda visible con chip "Anulado", quién y cuándo. "Registrar de nuevo" abre `GastoForm` precargado (P1).
- **Nómina**: categoría Nómina ⇔ empleado; período obligatorio; empleado activo al registrar. El formulario precarga monto y moneda con el salario del empleado (mensual o la mitad si el período es una quincena, P3), editable. Se avisa (no se bloquea) si ya hay un pago confirmado del mismo empleado con período solapado.
- **Categorías**: crear, renombrar, ordenar y desactivar (las de sistema no). Desactivar una categoría la oculta en los selectores (y a sus subcategorías) pero conserva sus gastos. Un gasto cuenta en su categoría de primer nivel y, si tiene, en su subcategoría.
- **Empleados**: crear, editar y desactivar; la cédula es única. Un inactivo no recibe pagos nuevos ni genera recurrentes.
- **Costo por empleado**: `Σ monto_usd` de sus gastos confirmados en un rango, número de pagos y promedio mensual; en la ficha, con equivalente en Bs a la tasa de cada pago (`Σ monto_usd × tasa_snapshot`).
- **Moneda**: los totales siempre en USD (`monto_usd`); el equivalente en Bs de un gasto usa **su** tasa snapshot, nunca la del día.

## Pantallas

Todas solo admin: `page.tsx` server con `requireAdmin()` → `notFound()` (precedente `/contratos` y `/compras/[id]`; `params`/`searchParams` son `Promise` en Next 16, revisar `node_modules/next/dist/docs/`). Menú: `{ href: '/gastos', label: 'Gastos', icon: <AccountBalanceWalletOutlined />, adminOnly: true }` en `NAV_ITEMS`.

### `/gastos`

- `PageHeader` "Gastos" con primario "Registrar gasto" y secundario "Pago de nómina" (abre `GastoForm` en modo nómina).
- Tabs persistentes en `?tab=` (patrón 12): **Gastos** · **Recurrentes** (Fase C) · **Empleados** (Fase B) · **Categorías**.
- **Gastos**: `RangoFechasSelector` (`?desde`/`?hasta`, default mes en curso), filtro de categoría y chips de estado en `?estado=` (Confirmados por defecto · Pendientes · Anulados/descartados · Todos). `KpiCard` arriba: total USD del rango, n.º de gastos y top categoría. `organisms/GastosTable` (`AppDataGrid`, modo cliente): fecha, categoría › subcategoría, descripción (+ beneficiario/empleado en `caption`), monto en su moneda, USD, tasa con su procedencia (texto «36,50 · BCV» o «40,00 · manual»; hoy no existe un chip de procedencia: si se crea uno genérico, registrarlo en 00), estado (chip); `⋮`: Confirmar / Descartar (pendiente), Editar (P1), Anular, Registrar de nuevo, Ver detalle. `Alert info` «Tienes N gastos pendientes de confirmar» con enlace a `?estado=pendiente`. `EmptyState` sin gastos.
- **Categorías**: `organisms/CategoriasGastoPanel`: lista agrupada (categoría con sus subcategorías), chip "Sistema" en Nómina, acciones Nueva subcategoría / Renombrar / Desactivar–Activar; `CategoriaGastoForm` en `AppDialog xs`.
- **Empleados** (Fase B): `organisms/EmpleadosTable` (`AppDataGrid`): nombre, cédula, cargo, salario base (moneda), pagado en el mes en curso (USD), `StatusChips`; fila enlaza a la ficha; `EmpleadoForm` en `AppDialog sm`.
- **Recurrentes** (Fase C): `organisms/GastosRecurrentesTable`: nombre, categoría/empleado, monto (o «Salario vigente»), frecuencia, próxima fecha programada, activo; `GastoRecurrenteForm` en `AppDialog sm`; botón "Generar pendientes".

### `/gastos/empleados/[id]` (Fase B)

`FichaHeader` (nombre, cédula, cargo, `StatusChips`; primario "Registrar pago"; `⋮` Editar / Desactivar), `KpiCard`s de costo (pagado en el rango, n.º de pagos, promedio mensual) con `RangoFechasSelector`, y tabla de pagos (período, fecha, monto, USD, estado) reutilizando `GastosTable` filtrada. `loading.tsx`, `error.tsx`, `not-found.tsx`.

### Diálogos

| Organism | Tamaño | Contenido |
|---|---|---|
| `GastoForm` | `AppDialog md` (`fullScreen` en `xs`) | Modos `crear` / `nomina` / `confirmar` / `editar` (P1) / `registrar_de_nuevo`. `FormSection` "Gasto": fecha (máx. hoy), categoría › subcategoría (Autocomplete agrupado), descripción, beneficiario; en nómina, empleado (Autocomplete de activos) y período (atajos "1.ª quincena", "2.ª quincena", "Mes"). `FormSection` "Monto y tasa": moneda, `NumberField` (2 dec.), `TasaSelector` para la fecha, equivalente en vivo (USD o Bs). `FormSection` "Pago": método, referencia, notas. `useForm({ disabled })`, `Button loading`, cierre protegido con `dirty`, confirmación por desviación de tasa manual (`pedirConfirmacionTasaManual`), errores de `hint` en su campo |
| `AnularGastoDialog` | `AppDialog xs` | Resumen del gasto y "Motivo *" (5–500); primario `color="error"`; mismo patrón que `BloqueoDialog`. Con `modo="descartar"` el motivo es opcional |
| `GastoDetalleDialog` | `AppDialog sm` | Datos completos y trazabilidad: creado por/cuándo, confirmado por/cuándo, última edición, anulado o descartado por/cuándo y motivo, plantilla de origen, tasa con procedencia |
| `CategoriaGastoForm` | `AppDialog xs` | Nombre, padre (opcional), orden |
| `EmpleadoForm` | `AppDialog sm` | Nombre, `RifCiField` (cédula), cargo, salario base mensual + moneda, notas |
| `GastoRecurrenteForm` | `AppDialog sm` | Nombre, categoría o empleado (nómina), descripción, beneficiario, monto + moneda (o «Usar salario del empleado»), frecuencia, día del mes, inicio/fin, método sugerido; vista de las próximas 3 fechas programadas |

## Efecto en 15-dashboard (tarea agregada)

- RPC nuevas `dashboard_gastos(p_desde, p_hasta)` y `dashboard_gastos_pendientes()` (en la migración de la Fase D de este módulo; mismo patrón de seguridad que las `dashboard_*`). **Ninguna RPC existente de 15 cambia.**
- Sección "Ventas y margen" (admin): `organisms/UtilidadNetaCard`: ventas USD, margen bruto USD (total de B3, netos de notas de crédito y sin IVA, D4 de 15), gastos confirmados USD y **utilidad neta = margen bruto − gastos**, con % sobre ventas y tono `error` si es negativa. El **resultado cambiario Bs sigue aparte** (regla de 15: no se suma a cifras en USD). `organisms/GastosCategoriaChart` (barras horizontales por categoría con `ChartCard` + `ChartLegendTable`, enlace a `/gastos?desde&hasta&categoria`).
- `KpiCard` "Gastos pendientes de confirmar" en la fila del admin (solo si `n > 0`), enlace a `/gastos?estado=pendiente`.
- `dashboardService`: un bloque más (`{ ok, data }`), solo para admin; la utilidad neta la calcula la función pura `utilidadNeta(margenBruto, gastos, ventas)` en `src/lib/dashboard/utilidad.ts`.
- El operador no recibe ni pide nada de esto.

## Arquitectura por capas (archivos)

| Capa | Archivo | Contenido |
|---|---|---|
| Migraciones | `supabase/migrations/20261022000000_gastos_esquema.sql` (A), `…000100_gastos_nomina.sql` (B), `…000200_gastos_recurrentes.sql` (C), `…000300_dashboard_gastos.sql` (D) | Ver `tasks.md` |
| Tipos | `src/types/domain.ts` | `EstadoGasto`, `CategoriaGasto` (+ `subcategorias`), `Gasto`, `GastoDetalle` (con nombres de usuarios), `Empleado`, `CostoEmpleado`, `FrecuenciaGasto`, `GastoRecurrente`, `PeriodoRecurrente`, `GastoPorCategoria`, `GastosPendientesResumen`, `UtilidadNeta` |
| Dominio puro | `src/lib/gastos/montos.ts` (`montoUsdGasto`, `montoNominaPeriodo`), `src/lib/gastos/periodos.ts` (`periodosRecurrente`, `proximasFechas`, `atajosPeriodo`), `src/lib/dashboard/utilidad.ts` (`utilidadNeta`) | Sin Supabase ni React |
| Validación | `src/lib/gastoValidation.ts` (`gastoFormSchema` con `camposTasa` + `validarTasa`, `anularGastoSchema`, `descartarGastoSchema`), `src/lib/categoriaGastoValidation.ts`, `src/lib/empleadoValidation.ts`, `src/lib/gastoRecurrenteValidation.ts` | Mensajes en `lib/validationMessages.ts` |
| Repositorios | `interfaces.ts` (`ICategoriaGastoRepository`, `IGastoRepository`, `IEmpleadoRepository`, `IGastoRecurrenteRepository`; `IDashboardRepository` + 2 métodos), `categoriaGastoRepository.ts`, `gastoRepository.ts`, `empleadoRepository.ts`, `gastoRecurrenteRepository.ts`, `dashboardRepository.ts` | Solo acceso y mapeo `numeric → number` |
| Servicios | `categoriaGastoService.ts`, `gastoService.ts` (registrar, confirmar, descartar, anular, editar según P1, listar, resumen), `empleadoService.ts` (CRUD + `getCostoEmpleado`), `gastoRecurrenteService.ts` (CRUD + `generarPendientes`), `dashboardService.ts` (bloque de gastos) | `requireAdmin()` en cada uno; mapeo de `hint` a campos |
| UI | `app/(protected)/gastos/` (`page.tsx`, `gastos-screen.tsx`, `actions.ts`, `loading.tsx`, `error.tsx`), `app/(protected)/gastos/empleados/[id]/` (`page.tsx`, `empleado-ficha.tsx`, `actions.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`); organisms de "Pantallas"; `AppShell.tsx` (`NAV_ITEMS`); `(dashboard)/dashboard-secciones.tsx` | Ver "Pantallas" |

## Fuera de alcance (MVP)

- Contabilidad formal: plan de cuentas, asientos de partida doble, mayor, balance general, estado de resultados contable, cierres de período (`/SPEC.md` §9).
- Comprobantes adjuntos (fotos o PDF de facturas de gastos) y bucket de storage.
- Historial completo de cambios de un gasto (solo `updated_by`/`updated_at` y anulación con motivo).
- Conceptos y deducciones de nómina (bonos, horas extra, IVSS, FAOV, INCES, ISLR, prestaciones, vacaciones, anticipos), recibos de pago y nómina masiva en un solo registro.
- Historial de salarios del empleado.
- Gastos a crédito / cuentas por pagar de gastos (un gasto se considera pagado al registrarlo) y resultado cambiario de gastos.
- Presupuestos, metas o comparación contra período anterior.
- Prorrateo de gastos a productos, lotes o costo de venta (los gastos no entran en el margen bruto ni en el costo de lotes).
- Frecuencia semanal u otras (P6) y generación por cron (P4).
- Proveedor de gastos como entidad (el beneficiario es texto libre; `03-proveedores` es de producto).
- Exportar a CSV/PDF.
- Acceso del operador (ni lectura ni registro).

## Variables de entorno nuevas

Ninguna.
