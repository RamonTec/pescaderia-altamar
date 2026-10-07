# Checklist — 03-proveedores

- [ ] Migraciones de columnas/tabla nuevas (`tipo_persona`, `email`, `direccion`, `contacto_*`, `banco`, `numero_cuenta`, `titular_cuenta`, `bloqueado`, `motivo_bloqueo`, `documentos_proveedor`) aplicadas sin romper datos existentes.
- [ ] Alta de proveedor valida `rif_ci` y `email` antes de guardar (mensaje de error claro, no error crudo de Postgres).
- [ ] Subir, ver y reemplazar el documento de RIF funciona; el archivo no es accesible por URL pública directa (solo signed URL).
- [ ] Listado `/proveedores` muestra los proveedores activos por defecto, con opción de ver inactivos, y distingue visualmente a los bloqueados.
- [ ] Editar un proveedor actualiza solo los campos modificados.
- [ ] Intentar desactivar/borrar un proveedor con compras asociadas nunca termina en delete físico; el sistema lo desactiva o avisa, nunca falla con un error de FK sin explicación.
- [ ] Bloquear un proveedor exige motivo y solo lo puede hacer un `admin` (verificado con sesión real de operador intentándolo, no solo asumido).
- [ ] Ficha de proveedor (`/proveedores/[id]`) muestra todos los campos y el documento adjunto.
- [ ] Navegación: `/proveedores` aparece en `AppShell` como ítem independiente de `/catalogos`.
- [ ] Todas las pantallas de este módulo siguen los estándares de `00-estandares-ui` (loaders, estados vacíos, confirmaciones, notificaciones, formato de números) — no hay `window.alert`/`window.confirm` ni spinners genéricos.
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] Si `04-inventario` ya está implementado al llegar aquí: el saldo pendiente en la ficha de proveedor muestra un valor real, no `—`.

## Pendientes / deuda técnica
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha)_
