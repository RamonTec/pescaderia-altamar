---
description: Prepara y abre el PR hacia `dev` de la rama actual de un módulo SDD, con mensaje según la plantilla del repo.
---

Prepara el PR del módulo `$ARGUMENTS` (si está vacío, dedúcelo de la rama actual y de los commits `Tareas: NN-…`).

Sigue "Flujo Git" en `AGENTS.md`:

1. Verifica que la rama actual no sea `dev`, `sbx` ni `main`, que el árbol esté limpio y que `npm run lint` y `npx tsc --noEmit` pasen. Si algo falla, detente y repórtalo.
2. Lee `specs/NN-nombre/checklist.md`: si hay ítems sin marcar y sin motivo, detente y repórtalo.
3. Revisa `git log pescaderia-altamar/dev..HEAD` y `git diff --stat pescaderia-altamar/dev...HEAD` para listar migraciones nuevas, otros módulos tocados y tareas cubiertas.
4. Redacta el título (`tipo(ámbito): …`, igual al commit principal) y el cuerpo con `.github/pull_request_template.md`, con hechos del diff y no del spec copiado.
5. Haz push (`git push -u pescaderia-altamar <rama>`). Si `gh` está disponible, crea el PR hacia `dev` (nunca hacia `sbx` ni `main`) con `gh pr create --base dev --title … --body-file …`. Si no, entrega al usuario el título, el cuerpo y el enlace `https://github.com/RamonTec/pescaderia-altamar/compare/dev...<rama>?expand=1`.
6. No hagas merge ni actives auto-merge.
