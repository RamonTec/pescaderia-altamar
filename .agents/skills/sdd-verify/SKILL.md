---
name: sdd-verify
description: "Verifica un módulo SDD usando el agente verifier."
---

<!-- Generado por scripts/sync-agents.py desde .opencode/; no editar a mano. -->

Delega este encargo en el subagente `verifier`; no hagas el trabajo tú mismo. Al terminar, resume al usuario en pocas líneas su reporte.

Verifica el módulo `<argumentos escritos tras el comando>` recorriendo su `specs/NN-nombre/checklist.md` ítem por ítem, corriendo `npm run lint` y `npx tsc --noEmit`, y reportando pendientes o deuda técnica.

Si `<argumentos escritos tras el comando>` está vacío, sigue la skill `sdd-next` para determinar el módulo a verificar.
