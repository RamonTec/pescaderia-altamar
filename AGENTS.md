<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Flujo SDD (Spec-Driven Development)

Este proyecto se ejecuta bajo **SDD**. La fuente de verdad es `/SPEC.md` (visión global, decisiones cerradas) y `/specs/` (por módulo: `spec.md`, `tasks.md`, `checklist.md`). `/specs/README.md` define el orden de ejecución, las dependencias entre módulos y la Definition of Done.

## Reglas para cualquier agente (opencode y Claude Code)

1. **No reabrir decisiones cerradas** en `/SPEC.md` ni en los `spec.md` salvo que el usuario lo pida explícitamente.
2. **Leer solo lo que toca**: antes de trabajar un módulo, leer su `spec.md` + `tasks.md` + `checklist.md`, y las secciones de `/SPEC.md` que referencie. No leer los 7 módulos de golpe.
3. **No duplicar contenido de specs** en la conversación; referenciar archivos por ruta.
4. **Ejecutar `tasks.md` en orden**; tras cada tarea, correr `npm run lint` y `npx tsc --noEmit` antes de pasar a la siguiente.
5. **Marcar el `checklist.md`** ítem por ítem al terminar el módulo; si algo se difiere, anotar el motivo en el propio checklist (no borrarlo).
6. **No editar migraciones ya aplicadas** en `supabase/migrations/`; crear una nueva incremental.
7. **Cambios entre módulos**: si un módulo modifica el esquema de otro, anotarlo en el `tasks.md` de ese módulo como "tarea agregada" con fecha.
8. **Sin `any` sin justificar**; tipos en `src/types/domain.ts`.

## Orquestación automática

Existen subagentes (`planner`, `executor`, `verifier`) y comandos (`/sdd-status`, `/sdd-next`, `/sdd-plan`, `/sdd-implement`, `/sdd-verify`) que orquestan el flujo. Preferirlos a hacer el trabajo manualmente.

