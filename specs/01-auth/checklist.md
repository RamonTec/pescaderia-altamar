# Checklist — 01-auth

## Fase 1 — Login básico + sesión
- [ ] Login con email/password funciona contra Supabase real.
- [ ] Error de credenciales inválidas se muestra legible, no un stack trace.
- [ ] Sesión persiste al recargar la página (cookie server-side, no localStorage).
- [ ] Logout limpia la sesión y redirige a `/login`.
- [ ] Acceder a cualquier ruta protegida sin sesión redirige a `/login`.
- [ ] Acceder a `/login` con sesión activa redirige a `/`.

## Fase 2 — Roles + RLS real
- [ ] Tabla `perfiles` existe y todo usuario de `auth.users` tiene una fila correspondiente.
- [ ] Un usuario nuevo recibe rol `operador` por defecto; solo un `admin` puede cambiar roles.
- [ ] Con sesión `operador`, una query directa a Supabase (no solo la UI) no puede leer `costo_usd_kg` de `compra_items`/`factura_items` ni la tabla `movimientos` con el detalle de costo.
- [ ] Con sesión `admin`, todo lo anterior es visible.
- [ ] UI oculta paneles/columnas de costo y margen para `operador` (capa adicional, no la única protección).

## Fase 3 — Protección de rutas + perfil
- [ ] `middleware.ts` bloquea todas las rutas de la app excepto `/login` sin sesión válida.
- [ ] Refresh de sesión funciona sin forzar re-login en cada request (cookies renovadas por el middleware).
- [ ] `/perfil` permite cambiar contraseña y refleja el cambio en el próximo login.
- [ ] Al menos una Server Action sensible (ej. crear factura) verifica sesión explícitamente, no solo depende del middleware.

## Fase 4 — Alta de usuarios + recuperación
- [ ] `/usuarios` solo accesible por `admin` (verificado server-side, no solo oculto en el menú).
- [ ] Un `admin` puede invitar/crear un operador nuevo y asignarle rol desde la UI.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` nunca se referencia desde un componente cliente (`grep` en `src/` no debe encontrarla fuera de archivos server-only).
- [ ] Flujo de "olvidé mi contraseña" envía el correo y permite establecer una nueva contraseña.

## Pendientes / deuda técnica (completar si aplica)
- [ ] _(anotar aquí cualquier ítem diferido con motivo y fecha)_
