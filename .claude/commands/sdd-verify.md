---
description: Verifica un módulo SDD usando el subagente verifier.
argument-hint: <módulo>
---

Módulo: `$ARGUMENTS`

Si el módulo está vacío, determina primero el módulo a verificar siguiendo `.claude/commands/sdd-next.md`.

Delega en el subagente `verifier` (herramienta Agent, `subagent_type: verifier`) con este encargo: verificar el módulo recorriendo su `specs/NN-nombre/checklist.md` ítem por ítem, correr `npm run lint` y `npx tsc --noEmit`, y reportar pendientes o deuda técnica.

No leas las specs tú mismo: el subagente lo hace en su propio contexto. Al terminar, muestra al usuario su tabla de resultados y la lista de pendientes.
