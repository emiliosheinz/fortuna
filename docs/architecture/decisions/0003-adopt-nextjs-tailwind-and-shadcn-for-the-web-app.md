# 3. Adopt Next.js, Tailwind, and shadcn/ui for the web app

Date: 2026-05-17

## Status

Accepted

## Context

The web client needs:

- Server-rendered pages for landing/marketing content and signed-in dashboards that benefit from server data fetching.
- A modern React stack that can adopt server actions and streaming when useful.
- A styling and component layer that does not lock us into a heavy UI framework and that can be customized without fighting the abstraction.
- Portable production artifacts (single Node process Docker image).

## Decision

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router) on React 19. Built with `output: "standalone"` so the production Docker image only carries what the server actually needs.
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/), CSS-first configuration (no `tailwind.config.js`); themes via CSS variables.
- **Components:** [shadcn/ui](https://ui.shadcn.com/) (`new-york` style, `neutral` base color), Radix primitives underneath. Components are copied into `apps/web/src/components`, not consumed as a library.
- **Theming:** `next-themes` with both `class` and `data-theme` attribute strategies, so styles and JS can opt into either.

## Consequences

- The web app fetches data from the API over HTTP; it never reads the database directly.
- shadcn components are owned by the repo. We can change them freely; there is no upstream to reconcile with.
- Tailwind v4 is recent — minor ecosystem churn (PostCSS plugin compatibility, editor tooling) is expected and tolerated.
- Standalone Next.js output means the production image is much smaller than a default Next build, at the cost of being more particular about what gets copied (`public/`, `.next/static`).
- React Server Components and server actions are available; we use them where they simplify data flow, not as the default for every interaction.
