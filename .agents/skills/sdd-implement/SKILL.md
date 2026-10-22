---
name: sdd-implement
description: "Implementa un módulo SDD usando el agente executor (responde en caveman lite)."
---

<!-- Generado por scripts/sync-agents.py desde .opencode/; no editar a mano. -->

Delega este encargo en el subagente `executor`; no hagas el trabajo tú mismo. Al terminar, resume al usuario en pocas líneas su reporte.

Implementa el módulo `<argumentos escritos tras el comando>` siguiendo su `specs/NN-nombre/spec.md`, `tasks.md` y `checklist.md`.

El agente executor ejecutará las tareas en orden, correrá `npm run lint` y `npx tsc --noEmit` tras cada tarea, y marcará el checklist al final.

Si `<argumentos escritos tras el comando>` está vacío, sigue la skill `sdd-next` para determinar el módulo siguiente antes de implementar.
