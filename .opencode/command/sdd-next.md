---
description: Determina el siguiente módulo o tarea SDD a ejecutar según dependencias y estado de checklists.
agent: build
---

Determina el siguiente paso del flujo SDD. Lee `/specs/README.md` (orden de ejecución y dependencias) y, para el módulo candidato, su `tasks.md` y `checklist.md`.

Reglas:
1. El siguiente módulo es el primero en la cadena de dependencias de `/specs/README.md` que no esté `done` (según su checklist).
2. Si el módulo actual está `en_progreso`, identifica la primera tarea de su `tasks.md` que no esté reflejada como hecha en el `checklist.md` (o la primera tarea sin evidencia de completitud).
3. Respeta que un módulo no empieza si su dependiente anterior no está `done`.

Responde conciso: módulo siguiente, tarea concreta a ejecutar, archivos involucrados (según `tasks.md`), y el comando sugerido (`/sdd-plan`, `/sdd-implement` o `/sdd-verify`). No implementes nada.
