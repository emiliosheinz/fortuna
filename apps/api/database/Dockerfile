FROM node:24-alpine

RUN corepack enable pnpm && corepack install -g pnpm@11.1.0

WORKDIR /fortuna

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY --parents packages/*/package.json ./

RUN pnpm install --frozen-lockfile

COPY apps/api/database apps/api/database

ENTRYPOINT ["pnpm", "--filter", "api"]
CMD ["migration:run"]
