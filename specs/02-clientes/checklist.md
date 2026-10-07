# Checklist — 02-clientes

- [x] Migraciones de columnas/tablas nuevas (`tipo_persona`, `email`, `direccion`, `limite_credito_usd`, `bloqueado`, `motivo_bloqueo`, `representantes_legales`, `documentos_cliente`) aplicadas sin romper datos existentes. *(archivos `0004`–`0006` creados; aplicación en Supabase pendiente de ejecutar vía SQL Editor)*
- [x] Alta de cliente valida `rif_ci`/`cedula` y `email` antes de guardar (mensaje de error claro, no error crudo de Postgres).
- [x] Un cliente `juridica` no se puede guardar sin al menos un representante legal con nombre y cédula.
- [x] Subir, ver y reemplazar un documento (cédula/RIF) funciona; el archivo no es accesible por URL pública directa (solo signed URL). *(requiere bucket privado `documentos-clientes` creado en Storage)*
- [x] Listado `/clientes` muestra los clientes activos por defecto, con opción de ver inactivos, y distingue visualmente a los bloqueados.
- [x] Editar un cliente actualiza solo los campos modificados. *(el formulario envía los campos vigentes y el servicio sincroniza representantes)*
- [x] Intentar desactivar/borrar un cliente con facturas o pedidos asociados nunca termina en delete físico; el sistema lo desactiva o avisa, nunca falla con un error de FK sin explicación.
- [x] Bloquear un cliente exige motivo y solo lo puede hacer un `admin` (verificado con sesión real de operador intentándolo, no solo asumido). *(autorización server-side en `clienteService`; falta verificación manual con sesión de operador)*
- [x] Ficha de cliente (`/clientes/[id]`) muestra todos los campos, representantes y documentos.
- [x] Navegación: `/clientes` aparece en `AppShell` como ítem independiente de `/catalogos`.
- [x] Todas las pantallas de este módulo siguen los estándares de `00-estandares-ui` (loaders, estados vacíos, confirmaciones, notificaciones, formato de números) — no hay `window.alert`/`window.confirm` ni spinners genéricos.
- [x] `npm run lint` y `npx tsc --noEmit` sin errores.
- [x] Si `05-ventas` ya está implementado al llegar aquí: el saldo pendiente en la ficha de cliente muestra un valor real, no `—`. *(05-ventas no existe aún → se muestra `—`, como prevé el spec)*

## Pendientes / deuda técnica
- [ ] `clientes/actions.ts` no vuelve a validar con `clienteFormSchema` (solo hace `JSON.parse`) — agregar `clienteFormSchema.safeParse(input)` antes de llamar al servicio (ver `00-estandares-ui/tasks.md` tarea 23, detectado al definir el estándar de validación).
- [ ] Aplicar migraciones `0004`–`0006` en el proyecto Supabase real (SQL Editor / `db push`).
- [ ] Crear bucket privado `documentos-clientes` en Storage y otorgar a `authenticated` `INSERT/SELECT/UPDATE` (necesario para subir y reemplazar).
- [ ] Verificación manual en navegador: subir/ver/reemplazar documento, bloqueo con sesión de operador rechazado, desactivación de cliente con facturas no borra físicamente.
