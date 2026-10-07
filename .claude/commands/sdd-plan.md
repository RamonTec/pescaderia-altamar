---
description: Planifica (o actualiza) la spec de un módulo SDD usando el subagente planner.
argument-hint: <módulo>
---

Módulo: `$ARGUMENTS`

Si el módulo está vacío, pide el nombre/alcance al usuario antes de empezar.

Delega en el subagente `planner` (herramienta Agent, `subagent_type: planner`) con este encargo: crear o actualizar la spec del módulo indicado, leyendo `/SPEC.md` y `/specs/README.md`, y producir/actualizar en `specs/NN-nombre/` los archivos `spec.md`, `tasks.md` y `checklist.md`. Registrar cualquier cambio de alcance en `specs/README.md` con fecha y motivo.

No leas las specs tú mismo: el subagente lo hace en su propio contexto. Al terminar, resume al usuario en pocas líneas los archivos tocados y las decisiones pendientes de aprobación.
