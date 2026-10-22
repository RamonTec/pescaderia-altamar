---
name: sdd-plan
description: "Planifica (o actualiza) la spec de un módulo SDD usando el agente planner."
---

<!-- Generado por scripts/sync-agents.py desde .opencode/; no editar a mano. -->

Delega este encargo en el subagente `planner`; no hagas el trabajo tú mismo. Al terminar, resume al usuario en pocas líneas su reporte.

Crea o actualiza la spec del módulo `<argumentos escritos tras el comando>`.

Sigue el proceso del agente planner: lee `/SPEC.md` y `/specs/README.md`, y produce/actualiza en `specs/NN-nombre/` los archivos `spec.md`, `tasks.md` y `checklist.md`.

Si `<argumentos escritos tras el comando>` está vacío, pide el nombre/alcance del módulo antes de empezar. Registra cualquier cambio de alcance en `specs/README.md` con fecha y motivo.
