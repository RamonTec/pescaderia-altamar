# Checklist — 02-clientes

- [ ] Migración de columnas nuevas (`email`, `direccion`, `limite_credito_usd`) aplicada sin romper datos existentes.
- [ ] Alta de cliente valida `rif_ci` y `email` antes de guardar (mensaje de error claro, no error crudo de Postgres).
- [ ] Listado `/clientes` muestra los clientes activos por defecto, con opción de ver inactivos.
- [ ] Editar un cliente actualiza solo los campos modificados.
- [ ] Intentar desactivar/borrar un cliente con facturas o pedidos asociados nunca termina en delete físico; el sistema lo desactiva o avisa, nunca falla con un error de FK sin explicación.
- [ ] Ficha de cliente (`/clientes/[id]`) muestra todos los campos, incluyendo los nuevos.
- [ ] Navegación: `/clientes` aparece en `AppShell` como ítem independiente de `/catalogos`.
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] Si `04-ventas` ya está implementado al llegar aquí: el saldo pendiente en la ficha de cliente muestra un valor real, no `—`.

## Pendientes / deuda técnica
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha)_
