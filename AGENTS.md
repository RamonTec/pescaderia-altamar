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

Existen subagentes (`planner`, `executor`, `verifier`) y comandos (`/sdd-status`, `/sdd-next`, `/sdd-plan`, `/sdd-implement`, `/sdd-verify`, `/sdd-pr`) que orquestan el flujo. Preferirlos a hacer el trabajo manualmente.

Las definiciones existen para cada herramienta: Claude Code (`.claude/agents`, `.claude/commands`), opencode (`.opencode/agent`, `.opencode/command`), Antigravity (`.agents/agents`, `.agents/skills`) y Gemini CLI (`.gemini/agents`, `.gemini/commands`). `.claude/` y `.opencode/` se editan a mano y en sincronía; `.agents/` y `.gemini/` se **generan** desde `.opencode/` con `python3 scripts/sync-agents.py` (correrlo y commitear el resultado tras cambiar un agente o comando). Antigravity y Gemini leen estas reglas desde `AGENTS.md` / `GEMINI.md`.


# Flujo Git (rama por módulo/fase, commits descriptivos, PR claro)

Aplica a todo agente que escriba código o specs. El remoto es `pescaderia-altamar`; la rama base es `main`.

1. **Una rama por módulo SDD o por fase** de su `tasks.md`, creada desde `main` actualizado y **en su propio worktree** (ver regla 7):
   `git fetch pescaderia-altamar && git worktree add ../pescaderia-mvp-wt/<slug> -b feat/<slug> pescaderia-altamar/main`.
   Prefijos: `feat/` (módulo o fase), `fix/` (corrección), `refactor/` (sin cambio funcional), `docs/` (solo specs). Slug en kebab-case sin el número del módulo (`feat/gastos`, `feat/gastos-nomina`). Nunca trabajar ni hacer commit directo en `main`.
2. **Commits** en español con Conventional Commits: `tipo(ámbito): qué cambia y para qué`, en imperativo, ≤ 72 caracteres en el asunto. Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`. El ámbito es el dominio (`gastos`, `nomina`, `dashboard`, `specs`). El cuerpo (opcional) explica el porqué y referencia la tarea: `Tareas: 20-gastos T3–T5`.
3. **Granularidad**: un commit por tarea o grupo coherente de tareas de `tasks.md`, solo con `npm run lint` y `npx tsc --noEmit` en verde. La planificación va en su propio commit: `docs(specs): planificar NN-nombre`. Las migraciones van en un commit separado del código que las usa. Nada de commits "wip" ni con archivos ajenos a la tarea.
4. **Antes del PR**: checklist del módulo marcado (pendientes con motivo), `npm run lint` y `npx tsc --noEmit` en verde, rama rebasada o mergeada con `main` sin conflictos, y `git push -u pescaderia-altamar <rama>`.
5. **PR** hacia `main` con la plantilla `.github/pull_request_template.md`: título igual al commit principal (`feat(gastos): …`), y en el cuerpo qué se hizo, módulo/tareas, migraciones nuevas, cambios en otros módulos (tareas agregadas), cómo probar, checklist y pendientes. Usar `/sdd-pr` para prepararlo. Si `gh` no está instalado, dejar el cuerpo en el scratchpad y dar al usuario el enlace `https://github.com/RamonTec/pescaderia-altamar/compare/main...<rama>?expand=1`.
6. **No hacer merge** del PR, push forzado a ramas compartidas ni borrado de ramas sin pedido explícito del usuario. Una rama se empieza solo cuando su dependencia ya está mergeada en `main` (o se basa en la rama de la dependencia, indicándolo en el PR).
7. **Un worktree por agente y rama.** Varios agentes (Claude Code, opencode, Antigravity, Gemini) pueden trabajar a la vez; una carpeta solo está en una rama, y un `git switch` le cambia la rama a todos los que la usan. Por eso:
   - Cada rama se trabaja en su carpeta `../pescaderia-mvp-wt/<slug>` (hermana del repo, fuera de él), creada con el comando de la regla 1. La carpeta principal `pescaderia-mvp` es del usuario: no se hace `git switch` en ella ni en el worktree de otro agente.
   - Antes de cada commit, confirmar con `git branch --show-current` que se está en la rama propia.
   - Preparar el worktree nuevo: `npm ci`, `ln -s ../../pescaderia-mvp/.env .env` (el `.env` no está en git) y `npx next typegen` antes del primer `npx tsc --noEmit`.
   - Una rama solo puede estar abierta en un worktree; si `git worktree add` dice que ya está en uso, otro agente la tiene: no forzar, avisar al usuario.
   - Al mergear el PR, borrar la carpeta con `git worktree remove ../pescaderia-mvp-wt/<slug>` (y `git worktree prune` si quedó huérfana). Nunca borrar el worktree de otro agente.
