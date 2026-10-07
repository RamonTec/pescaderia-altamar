---
description: Reporta el estado de progreso de todos los módulos SDD leyendo sus checklists.
agent: build
---

Reporta el estado del flujo SDD. Lee `/specs/README.md` (orden y dependencias) y, por cada módulo en `specs/NN-nombre/`, su `checklist.md`.

Para cada módulo calcula: total de ítems, `[x]` completados, `[ ]` pendientes, y porcentaje. Respeta el orden de dependencias de `specs/README.md`.

Presenta una tabla:

| Módulo | Progreso | Pendientes | Estado |

Determina el estado así: `done` si 0 pendientes (o solo pendientes explícitamente documentados como deuda aceptada), `en_progreso` si tiene `[x]` y `[ ]`, `pendiente` si 0 `[x]`.

Al final indica cuál es el **siguiente módulo** según el orden de dependencias y su estado. No implementes nada; solo reporta. Cita archivos por ruta, no vuelques su contenido.
