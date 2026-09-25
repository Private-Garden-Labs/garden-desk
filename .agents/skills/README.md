# Agent Skills

Short, on-demand instructions that package the [development workflow](../../docs/DEVELOPMENT_WORKFLOW.md) for coding agents. Codex reads this directory; Claude Code reads the `.claude/skills` symlink to it (on a Windows checkout without symlink support, Claude Code will not see them). They do not override [AGENTS.md](../../AGENTS.md), ADRs, or the active milestone, and they cannot install tools, mutate external systems, or broaden permissions.

## Design Skills

Use these third-party skills for UI work on the desktop app (`packages/desktop/src`) and the website (`site/`). AGENTS.md and [docs/DESKTOP_DESIGN.md](../../docs/DESKTOP_DESIGN.md) take priority over them. Each folder keeps its upstream license.

| Skill | Source | Commit | License |
| --- | --- | --- | --- |
| `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `d16ebe6` | MIT |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `9d715cc` | Apache-2.0 |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `c184364` | MIT |

The `impeccable` copy has no `scripts/` folder, because its launcher downloads a binary. The skill then reads PRODUCT.md and DESIGN.md directly, as its "Launcher unavailable" step says.
