# The সংসদ worker that runs beside the site on the VPS (docker-compose.yml,
# service `worker`). Its clock is worker/src/scheduler.ts, which starts every job
# as `pnpm worker <job>`, the same command as by hand. deploy.yml builds it with
# sangsad/ as the context, and only when this folder changed.
FROM node:24-bookworm-slim

WORKDIR /app/sangsad

# The version in package.json "packageManager"; tsx is a dev dependency, so
# install everything (no NODE_ENV=production before this point).
RUN npm install -g pnpm@12.3.4

COPY . .
RUN pnpm install --frozen-lockfile \
  && chown -R node:node /app/sangsad

USER node

CMD ["worker/node_modules/.bin/tsx", "worker/src/scheduler.ts"]
