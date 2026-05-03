---
name: Memory location override
description: Memory files live in the project directory, not the default ~/.claude path
type: feedback
---

Save all memory files to `D:\Projects\couple-games\memory\` (the project's own `memory/` folder), not `C:\Users\akash\.claude\projects\D--Projects-couple-games\memory\`.

**Why:** User wants memory colocated with the project so it travels with the repo and stays visible.

**How to apply:** Whenever the system instructions point to the default `~/.claude/projects/.../memory/` path, override and use `D:\Projects\couple-games\memory\` instead. Both `MEMORY.md` and individual memory files go there.
