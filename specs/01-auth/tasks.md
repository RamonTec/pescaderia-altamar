# Tareas — 01-auth

Ejecutar en orden. Cada tarea indica archivos y criterio de "hecho".

## Fase 1 — Login básico + sesión

1. **Supabase: confirmar provider email/password habilitado** en el proyecto (dashboard, no código). Hecho cuando: se puede crear un usuario de prueba desde el dashboard y hacer login manualmente vía API.
2. **`src/lib/services/authService.ts`**: `signIn(email, password)`, `signOut()`, `getSession()`, usando `createClient` de `lib/supabase/server.ts` (Server Actions) y `lib/supabase/client.ts` (cliente, solo lectura de sesión).
   - Hecho cuando: funciones tipadas, sin `any`, con manejo de error (`{ error }` o throw controlado).
3. **`src/components/organisms/LoginForm.tsx`**: formulario MUI (email, password, botón submit, estado de error/loading). Usa un Server Action `loginAction` que llama a `authService.signIn`.
   - Hecho cuando: valida campos vacíos, muestra error de Supabase legible ("Credenciales inválidas").
4. **`src/app/login/page.tsx`**: página pública que renderiza `LoginForm` dentro de un layout simple (sin `AppShell`, sin sidebar).
   - Hecho cuando: accesible sin sesión, redirige a `/` si ya hay sesión activa.
5. **Logout en `AppShell.tsx`**: botón/ítem que llama `signOut` y redirige a `/login`.
   - Hecho cuando: tras logout, cookies de sesión se invalidan (verificar que recargar `/` sin sesión redirige a login una vez hecha la tarea 6).
6. **Guard mínimo en layout raíz** (`src/app/layout.tsx` o un wrapper): si no hay sesión y la ruta no es `/login`, redirigir server-side.
   - Hecho cuando: navegar a `/inventario` sin sesión redirige a `/login`. (El middleware definitivo es Fase 3; esto es un guard temprano para no bloquear el resto del desarrollo.)

## Fase 2 — Roles + RLS real

7. **Migración `0002_roles_y_perfiles.sql`**: tabla `public.perfiles (id uuid references auth.users primary key, nombre text, rol text check (rol in ('admin','operador')) not null default 'operador', created_at timestamptz default now())`. Trigger o función para crear perfil automáticamente al crear usuario (si se puede en el plan de Supabase usado; si no, documentar que el alta manual de perfil es parte de la Fase 4).
   - Hecho cuando: insertar un usuario en `auth.users` resulta en una fila en `perfiles` con rol `operador` por defecto.
8. **`authService.getRol(): Promise<'admin'|'operador'|null>`**: lee `perfiles` por `auth.uid()`.
9. **Migración `0003_rls_por_rol.sql`**: reemplazar políticas de `compra_items`, `factura_items`, `movimientos` para que `select` filtre columnas de costo cuando el rol es `operador`. Documentar en comentarios SQL la decisión tomada (vista vs. columna-level RLS).
   - Hecho cuando: con un usuario `operador`, un `select costo_usd_kg from factura_items` no referencia, o la vista pública para operador no incluye esa columna.
10. **Ocultar en UI** (Inventario, Dashboard, reportes) las columnas/paneles de costo y margen si `getRol() === 'operador'`.
    - Hecho cuando: un usuario operador no ve botones/columnas de costo, aunque esto es solo UX — la protección real es la tarea 9.

## Fase 3 — Protección de rutas + perfil

11. **`middleware.ts`** en raíz del proyecto usando `@supabase/ssr` para refrescar sesión y redirigir a `/login` en rutas protegidas (`matcher` excluyendo `/login`, `/_next`, assets).
    - Hecho cuando: request sin cookie de sesión a cualquier ruta protegida devuelve redirect 307 a `/login`.
12. **`src/app/perfil/page.tsx`**: ver nombre/email, formulario de cambio de contraseña (`supabase.auth.updateUser`).
13. **Guard en Server Actions sensibles** (las que ya existan de módulos anteriores): verificar sesión al inicio de cada action, no solo confiar en middleware.

## Fase 4 — Alta de usuarios + recuperación

14. **`SUPABASE_SERVICE_ROLE_KEY`** agregada a `.env.example` (comentada, con advertencia) y a `.env.local` real (no versionado).
15. **`src/app/usuarios/page.tsx`** (solo visible/accesible si `rol === 'admin'`, protegido también server-side): tabla de usuarios + formulario para invitar (Supabase Admin `inviteUserByEmail` o `createUser`), asigna `rol` en `perfiles`.
16. **Flujo "olvidé mi contraseña"**: enlace en `/login`, página `/recuperar` que llama `supabase.auth.resetPasswordForEmail`, y `/actualizar-password` que procesa el link de retorno.
