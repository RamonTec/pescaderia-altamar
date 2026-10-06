# 01 — Auth (Login y control de acceso)

## Contexto

Hoy no existe ninguna pantalla de login ni integración real con Supabase Auth. Las políticas RLS de `supabase/migrations/0001_initial_schema.sql` ya asumen `to authenticated`, pero cualquiera con la anon key puede autenticarse (si existiera un signup abierto) y ver todo — no hay diferenciación `admin` vs `operador` descrita en `/SPEC.md` §5 ("RLS: operador ve todo excepto costos, balances y reportes de margen; admin ve todo").

Este módulo es la base de todos los demás: ningún módulo posterior debe asumir que "ya hay sesión", debe construirse asumiendo que `middleware.ts` ya protege las rutas y que `auth.uid()` + rol están disponibles en RLS.

## Alcance

Usuarios del sistema = empleados de la pescadería (no hay registro público). El alta de usuarios la hace un `admin` desde dentro de la app o directamente desde el dashboard de Supabase al inicio (MVP).

## Fases

### Fase 1 — Login básico + sesión
- Página `/login` con formulario email + password (MUI, Atomic Design: `LoginForm` organism).
- Integración con `@supabase/ssr` (ya está en dependencias) para sesión en cookies, server-side.
- `AuthService` (SRP) con `signIn`, `signOut`, `getSession`.
- Redirigir a `/` tras login exitoso; redirigir a `/login` si no hay sesión y se intenta acceder a cualquier otra ruta.
- Botón de logout visible en `AppShell`.

### Fase 2 — Roles (admin/operador) + RLS real
- Tabla `public.perfiles` (o `public.usuarios`, 1:1 con `auth.users`) con columna `rol` (`admin` | `operador`), creada automáticamente vía trigger `on_auth_user_created` (o manejado a mano en MVP si no hay trigger).
- Reemplazar las políticas RLS genéricas `to authenticated using (true)` de la migración 0001 por políticas que distingan rol en las tablas/columnas sensibles: `compra_items.costo_usd_kg`, `factura_items.costo_usd_kg`, `movimientos`, reportes de margen. Según `/SPEC.md` §5, el `operador` **no** debe poder leer costos ni balances.
  - Enfoque recomendado: vista `factura_items_operador` sin columna `costo_usd_kg` para el rol operador, o política de columna vía `security_invoker` views, documentado en la propia migración.
- `AuthService.getRol()` expuesto para que la UI oculte/muestre secciones (ej. costos en Inventario, reportes de margen en Dashboard) según rol — **la UI oculta, pero RLS es la que de verdad protege**.

### Fase 3 — Protección de rutas + perfil
- `middleware.ts` en la raíz del proyecto: verifica sesión en cada request a rutas de la app (excepto `/login` y assets), redirige a `/login` si no hay sesión.
- Página `/perfil` (o modal): nombre, cambiar contraseña.
- Guard adicional a nivel de Server Component/Server Action para las acciones sensibles (no confiar solo en middleware).

### Fase 4 — Alta de usuarios + recuperación de contraseña
- Pantalla `admin`-only `/usuarios` para invitar/crear operadores (usa Supabase Admin API desde una Server Action, con `service_role` key **solo en servidor**, nunca expuesta al cliente).
- Flujo "olvidé mi contraseña" vía magic link / reset de Supabase Auth.

## Fuera de alcance (MVP)
- Login social (Google, etc.).
- 2FA.
- Multi-tenant / multi-sucursal (ya excluido en `/SPEC.md` §9).

## Variables de entorno nuevas
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor, para Fase 4 — alta de usuarios). Agregar a `.env.example` con comentario de que nunca debe tener prefijo `NEXT_PUBLIC_`.
