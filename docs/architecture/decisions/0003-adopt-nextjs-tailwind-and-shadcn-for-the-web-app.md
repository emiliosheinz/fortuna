# 3. Adopt Next.js, Tailwind, and shadcn/ui for the web app

Date: 2026-05-17

## Status

Accepted

## Context

The web client needs:

- Server-rendered pages for landing/marketing content and signed-in dashboards that benefit from server data fetching.
- A modern React stack that can adopt server actions and streaming when useful.
- A styling and component layer that does not lock us into a heavy UI framework and that can be customized without fighting the abstraction.
- A portable production artifact (single Node process container image).

## Decision

- **Framework:** [Next.js](https://nextjs.org/) (App Router) on the latest stable React. Built so the production image carries only what the server actually needs, not the full build toolchain.
- **Styling:** [Tailwind CSS](https://tailwindcss.com/), CSS-first configuration with themes driven by CSS variables.
- **Components:** [shadcn/ui](https://ui.shadcn.com/) on top of Radix primitives. Components are copied into the web app rather than consumed as a versioned library, but we treat the copied source as vendored: customization happens through composition (wrapper components, CSS-variable-driven theming), not by editing the generated files, so future shadcn upgrades stay straightforward.
- **Theming:** light/dark theming uses both the `class` and `data-theme` strategies, so styles and JS can opt into either.

## Decision boundaries:

- The web app fetches data from the API over HTTP. It never reads the database directly.
- Server-side React features (server components, server actions) are used where they simplify data flow, not as the default for every interaction.

## Consequences

- shadcn components live in the repo but are treated as vendored. Direct edits to the copied source create upgrade pain and are avoided; differences are expressed through wrappers and theming instead.
- Tailwind's CSS-first configuration is recent — minor ecosystem churn (PostCSS plugin compatibility, editor tooling) is expected and tolerated.
- The trimmed production output keeps images small at the cost of being more particular about which build artifacts get copied in.
- Decoupling web from the database means schema and access-control changes ripple only through the API, never through the frontend.
