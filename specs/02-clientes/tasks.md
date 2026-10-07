# Tareas — 02-clientes

Depende de: `00-estandares-ui` (NumberField, ConfirmDialog, NotificationProvider, react-hook-form+zod ya instalados) y `01-auth` Fase 2 (roles) completa, por las políticas RLS de columnas sensibles (`limite_credito_usd`, `bloqueado`) y porque bloquear/desbloquear es acción de `admin`.

## Esquema

1. **Migración `0004_clientes_captacion.sql`**: `alter table public.clientes add column tipo_persona text not null default 'natural' check (tipo_persona in ('natural','juridica')), add column email text, add column direccion text, add column limite_credito_usd numeric(14,6) check (limite_credito_usd is null or limite_credito_usd >= 0), add column bloqueado boolean not null default false, add column motivo_bloqueo text;`
   - Hecho cuando: migración corre sin error sobre datos existentes (los 2 clientes semilla quedan `tipo_persona = 'natural'`, resto en `null`/`false`).
2. **Migración `0005_representantes_legales.sql`**: tabla `public.representantes_legales` según el spec (`cliente_id`, `nombre`, `cedula`, `cargo`, `telefono`). RLS: mismo criterio que `clientes` (acceso por `authenticated`, refinar por rol si se decide).
3. **Migración `0006_documentos_cliente.sql`**: tabla `public.documentos_cliente` (`cliente_id`, `tipo`, `url_storage`). Bucket de Storage `documentos-clientes` (privado) — crear vía dashboard o script de setup, documentar el nombre exacto aquí si cambia.
   - *Nota de numeración*: si al llegar a este módulo `04-inventario` ya usó `0004`/`0005` para sus propias migraciones, renumerar estas tres al siguiente número libre — el orden entre módulos no está fijado de antemano, solo el orden relativo dentro de cada módulo.
4. **Actualizar `src/types/domain.ts`**: extender `Cliente` con `tipo_persona: 'natural' | 'juridica'`, `email: string | null`, `direccion: string | null`, `limite_credito_usd: number | null`, `bloqueado: boolean`, `motivo_bloqueo: string | null`; agregar `RepresentanteLegal` y `DocumentoCliente`.

## Repositorios y servicios

5. **`src/lib/repositories/clienteRepository.ts`** (implementación Supabase de `IClienteRepository`, separada de `catalogRepositories.ts`): `list`, `getById`, `create`, `update`, y `delete` que primero verifica (`select count(*) from facturas/pedidos where cliente_id = ...`) antes de intentar borrar; si hay registros asociados, lanzar error de dominio (`ClienteConFacturasError`) en vez de dejar que falle por FK sin contexto.
6. **`src/lib/repositories/representanteLegalRepository.ts`** (+ `IRepresentanteLegalRepository`): `listByCliente`, `create`, `update`, `delete`.
7. **`src/lib/repositories/documentoClienteRepository.ts`** (+ `IDocumentoClienteRepository`): `listByCliente`, `create` (recibe el archivo, sube a Storage, guarda la fila), `getUrlDescarga(id)` (signed URL al vuelo, mismo patrón que `06-contratos`), `delete`.
8. **`src/lib/services/clienteService.ts`**: validaciones de negocio (formato `rif_ci`/`cedula`, `email`), `desactivar(id)` como alternativa a `delete`, `validarRepresentantes(clienteId)` (si `tipo_persona === 'juridica'`, exige al menos un representante antes de permitir guardar), `bloquear(id, motivo)` / `desbloquear(id)` (solo invocable si el rol es `admin` — verificar `authService.getRol()` dentro del servicio, no solo ocultar el botón).

## UI

9. **Componentes Atomic Design**:
   - `components/atoms/RifCiField.tsx` (input con máscara/validación V-/E-/J-, reusa `NumberField`/convenciones de `00-estandares-ui` donde aplique).
   - `components/molecules/ClienteFormFields.tsx` (campos base + toggle `tipo_persona`).
   - `components/molecules/RepresentantesLegalesFieldArray.tsx` (lista editable de representantes, solo visible si `tipo_persona === 'juridica'`, usa `react-hook-form` `useFieldArray`).
   - `components/molecules/DocumentoUpload.tsx` (subir/ver/reemplazar cédula o RIF).
   - `components/organisms/ClienteForm.tsx` (formulario completo, alta/edición, con `react-hook-form` + `zod`, usa `ConfirmDialog` de `00-estandares-ui` antes de desactivar o bloquear).
   - `components/organisms/ClientesTable.tsx` (DataGrid con acciones editar/desactivar/bloquear, badge de `bloqueado`, usa `EmptyState`/`PageLoader` de `00-estandares-ui`).
10. **`src/app/clientes/page.tsx`**: `PageHeader` + lista + botón "nuevo cliente".
11. **`src/app/clientes/[id]/page.tsx`**: ficha — datos + representantes + documentos + placeholder de "saldo pendiente" (valor `—` si `05-ventas` aún no expone el servicio de balance) + historial de facturas/pedidos si ya existen esos datos.
12. **`src/app/clientes/loading.tsx`** y **`error.tsx`**: usando `PageLoader`/`ErrorState` de `00-estandares-ui`.
13. **Actualizar `AppShell.tsx`**: agregar ítem de navegación `/clientes` (ícono `PeopleIcon`), separado de `/catalogos`.
14. **Quitar gestión de clientes de `/catalogos`** si ya estaba contemplada ahí, dejando esa pantalla solo para productos/proveedores/config (ver spec de `/catalogos` dentro de `04-inventario`).

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "05-ventas necesita `clientes.limite_credito_usd` y `clientes.bloqueado` para validar antes de vender a crédito — agregado el <fecha>")_
- **03-proveedores (2026-10-06)**: `DocumentoUpload`, `RepresentantesLegalesFieldArray` y el manejo de errores de `clientes/actions.ts` se generalizan (`DocumentoStore`, tipado genérico, `lib/actionState.ts`). Clientes debe seguir funcionando igual; se verifica en la tarea 31 de `03-proveedores`.
- **03-proveedores (2026-10-06), recomendado**: (a) trigger `clientes_guard_bloqueo` igual a `proveedores_guard_bloqueo` (hoy un operador puede cambiar `bloqueado` saltándose el servicio, porque la RLS es `using (true)`); (b) crear el bucket `documentos-clientes` y sus políticas por migración (como `0010_documentos_proveedor.sql`) en vez del paso manual pendiente.
