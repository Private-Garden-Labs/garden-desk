# Agent Skills

Short, on-demand instructions that package the [development workflow](../../docs/DEVELOPMENT_WORKFLOW.md) for coding agents. Codex reads this directory. Claude Code reads [.claude/skills](../../.claude/skills), where each skill has a pointer file with the same name and description; when you add, rename, or redescribe a skill here, update its pointer too. They do not override [AGENTS.md](../../AGENTS.md), ADRs, or the active milestone, and they cannot install tools, mutate external systems, or broaden permissions.
