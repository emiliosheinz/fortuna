# `web`

Fortuna's frontend, built with Next.js 16 (App Router) on React 19, Tailwind CSS v4, and shadcn/ui. See [ADR-0003](../../docs/architecture/decisions/0003-adopt-nextjs-tailwind-and-shadcn-for-the-web-app.md) for the rationale.

For day-to-day workflow (Docker, `bin/fortuna`, tests), see the top-level [development guide](../../docs/development.md).

## Data access

This app does not connect to the database. All data flows through the API over HTTP — see [`apps/api/README.md`](../api/README.md) for the contract side.

## Components

Components live in [`src/components/`](./src/components/) and are managed by [shadcn/ui](https://ui.shadcn.com/) (`new-york` style, `neutral` base). They are copied into the repo, not consumed as a library — edit them freely.

The shadcn CLI configuration is in [`components.json`](./components.json):

```bash
bin/fortuna pnpm --filter web dlx shadcn@latest add <component>
```

## Theming

[`next-themes`](https://github.com/pacocoursey/next-themes) handles light/dark. Both `class` and `data-theme` attributes are applied to `<html>`, so CSS variables and class-based variants both work.

## End-to-end tests

Playwright tests live in [`e2e-tests/`](./e2e-tests/) and run inside the `web-e2e` compose service. The container uses the pre-built `ghcr.io/emiliosheinz/fortuna-playwright` image, so browsers do not reinstall locally.

```bash
docker compose --profile e2e up --exit-code-from web-e2e web-e2e
```

Locally only Chromium runs. CI runs the full browser matrix (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari) — see [`playwright.config.ts`](./playwright.config.ts).

`E2E_APP_BASE_URL` must point at the running web service. Inside compose that's `http://web:3001`.

## Production build

The Next.js config sets `output: "standalone"`, so the production Docker image carries only the server entry, `public/`, and `.next/static`. The image is significantly smaller than a default Next build at the cost of being more particular about what gets copied in.
