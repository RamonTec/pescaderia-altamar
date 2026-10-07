---
description: Planifica (o actualiza) la spec de un módulo SDD usando el agente planner.
agent: planner
---

Crea o actualiza la spec del módulo `$ARGUMENTS`.

Sigue el proceso del agente planner: lee `/SPEC.md` y `/specs/README.md`, y produce/actualiza en `specs/NN-nombre/` los archivos `spec.md`, `tasks.md` y `checklist.md`.

Si `$ARGUMENTS` está vacío, pide el nombre/alcance del módulo antes de empezar. Registra cualquier cambio de alcance en `specs/README.md` con fecha y motivo.
