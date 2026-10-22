#!/usr/bin/env python3
"""Genera los agentes y comandos SDD para Gemini a partir de `.opencode/`.

Fuente: `.opencode/agent/*.md` y `.opencode/command/*.md` (se mantienen a mano,
en sincronía con `.claude/`). Destinos generados (no editar a mano):

- Antigravity (`agy`): `.agents/agents/<nombre>.md` y `.agents/skills/<comando>/SKILL.md`.
- Gemini CLI: `.gemini/agents/<nombre>.md` y `.gemini/commands/<comando>.toml`.

Las reglas (`AGENTS.md`) las leen ambos de forma nativa; `GEMINI.md` las importa.

Uso: python3 scripts/sync-agents.py
"""

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_AGENTS = ROOT / ".opencode/agent"
SRC_COMMANDS = ROOT / ".opencode/command"
HEADER = "<!-- Generado por scripts/sync-agents.py desde .opencode/; no editar a mano. -->\n\n"

# Gemini CLI: herramientas restringidas para los agentes que no implementan código.
GEMINI_READ = ["read_file", "read_many_files", "list_directory", "glob", "grep_search"]
GEMINI_CFG = {
    "planner": dict(tools=GEMINI_READ + ["write_file", "replace"], max_turns=60, timeout_mins=20),
    "verifier": dict(tools=GEMINI_READ + ["run_shell_command", "replace"], max_turns=60, timeout_mins=20),
    "reviewer": dict(tools=GEMINI_READ + ["run_shell_command", "replace"], max_turns=60, timeout_mins=20),
    "executor": dict(max_turns=200, timeout_mins=120),
    "frontend": dict(max_turns=120, timeout_mins=60),
    "supabase": dict(max_turns=120, timeout_mins=60),
    "typescript": dict(max_turns=80, timeout_mins=40),
}


def parse(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text()
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if not m:
        raise SystemExit(f"{path}: falta frontmatter")
    meta = dict(re.findall(r"^(\w+):\s*(.*)$", m.group(1), re.M))
    return meta, text[m.end():].strip() + "\n"


def frontmatter(fields: list[str]) -> str:
    return "---\n" + "\n".join(fields) + "\n---\n"


def is_generated(path: Path) -> bool:
    target = path / "SKILL.md" if path.is_dir() else path
    return target.is_file() and "Generado por scripts/sync-agents.py" in target.read_text()


def reset(path: Path) -> None:
    """Borra solo lo que generó este script; respeta lo que ya existía (p. ej. otras skills)."""
    path.mkdir(parents=True, exist_ok=True)
    for entry in path.iterdir():
        if is_generated(entry):
            shutil.rmtree(entry) if entry.is_dir() else entry.unlink()


def command_body(meta: dict[str, str], body: str, args: str, next_ref: str) -> str:
    body = body.replace("$ARGUMENTS", args).replace("usa `/sdd-next`", f"sigue {next_ref}")
    agent = meta.get("agent")
    if agent and agent != "build":
        body = (
            f"Delega este encargo en el subagente `{agent}`; no hagas el trabajo tú mismo. "
            "Al terminar, resume al usuario en pocas líneas su reporte.\n\n" + body
        )
    return body


def main() -> None:
    agents = sorted(SRC_AGENTS.glob("*.md"))
    commands = sorted(SRC_COMMANDS.glob("*.md"))
    for d in ["agents/agents", "agents/skills", "gemini/agents", "gemini/commands"]:
        reset(ROOT / f".{d}")

    for f in agents:
        meta, body = parse(f)
        name, desc = f.stem, json.dumps(meta["description"], ensure_ascii=False)
        (ROOT / f".agents/agents/{name}.md").write_text(
            frontmatter([f"name: {name}", f"description: {desc}"]) + "\n" + HEADER + body
        )
        cfg = GEMINI_CFG.get(name, {})
        fields = [f"name: {name}", f"description: {desc}", "kind: local"]
        if "tools" in cfg:
            fields += ["tools:"] + [f"  - {t}" for t in cfg["tools"]]
        fields += [f"max_turns: {cfg.get('max_turns', 60)}", f"timeout_mins: {cfg.get('timeout_mins', 30)}"]
        (ROOT / f".gemini/agents/{name}.md").write_text(frontmatter(fields) + "\n" + HEADER + body)

    for f in commands:
        meta, body = parse(f)
        name, desc = f.stem, json.dumps(meta["description"], ensure_ascii=False)
        skill = ROOT / f".agents/skills/{name}"
        skill.mkdir()
        (skill / "SKILL.md").write_text(
            frontmatter([f"name: {name}", f"description: {desc}"])
            + "\n" + HEADER
            + command_body(meta, body, "<argumentos escritos tras el comando>", "la skill `sdd-next`")
        )
        prompt = command_body(meta, body, "{{args}}", "`.gemini/commands/sdd-next.toml`")
        if '"""' in prompt:
            raise SystemExit(f"{f}: el cuerpo no puede contener comillas triples")
        (ROOT / f".gemini/commands/{name}.toml").write_text(
            f"# Generado por scripts/sync-agents.py desde .opencode/; no editar a mano.\n"
            f'description = {desc}\nprompt = """\n{prompt}"""\n'
        )

    print(f"{len(agents)} agentes y {len(commands)} comandos generados en .agents/ y .gemini/")


if __name__ == "__main__":
    main()
