# Tareas — 02-clientes

Depende de: `01-auth` Fase 2 (roles) completa, por las políticas RLS de columnas sensibles si se decide que `limite_credito_usd` es visible solo para `admin` (a confirmar en Fase 2 de este módulo).

1. **Migración `0004_clientes_captacion.sql`**: `alter table public.clientes add column email text, add column direccion text, add column limite_credito_usd numeric(14,6);`. Agregar check opcional `limite_credito_usd is null or limite_credito_usd >= 0`.
   - Hecho cuando: migración corre sin error sobre datos existentes (los 2 clientes semilla quedan con las columnas nuevas en `null`).
2. **Actualizar `src/types/domain.ts`**: extender `Cliente` con `email: string | null`, `direccion: string | null`, `limite_credito_usd: number | null`.
3. **`src/lib/repositories/clienteRepository.ts`** (implementación Supabase de `IClienteRepository`, separada de `catalogRepositories.ts` para que este módulo tenga su propio archivo): `list`, `getById`, `create`, `update`, y `delete` que primero verifica (`select count(*) from facturas/pedidos where cliente_id = ...`) antes de intentar borrar; si hay registros asociados, lanzar error de dominio (`ClienteConFacturasError` o similar) en vez de dejar que falle por FK sin contexto.
4. **`src/lib/services/clienteService.ts`**: validaciones de negocio (formato `rif_ci`, `email`), y `desactivar(id)` como alternativa a `delete` cuando hay historial.
5. **Componentes Atomic Design**:
   - `components/atoms/RifCiField.tsx` (input con máscara/validación V-/E-/J-).
   - `components/molecules/ClienteFormFields.tsx` (agrupa los campos del formulario).
   - `components/organisms/ClienteForm.tsx` (formulario completo, alta/edición).
   - `components/organisms/ClientesTable.tsx` (DataGrid con acciones editar/desactivar).
6. **`src/app/clientes/page.tsx`**: lista + botón "nuevo cliente" (abre `ClienteForm` en modal o navega a `/clientes/nuevo`).
7. **`src/app/clientes/[id]/page.tsx`**: ficha de cliente — datos + placeholder de "saldo pendiente" (campo listo, valor `—` si `04-ventas` aún no expone el servicio de balance) + historial de facturas/pedidos si ya existen esos datos.
8. **Actualizar `AppShell.tsx`**: agregar ítem de navegación `/clientes` (ícono `PeopleIcon` o similar), separado de `/catalogos`.
9. **Quitar gestión de clientes de `/catalogos`** si ya estaba contemplada ahí, dejando esa pantalla solo para productos/proveedores/config (ver spec de `/catalogos` dentro de `03-inventario`).

## Tarea agregada por otro módulo (anotar aquí cuando ocurra)
- _(ej.: "04-ventas necesita `clientes.limite_credito_usd` para bloquear pedidos — agregado el <fecha>")_
