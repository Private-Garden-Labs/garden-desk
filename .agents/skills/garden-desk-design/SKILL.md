---
name: garden-desk-design
description: Apply the Garden Desk design rules to the desktop app (packages/desktop/src) and the website (site/). Use for any visual, layout, typography, color, or motion change.
---

# Garden Desk Design Rules

Top priority: the AGENTS.md minimum-work rule applies. Keep the current visual identity and change only what the task asks for. Check the result in a real render: `pnpm site:dev`, and `/demo/` for the app, in light and dark mode.

## Surfaces

- Type: IBM Plex Sans for interface text, Plex Serif only for reading headings, Plex Mono for code and data. Use fixed rem sizes in the app, not `clamp()`.
- Color: cool gray and teal. Teal marks selection, progress, and ordinary actions. Ember marks only warnings and destructive actions. Do not add warm beige or a second accent.
- Elevation: use a border or a shadow, not both. Keep the asymmetric composer and suggestion shape.
- Tables: one hairline border, a light header tint, a subtle row stripe, and `font-variant-numeric: tabular-nums`.
- Text: body lines 65 to 75 characters, tracking not below -0.04em, `text-wrap: balance` on headings.
- Style the browser surfaces from the palette: text selection, focus ring, and caret.

## Motion

- Animate only to show state, feedback, or a real change. Do not animate keyboard actions or controls that people use many times a day.
- Durations: press 100 to 160 ms, small popovers 125 to 200 ms, menus 150 to 250 ms, dialogs 300 ms or less. Website reveals can be longer.
- Easing: ease-out, `cubic-bezier(0.23, 1, 0.32, 1)`, for enter and press. Never use ease-in or `transition: all`.
- Pressable controls get `transform: scale(0.97)` on `:active`.
- Put hover movement in `@media (hover: hover) and (pointer: fine)`, and only on elements that you can click.
- Enter from `scale(0.95)` with opacity, never from `scale(0)`. Animate only `transform` and `opacity`.
- With `prefers-reduced-motion`, keep opacity changes and remove movement.

## Do Not Add

- Small uppercase labels above headings. When the label is a fact, such as a date or a version, show it as plain metadata.
- Colored side borders thicker than 1 px, gradient text, or decorative pulsing dots.
- Hover effects on elements that are not interactive.
- Em-dashes in visible copy or page titles.

## Check Before Done

- Website at 320, 390, and 1440 px: no horizontal overflow, and nav and button labels stay on one line. The app minimum width is 1120 px.
- Contrast: body text 4.5:1, large text 3:1, in both themes.
- Every control has hover, focus, active, and disabled states.

## Sources

We tried three third-party design skills (about 590 KB) and kept only these about 40 lines:

- [emil-design-eng](https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng) by Emil Kowalski (MIT): motion rules.
- [Impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus (Apache-2.0): surface and product UI rules.
- [Taste](https://github.com/Leonxlnx/taste-skill/tree/main/skills/taste-skill) by Leonxlnx (MIT): the em-dash, dot, and one-line nav rules.
