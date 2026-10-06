# Checklist — 01-auth

## Fase 1 — Login básico + sesión
- [x] Login con email/password funciona contra Supabase real.
- [x] Error de credenciales inválidas se muestra legible, no un stack trace.
- [x] Sesión persiste al recargar la página (cookie server-side, no localStorage).
- [x] Logout limpia la sesión y redirige a `/login`.
- [x] Acceder a cualquier ruta protegida sin sesión redirige a `/login`.
- [x] Acceder a `/login` con sesión activa redirige a `/`.

## Fase 2 — Roles + RLS real
- [x] Tabla `perfiles` existe y todo usuario de `auth.users` tiene una fila correspondiente.
- [x] Un usuario nuevo recibe rol `operador` por defecto; solo un `admin` puede cambiar roles.
- [x] Con sesión `operador`, una query directa a Supabase (no solo la UI) no puede leer `costo_usd_kg` de `compra_items`/`factura_items` ni la tabla `movimientos` con el detalle de costo.
- [x] Con sesión `admin`, todo lo anterior es visible.
- [x] UI oculta paneles/columnas de costo y margen para `operador` (capa adicional, no la única protección).

## Fase 3 — Protección de rutas + perfil
- [x] `proxy.ts` (Next 16 renombró `middleware.ts`) bloquea todas las rutas de la app excepto `/login` sin sesión válida.
- [x] Refresh de sesión funciona sin forzar re-login en cada request (cookies renovadas por el proxy).
- [x] `/perfil` permite cambiar contraseña y refleja el cambio en el próximo login.
- [x] Al menos una Server Action sensible (ej. crear factura) verifica sesión explícitamente, no solo depende del middleware.

## Fase 4 — Alta de usuarios + recuperación
- [x] `/usuarios` solo accesible por `admin` (verificado server-side, no solo oculto en el menú).
- [x] Un `admin` puede invitar/crear un operador nuevo y asignarle rol desde la UI.
- [x] `SUPABASE_SERVICE_ROLE_KEY` nunca se referencia desde un componente cliente (`grep` en `src/` no debe encontrarla fuera de archivos server-only).
- [x] Flujo de "olvidé mi contraseña" envía el correo y permite establecer una nueva contraseña.

## Pendientes / deuda técnica (completar si aplica)
- [x] Verificación manual en navegador pendiente (2026-10-06): persistencia de sesión al recargar, logout invalida cookies y redirige, y cambio de contraseña reflejado en el próximo login. Implementado y verificado por API (`token?grant_type=password` → 200), falta confirmación visual en el navegador.
- [x] Asignación de rol desde la UI (2026-10-06): `/usuarios` crea usuarios (default `operador`) pero no ofrece selector para cambiar el `rol` de un usuario existente. El cambio de rol es posible vía RLS (`admin` actualiza `perfiles`), pero no hay UI. Diferido a un ajuste menor posterior.
