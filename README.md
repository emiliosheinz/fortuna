![Fortuna Banner](./docs/images/banner.png)

# Fortuna

A personal finance app for tracking spending, net worth, investments, and financial goals — built to give an honest picture of money over time.

> **Heads up:** Fortuna is also a personal experiment in agentic coding. I'm using it as a playground to push my own ideas and see how far AI-assisted development can go on a real, end-to-end project. Expect choices that prioritize that experiment alongside the product itself.

## Quick start

Docker is the only host requirement.

```bash
./scripts/setup-env.sh        # copies .env.example to .env (use -f to overwrite)
docker compose up -d          # postgres, migrations, api, web
```

- API: <http://localhost:3000>
- Web: <http://localhost:3001>

## Repo layout

```
apps/
  api/        NestJS + TypeORM + Postgres
  web/        Next.js + Tailwind + shadcn/ui
packages/
  config/     Shared Biome, TypeScript, and Jest config (@fortuna/config)
docker/       Auxiliary base images (CLI, Playwright) published to GHCR
docs/         Cross-cutting documentation and ADRs
bin/fortuna   Helper that runs commands inside the workspace container
```

## Where to go next

| If you want to                               | See                                              |
|----------------------------------------------|--------------------------------------------------|
| Run commands, tests, e2e, or migrations      | [`docs/development.md`](./docs/development.md)   |
| Understand the release and publish pipeline  | [`docs/release.md`](./docs/release.md)           |
| Read the rationale behind a technical choice | [`docs/architecture/decisions/`](./docs/architecture/decisions/) |
| Work on the API                              | [`apps/api/README.md`](./apps/api/README.md)     |
| Work on the web app                          | [`apps/web/README.md`](./apps/web/README.md)     |
| Use or extend shared config                  | [`packages/config/README.md`](./packages/config/README.md) |
| Contribute changes                           | [`CONTRIBUTING.md`](./CONTRIBUTING.md)           |

