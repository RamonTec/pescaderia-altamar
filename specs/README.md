# SDD — Pescadería MVP

Este directorio es la fuente de verdad para ejecutar el proyecto bajo **Spec-Driven Development (SDD)**: cada módulo tiene su `spec.md` (qué se construye y por qué), `tasks.md` (en qué orden, en tareas atómicas) y `checklist.md` (cómo se verifica que quedó bien).

Este README lo escribió el agente planificador; los agentes de ejecución (incluido Claude Code en este mismo repo) deben implementar siguiendo estos documentos **sin reabrir decisiones ya cerradas** en `/SPEC.md` (raíz del repo) salvo que el usuario lo pida explícitamente.

## Relación con `/SPEC.md`

`/SPEC.md` (raíz) sigue siendo la visión técnica global: stack, modelo de datos completo, decisiones de diseño cerradas, servicios SRP y patrones. **No se duplica aquí.** Cada spec de módulo referencia las secciones de `/SPEC.md` que aplican y solo detalla lo nuevo o lo que cambia (p. ej. extender `clientes`, crear tabla `contratos`).

## Orden de ejecución y dependencias

```
01-auth        → bloquea todo lo demás (RLS por rol, sesión)
   ├─ Fase 1: login básico + sesión
   ├─ Fase 2: roles admin/operador + RLS real
   ├─ Fase 3: protección de rutas (middleware) + perfil
   └─ Fase 4: recuperación de contraseña + alta de usuarios

02-clientes    → depende de 01-auth (Fase 2 para RLS de columnas sensibles)

03-inventario  → depende de 01-auth
   (productos, compras, procesamiento, stock/valorización —
    ya tiene esquema y servicios parciales, falta UI + repos + ledger real)

04-ventas      → depende de 01-auth, 02-clientes, 03-inventario
   (pedidos/POS, facturación, cobros/pagos, ganancia cambiaria)

05-contratos   → depende de 02-clientes y 04-ventas
   (genera documento a partir de una factura/compra a crédito ya existente)
```

No se empieza un módulo sin que el anterior en la cadena esté en estado `done` según su checklist (o explícitamente marcado como aceptado con deuda técnica documentada).

## Cómo debe trabajar el agente ejecutor en cada módulo

1. Leer `spec.md` completo antes de tocar código.
2. Leer `tasks.md` y ejecutar las tareas **en orden**; cada tarea indica archivos a crear/tocar y su criterio de "hecho".
3. Al terminar una tarea, no pasar a la siguiente sin que compile/lint pase (`npm run lint`, `npx tsc --noEmit`).
4. Al terminar el módulo completo, recorrer `checklist.md` ítem por ítem y marcarlo. Si algo no aplica o se decide diferir, anotar el motivo en el propio checklist (no borrarlo).
5. No modificar el esquema de otro módulo sin anotarlo en ese módulo (si 04-ventas necesita una columna en `clientes`, se anota en `02-clientes/tasks.md` como tarea agregada, con fecha).
6. Las migraciones SQL son incrementales y versionadas en `supabase/migrations/NNNN_descripcion.sql`. Nunca editar una migración ya aplicada; crear una nueva.

## Definition of Done (aplica a todo módulo)

- [ ] Migraciones SQL aplicadas (o script listo si no hay acceso al proyecto Supabase real) y RLS acorde al rol.
- [ ] Repositorios (`lib/repositories/*`) implementan la interfaz correspondiente contra Supabase; nada de lógica de negocio en el repo (solo acceso a datos).
- [ ] Servicios (`lib/services/*`) contienen la lógica de negocio, con responsabilidad única, y son los únicos que usan los repositorios.
- [ ] UI construida con Atomic Design: `components/atoms`, `components/molecules`, `components/organisms`, `components/templates`; las páginas en `app/**/page.tsx` solo componen organisms/templates.
- [ ] Sin `any` sin justificar; tipos en `src/types/domain.ts` actualizados si el módulo agrega entidades.
- [ ] `npm run lint` y `npx tsc --noEmit` sin errores.
- [ ] Checklist del módulo completo (o con pendientes explícitos).

## Convenciones de nomenclatura

- Carpetas de módulo: `NN-nombre` (orden de ejecución, no de aparición en el menú).
- Tablas y columnas en `snake_case`, en español, igual que el esquema ya existente.
- Servicios: `xxxService.ts` con funciones puras cuando sea posible (como `costingService.ts`, `creditService.ts`), o clase cuando necesite estado/DI.
- Repositorios: `IXxxRepository` (interfaz en `interfaces.ts`) + `SupabaseXxxRepository` (implementación).
