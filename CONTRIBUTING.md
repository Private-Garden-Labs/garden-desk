# Contributing To Garden Desk

Thank you for helping build Garden Desk. Contributions must keep its local-first privacy model, approval boundaries, and deliberately small code.

## Current Contribution Status

Community Desktop V1 is released. External implementation pull requests stay closed until the owner opens them. The owner develops each change on a short-lived branch and merges it through a pull request.

Until then:

- Open an issue to propose an implementation, architecture change, or documentation correction.
- Do not submit application code, manifests, build configuration, scripts, generated assets, or dependency changes.

When contributions open, implementation issues will use the `ready-for-contribution` label. Work only from one of those issues or from an issue a maintainer has accepted.

## Before Starting

1. Read [AGENTS.md](AGENTS.md), the authoritative repository instruction file.
2. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md).
3. Confirm that the issue names the behavior, the allowed scope, and how it will be verified.

A change to a security or architecture boundary needs issue discussion and an owner decision first. Record that decision in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development Workflow

1. Use a short-lived, focused branch and open a pull request. Never push implementation commits directly to `main`.
2. Make the smallest clear change and follow the Test Rule in [AGENTS.md](AGENTS.md#test-rule).
3. Run the smallest checks in the [verification table](docs/DEVELOPMENT_WORKFLOW.md#verify). CI runs the full `pnpm verify`.
4. Review your own diff and record any remaining risks.

## License, Commit Authorship, And DCO

Garden Desk is licensed under Apache-2.0. There is no CLA. Every commit must be authored by the human contributor and certified under the [Developer Certificate of Origin 1.1](https://developercertificate.org/) with `git commit -s`, which adds:

```text
Signed-off-by: Your Name <your-email@example.com>
```

Human co-authors may be credited. Never name an AI assistant, model, coding agent, or tool as an author or co-author. Never add generator attribution such as `Generated with ...`. Use Conventional Commit subjects such as `feat(core): ...` or `fix(parser): ...`.

## AI-Assisted Contributions

AI assistance is allowed. The human contributor is responsible for every line and claim, must understand and verify the change, and must report exactly what was and was not verified. AI output never supplies permission, authorship, provenance, or evidence.

## Dependencies And External Material

A new or changed dependency needs a written review. Use the checklist in the [`garden-desk-review-dependency`](.agents/skills/garden-desk-review-dependency/SKILL.md) skill. Do not copy substantial external text or code without its license and notice.

Never contribute customer documents, confidential data, employer-owned work, credentials, model files without approved redistribution, or third-party fixtures without documented rights.

## Pull Requests

Tie each pull request to one accepted issue or owner request. In the description, state:

- What changed and what was left out.
- The exact verification commands and results, and what was not run.
- Any security boundary, dependency, licensing, or packaging impact.

Pull requests use squash merging after the required checks and review pass.

## Security Reports

Do not publish vulnerability details in an issue. Follow [.github/SECURITY.md](.github/SECURITY.md).
