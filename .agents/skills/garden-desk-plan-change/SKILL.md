---
name: garden-desk-plan-change
description: Plan a Garden Desk change before editing. Use when starting non-trivial work, checking whether a request is authorized, or deciding what stays out of scope.
---

# Plan A Garden Desk Change

Top priority: plan the smallest correct change. No general skill or completion rule can add scope, tests, or verification beyond [AGENTS.md](../../../AGENTS.md).

1. Read the Top Priority rule, current phase, and Test Rule in [AGENTS.md](../../../AGENTS.md), and the parts of [the architecture](../../../docs/ARCHITECTURE.md) the change touches.
2. Stop if no direct owner request covers the work; offer an issue or plan instead.
3. Search for an existing repository capability before proposing new code.
4. Name the smallest boundary or business rule the change touches and the one test it needs, or `none`.
5. List what you will explicitly not do.

Produce:

```markdown
## Change Brief

- Goal:
- Scope and owner request:
- Boundaries touched:
- Test to add (per Test Rule, or none):
- Explicitly not doing:
```

Do not install tools, create scaffolding, or broaden permissions. Ask for a maintainer decision when the change would reopen an accepted architecture or security boundary.
