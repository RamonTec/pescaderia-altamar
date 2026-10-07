# Tareas — 03-proveedores

Depende de: `00-estandares-ui` (NumberField, ConfirmDialog, NotificationProvider, react-hook-form+zod ya instalados) y `01-auth` Fase 2 (roles) completa, por las políticas RLS de columnas sensibles y porque bloquear/desbloquear es acción de `admin`.

## Esquema

1. **Migración `0004_proveedores_control.sql`**: `alter table public.proveedores add column tipo_persona text not null default 'juridica' check (tipo_persona in ('natural','juridica')), add column email text, add column direccion text, add column contacto_nombre text, add column contacto_telefono text, add column banco text, add column numero_cuenta text, add column titular_cuenta text, add column bloqueado boolean not null default false, add column motivo_bloqueo text;`
   - Hecho cuando: migración corre sin error sobre los 2 proveedores semilla (quedan `tipo_persona = 'juridica'`, resto en `null`/`false`).
   - *Nota de numeración*: si `02-clientes` ya ocupó `0004` al momento de ejecutar, renumerar al siguiente número libre — el orden entre módulos no está fijado de antemano, solo el orden relativo dentro de cada módulo.
2. **Migración `0005_documentos_proveedor.sql`**: tabla `public.documentos_proveedor` según el spec. Bucket de Storage `documentos-proveedores` (privado) — crear vía dashboard o script de setup.
3. **Actualizar `src/types/domain.ts`**: extender `Proveedor` con `tipo_persona`, `email`, `direccion`, `contacto_nombre`, `contacto_telefono`, `banco`, `numero_cuenta`, `titular_cuenta`, `bloqueado`, `motivo_bloqueo` (todos `string | null` salvo `tipo_persona`/`bloqueado`); agregar `DocumentoProveedor`.

## Repositorios y servicios

4. **`src/lib/repositories/proveedorRepository.ts`** (implementación Supabase de `IProveedorRepository`, separada de `catalogRepositories.ts` para que este módulo tenga su propio archivo): `list`, `getById`, `create`, `update`, y `delete` que primero verifica (`select count(*) from compras where proveedor_id = ...`) antes de intentar borrar; si hay registros asociados, lanzar error de dominio (`ProveedorConComprasError`) en vez de dejar que falle por FK sin contexto.
5. **`src/lib/repositories/documentoProveedorRepository.ts`** (+ `IDocumentoProveedorRepository`): `listByProveedor`, `create` (recibe el archivo, sube a Storage, guarda la fila), `getUrlDescarga(id)` (signed URL al vuelo), `delete`.
6. **`src/lib/services/proveedorService.ts`**: validaciones de negocio (formato `rif_ci`, `email`), `desactivar(id)` como alternativa a `delete`, `bloquear(id, motivo)` / `desbloquear(id)` (solo invocable si el rol es `admin` — verificar `authService.getRol()` dentro del servicio, no solo ocultar el botón).

## UI

7. **Componentes Atomic Design**:
   - `components/molecules/ProveedorFormFields.tsx` (campos base, reusa `RifCiField` de `02-clientes` si ya existe — si no existe aún, crearlo aquí y que `02-clientes` lo reuse cuando le toque, documentando quién lo creó primero).
   - `components/molecules/DocumentoUpload.tsx` (si ya lo creó `02-clientes`, **reusar ese mismo componente** en vez de duplicarlo — es genérico, solo cambia a qué tabla/bucket apunta).
   - `components/organisms/ProveedorForm.tsx` (formulario completo, alta/edición, con `react-hook-form` + `zod`, usa `ConfirmDialog` de `00-estandares-ui` antes de desactivar o bloquear).
   - `components/organisms/ProveedoresTable.tsx` (DataGrid con acciones editar/desactivar/bloquear, badge de `bloqueado`, usa `EmptyState`/`PageLoader` de `00-estandares-ui`).
8. **`src/app/proveedores/page.tsx`**: `PageHeader` + lista + botón "nuevo proveedor".
9. **`src/app/proveedores/[id]/page.tsx`**: ficha — datos + documento adjunto + placeholder de "saldo pendiente" (valor `—` si `04-inventario` aún no expone `proveedorBalanceService`) + historial de compras si ya existen esos datos.
10. **`src/app/proveedores/loading.tsx`** y **`error.tsx`**: usando `PageLoader`/`ErrorState` de `00-estandares-ui`.
11. **Actualizar `AppShell.tsx`**: agregar ítem de navegación `/proveedores` (ícono `LocalShippingIcon` o similar), separado de `/catalogos`.
12. **Quitar gestión de proveedores de `/catalogos`** si ya estaba contemplada ahí (ver `04-inventario/tasks.md`, que ya refleja este cambio).

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "04-inventario necesita `proveedores.bloqueado` para validar antes de comprar a crédito — agregado el <fecha>")_
