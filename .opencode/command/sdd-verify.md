---
description: Verifica un módulo SDD usando el agente verifier.
agent: verifier
---

Verifica el módulo `$ARGUMENTS` recorriendo su `specs/NN-nombre/checklist.md` ítem por ítem, corriendo `npm run lint` y `npx tsc --noEmit`, y reportando pendientes o deuda técnica.

Si `$ARGUMENTS` está vacío, usa `/sdd-next` para determinar el módulo a verificar.
