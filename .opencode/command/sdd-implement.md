---
description: Implementa un módulo SDD usando el agente executor (responde en caveman lite).
agent: executor
---

Implementa el módulo `$ARGUMENTS` siguiendo su `specs/NN-nombre/spec.md`, `tasks.md` y `checklist.md`.

El agente executor ejecutará las tareas en orden, correrá `npm run lint` y `npx tsc --noEmit` tras cada tarea, y marcará el checklist al final.

Si `$ARGUMENTS` está vacío, usa `/sdd-next` para determinar el módulo siguiente antes de implementar.
