# Fortuna

Fortuna is a personal finance app for tracking spending, net worth, investments, and financial goals — built to give you a clear, honest picture of your money over time.

## Quick Start

The entire development workflow should happen within Docker containers to ensure consistency across environments.

```bash
# Setup your environment
./scripts/setup-env.sh

# Start development
docker compose up -d
```

If you want to run any CLI commands make sure to do so within the `workspace` container:

```bash
# Open a shell in the workspace container
docker compose exec workspace sh

# Or run a command directly
docker compose exec workspace <command>
```

### E2E Tests

E2E tests validate the system as a whole, ensuring all applications work correctly together inside Docker. They are not started automatically with the development environment.

To run E2E tests, you must explicitly start the E2E services defined in `docker-compose.yaml`.

Each application has its own E2E service (e.g., `web-e2e`), which spins up the required dependencies and runs tests against downstream services.

```bash
# Run the E2E service for the web app
docker compose --profile e2e up --exit-code-from web-e2e web-e2e
```

### Using the fortuna helper

For convenience, the repo includes a helper script at `bin/fortuna`. It runs commands inside the workspace container so you don't have to type `docker exec` every time:

```bash
bin/fortuna pnpm install
bin/fortuna pnpm turbo test --filter=api
bin/fortuna pnpm turbo check
```

> Even though you can run commands on your host machine, it is highly recommended to always use the Docker container to avoid environment discrepancies.

## Project Structure

The project is organized as a monorepo using pnpm workspaces, Turborepo, and Docker to manage multiple applications and shared packages.

### Apps

- `api`: The backend API built with Node.js and NestJS.
- `web`: The frontend web application built with Next.js and React.

### Packages

- `config`: Shared configuration files.
