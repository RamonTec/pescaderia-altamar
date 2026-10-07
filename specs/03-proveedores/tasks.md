# Tareas — 03-proveedores

Depende de: `00-estandares-ui` (componentes base, `NotificationProvider`, `ConfirmProvider`, react-hook-form + zod) y `01-auth` Fase 2 (`es_admin()`, `getRol()`). No depende de `02-clientes` para funcionar, pero **reutiliza y generaliza** componentes que ese módulo creó (ver Fase B). Al tocarlos, `02-clientes` debe seguir funcionando igual.

Regla de avance: después de cada tarea deben pasar `npm run lint` y `npx tsc --noEmit`.

## Fase A — Esquema

1. **`supabase/migrations/0007_proveedores_control.sql`**
   - `alter table proveedores add column tipo_persona text not null default 'juridica' check (...), email, direccion, contacto_nombre, contacto_telefono, bloqueado boolean not null default false, motivo_bloqueo text`, más `check (not bloqueado or length(trim(coalesce(motivo_bloqueo,''))) > 0)`.
   - `create unique index proveedores_rif_ci_unique on proveedores (upper(rif_ci)) where rif_ci is not null;`
   - Función + trigger `proveedores_guard_bloqueo` (`before insert or update`): si cambia `bloqueado`/`motivo_bloqueo` (o se inserta con `bloqueado = true`) y `not public.es_admin()` → `raise exception ... using errcode = '42501'`.
   - Hecho cuando: corre sobre los 2 proveedores semilla (quedan `juridica`, sin bloqueo) y un `update ... set bloqueado = true` con un usuario operador falla.
2. **`0008_representantes_proveedor.sql`**: tabla e índice según el spec; RLS igual que `representantes_legales` (0005).
3. **`0009_metodos_pago_proveedor.sql`**: tabla con `check` por tipo, índice `(proveedor_id)` e índice único parcial `(proveedor_id) where preferido`; RLS para `authenticated`.
4. **`0010_documentos_proveedor.sql`**: tabla (con `representante_id`, `nombre_original`, `mime_type`, `tamano_bytes`) + `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('documentos-proveedores', 'documentos-proveedores', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']) on conflict (id) do nothing;` + políticas `select/insert/update/delete` en `storage.objects` con `bucket_id = 'documentos-proveedores'` para `authenticated`.
5. **`src/types/domain.ts`**: extender `Proveedor`; agregar `TipoMetodoPago`, `MetodoPagoProveedor`, `RepresentanteProveedor`, `TipoDocumentoProveedor`, `DocumentoProveedor`, `EstadoDocumental { completa: boolean; faltantes: string[] }`.

## Fase B — Base compartida (generalizar antes de construir)

6. **`src/lib/validationMessages.ts`**: extraer los mensajes repetidos (RIF, cédula, email, teléfono, nombre requerido) y actualizar `clienteValidation.ts` para que los use. Agregar `TELEFONO_VE_REGEX` a `clienteValidation.ts`. *(Cierra la tarea 22 de `00-estandares-ui`.)*
7. **`src/lib/actionState.ts`**: `ActionState` (`error`, `success`, `fieldErrors?`) + `toActionError(e, mapaCampos?)`, que traduce `23505` → error en el campo `rif_ci`, `23514` → "Datos de pago incompletos", `42501` → "Solo un administrador…", y registra en consola el resto. Migrar `clientes/actions.ts` a este helper (sin cambiar su comportamiento).
8. **`src/lib/bancosVe.ts`**: `BANCOS_VE` (código → nombre), `bancoDesdeCuenta(cuenta)`, `enmascararCuenta(cuenta)`, `esCuentaValida(cuenta)` (20 dígitos + prefijo conocido). Verificar el catálogo contra la lista vigente de SUDEBAN al implementar.
9. **Generalizar `DocumentoUpload`**:
   - Nueva interfaz `DocumentoStore<TTipo>` (`list`, `upload(file, meta)`, `getUrl`, `remove`). `documentoClienteRepository` se adapta con `makeClienteDocumentoStore(clienteId)`; `ClienteForm` y `cliente-ficha` pasan el adaptador.
   - Mejoras: zona para arrastrar y soltar, `accept` + validación de tipo/tamaño (máx. 5 MB) con mensaje claro **antes** de subir, compresión de imágenes en el cliente (canvas, lado mayor 1600 px, JPEG 0.8), `capture="environment"`, miniatura de la imagen / ícono de PDF, `Skeleton` mientras carga, `Fade` al mostrar, `LinearProgress` indeterminado durante la subida, y **reemplazo** = subir el nuevo y luego borrar el anterior.
   - Hecho cuando: en `/clientes` se sube, reemplaza y elimina una cédula igual que antes, y un `.docx` o un archivo de 8 MB se rechazan con un mensaje.
10. **Generalizar `RepresentantesLegalesFieldArray`**: tipar contra `{ representantes: RepresentanteFormValues[] }` y envolver cada fila en `Collapse` (cierra la tarea 26 de `00-estandares-ui`).
11. **`molecules/CopyableText.tsx`** y **`molecules/StatusChips.tsx`** (props: `bloqueado`, `motivoBloqueo`, `activo`, `documentacion?: EstadoDocumental`).
12. **Actualizar la tabla de "Componentes compartidos"** en `00-estandares-ui/spec.md` y anotar la fecha en `00-estandares-ui/tasks.md` → "Componentes agregados después de la primera pasada".

## Fase C — Validación, repositorios y servicios

13. **`src/lib/proveedorValidation.ts`**: `metodoPagoSchema` (discriminated union), `proveedorFormSchema` (con `.superRefine`: representantes en jurídica, un solo preferido, sin métodos duplicados), `bloqueoSchema`, y los tipos inferidos. Exportar también `CAMPOS_POR_PASO` (los campos que valida cada paso del Stepper).
14. **`interfaces.ts`**: actualizar `IProveedorRepository` (`list({ incluirInactivos })`, `listConResumen()`, `countCompras(id)`); agregar `IRepresentanteProveedorRepository`, `IMetodoPagoProveedorRepository`, `IDocumentoProveedorRepository`.
15. **`repositories/proveedorRepository.ts`** (sale de `catalogRepositories.ts`, que solo re-exporta para no romper imports). `listConResumen` usa embedding de PostgREST: `select('*, representantes_proveedor(id), documentos_proveedor(tipo, representante_id), metodos_pago_proveedor(tipo, banco_codigo, numero_cuenta, telefono, email, preferido)')`. `delete` cuenta las compras y lanza `ProveedorConComprasError` si hay.
16. **`representanteProveedorRepository.ts`**, **`metodoPagoProveedorRepository.ts`** (CRUD por proveedor) y **`documentoProveedorRepository.ts`** (mismo patrón que el de clientes + metadatos del archivo + `makeProveedorDocumentoStore(proveedorId, representanteId?)`).
17. **`services/proveedorService.ts`**:
    - `crearProveedor` / `actualizarProveedor`: normalizan (trim, mayúsculas en RIF, `''` → `null`) y sincronizan representantes y métodos de pago (mismo patrón de diff que `sincronizarRepresentantes` de clientes; extraer un helper genérico `sincronizarHijos` si queda idéntico).
    - `desactivar`, `activar`, `bloquear(id, motivo)`, `desbloquear(id)`: verifican `getRol() === 'admin'` (el trigger de la tarea 1 es la segunda línea de defensa).
    - `evaluarDocumentacion(...)`: función **pura**, sin I/O.
    - `getSaldoPendiente(id)` → `null` por ahora.
18. **`app/(protected)/proveedores/actions.ts`**: `upsertProveedorAction`, `desactivar/activar`, `bloquear/desbloquear`. **Cada una corre `safeParse` antes del servicio** (`proveedorFormSchema`, `bloqueoSchema`, `z.string().uuid()` para los ids) y devuelve `ActionState` con `fieldErrors`. `upsert` devuelve además el `id` creado (el Stepper lo necesita para pasar al paso 3).

## Fase D — UI

19. **`molecules/ProveedorIdentificacionFields.tsx`**: paso 1 (toggle de tipo de persona, etiqueta dinámica de `RifCiField`, contacto). Labels obligatorios con `*`. Grid de 1 columna en `xs` y 2 en `sm+`.
20. **`molecules/MetodoPagoCard.tsx`** + **`molecules/MetodosPagoFieldArray.tsx`**: tarjeta por tipo con sus campos; banco detectado como chip al completar los 20 dígitos (`Fade`); `Autocomplete` de bancos para Pago Móvil; radio "Preferido"; quitar una tarjeta con datos → `ConfirmDialog`; tarjetas con `Collapse`. Botón "Agregar método" con `Menu` de 3 opciones.
21. **`molecules/DocumentosRequeridos.tsx`**: checklist según `tipo_persona` (natural: cédula, RIF; jurídica: RIF, acta constitutiva, cédula de cada representante guardado), cada ítem con ícono ✓/⚠ y su `DocumentoUpload`; más "Otros documentos".
22. **`organisms/ProveedorForm.tsx`**: `Dialog` (`fullScreen` en `xs` con `useMediaQuery`) + `Stepper` (en `xs`, etiquetas cortas o solo los números) + `FormProvider`. Navegación con `trigger(CAMPOS_POR_PASO[n])`; en alta, "Guardar y continuar" en el paso 2; en edición, `StepButton` libre y `StepLabel error` si el paso tiene errores. `fieldErrors` del servidor → `setError` + salto al primer paso con error. Cerrar con `isDirty` → `ConfirmDialog`. Prop `pasoInicial` (la usa "Completar documentos"). Contenido de cada paso con `Fade`.
23. **`organisms/BloqueoDialog.tsx`**: motivo con `bloqueoSchema`, botón `error` con loader interno. Genérico (recibe `onConfirm(motivo)`) para que clientes lo pueda adoptar.
24. **`organisms/ProveedoresTable.tsx`**: DataGrid con columnas esenciales/secundarias (`columnVisibilityModel` según breakpoint), `StatusChips`, quick filter, switch de inactivos, menú `⋮` por fila (acciones de admin solo si `rol === 'admin'`), clic en la fila → `router.push`, hover con `theme.transitions.create('background-color')`, prop `loading` nativo y `slots.noRowsOverlay` / `noResultsOverlay` con `EmptyState`.
25. **`app/(protected)/proveedores/page.tsx`** (server: carga `listConResumen` + rol) + `proveedores-screen.tsx` (client: `PageHeader`, tabla, diálogo) + `loading.tsx` (skeleton de **tabla**) + `error.tsx` (`ErrorState`).
26. **`app/(protected)/proveedores/[id]/page.tsx`** + `proveedor-ficha.tsx` + `loading.tsx` (skeleton de **ficha**: encabezado + 4 tarjetas) + `not-found.tsx`. Contenido según el spec (alerts de bloqueo / documentación, tarjetas, `CopyableText` en métodos de pago, miniaturas, historial de compras con `EmptyState`). Transición skeleton → contenido con `Fade`.
27. **`AppShell.tsx`**: ítem `/proveedores` (`LocalShippingIcon`) después de `/clientes`.
28. **`/catalogos`**: actualizar la descripción del placeholder (los proveedores se gestionan en `/proveedores`) y confirmar que no queda ningún CRUD de proveedores ahí.

## Fase E — Verificación

29. `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores.
30. Aplicar `0007`–`0010` en Supabase y comprobar que el bucket quedó creado con su límite y tipos permitidos.
31. Recorrido manual (navegador, claro **y** oscuro, desktop **y** 375 px):
    - Alta natural y jurídica completas, de punta a punta en el Stepper, incluida la subida de documentos en el paso 3.
    - RIF duplicado → error en el campo; cuenta con prefijo desconocido → error; Zelle sin email ni teléfono → error.
    - Reemplazar un documento deja uno solo; foto grande de teléfono se comprime (< 1 MB).
    - Sesión de operador: no ve bloquear, y `bloquearProveedorAction` llamada a mano también falla.
    - Copiar el número de cuenta desde la ficha.
    - `/clientes` sigue funcionando (documentos y representantes) después de la Fase B.
32. Recorrer `checklist.md` y marcarlo.

## Tareas agregadas a otros módulos por este módulo (2026-10-06)

- **02-clientes**: (a) adoptar `ActionState`/`toActionError` (tarea 7); (b) se recomienda un trigger equivalente a `proveedores_guard_bloqueo` sobre `clientes` y crear el bucket `documentos-clientes` por migración, igual que en la tarea 4. Anotado en `02-clientes/tasks.md`.
- **04-inventario**: al crear una compra a crédito, rechazar si `proveedores.bloqueado` (en el servicio, no solo en la UI); en el selector de proveedor, mostrar `StatusChips`; implementar `proveedorBalanceService` y conectarlo a `getSaldoPendiente`.
- **00-estandares-ui**: cierra las tareas 22 y 26 y agrega componentes compartidos (tarea 12).

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "04-inventario necesita … — agregado el <fecha>")_
