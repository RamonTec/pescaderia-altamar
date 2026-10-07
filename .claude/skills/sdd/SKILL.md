---
name: sdd
description: Flujo Spec-Driven Development del proyecto. Usar cuando el usuario hable de SDD, spec, specs, módulo, fase, tasks, checklist, /sdd-status, /sdd-next, /sdd-plan, /sdd-implement, /sdd-verify, Definition of Done, o pregunte cómo se ejecuta/avanza el proyecto. Carga el contexto del flujo SDD (SPEC.md + specs/) sin duplicarlo.
---

# Flujo SDD

Este proyecto se ejecuta bajo Spec-Driven Development. Las reglas completas están en `AGENTS.md` (sección "Flujo SDD"); no las repitas, referencia esa sección.

## Dónde está la verdad

- `/SPEC.md` — visión global, stack, decisiones de diseño cerradas, esquema de datos, servicios SRP.
- `/specs/README.md` — orden de ejecución, dependencias entre módulos, Definition of Done, cambios de alcance registrados, convenciones de nomenclatura.
- `/specs/NN-nombre/spec.md` — qué se construye y por qué en un módulo.
- `/specs/NN-nombre/tasks.md` — tareas atómicas en orden, con archivos y criterio de "hecho".
- `/specs/NN-nombre/checklist.md` — cómo se verifica que quedó bien.

## Cómo operar

1. Antes de tocar un módulo, lee su `spec.md` + `tasks.md` + `checklist.md` y solo las secciones de `/SPEC.md` que referencie. No leas los 7 módulos de golpe.
2. No reabras decisiones cerradas salvo pedido explícito.
3. No dupliques contenido de specs; referencia por ruta.

## Orquestación

- Subagentes SDD: `planner` (escribe specs), `executor` (implementa, en caveman lite), `verifier` (recorre checklist + lint/tsc).
- Subagentes especialistas: `frontend` (UI), `supabase` (migraciones/RLS/repos/servicios), `typescript` (tipos/zod), `reviewer` (revisión transversal).
- Definidos en `.claude/agents/` (Claude Code) y `.opencode/agent/` (opencode); mantener ambos en sincronía.
- Comandos: `/sdd-status` (progreso), `/sdd-next` (siguiente módulo/tarea), `/sdd-plan`, `/sdd-implement`, `/sdd-verify`.

Prefiere usar estos comandos/agentes antes que rehacer el trabajo manualmente.
