---
description: Implementa un módulo SDD usando el subagente executor (responde en caveman lite).
argument-hint: <módulo>
---

Módulo: `$ARGUMENTS`

Si el módulo está vacío, determina primero el siguiente módulo siguiendo `.claude/commands/sdd-next.md`.

Delega en el subagente `executor` (herramienta Agent, `subagent_type: executor`) con este encargo: implementar el módulo siguiendo su `specs/NN-nombre/spec.md`, `tasks.md` y `checklist.md`; ejecutar las tareas en orden, correr `npm run lint` y `npx tsc --noEmit` tras cada tarea, y marcar el checklist al final.

No leas las specs tú mismo: el subagente lo hace en su propio contexto. Al terminar, resume al usuario en pocas líneas su reporte (tareas hechas, estado de lint/tsc, pendientes).
