# Chart Hive data server. Host-agnostic: everything is configured with environment variables.
FROM node:22-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    QT_DATA_DIR=/data \
    HIVE_SEED_DIR=/app/seed

WORKDIR /app

# Dependencies first, for layer caching. Lockfile-exact, no dev dependencies.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Code and seed data only (see .dockerignore: no .env files, no caches, no data folder).
COPY server ./server
COPY lib ./lib
COPY seed ./seed
COPY docker-entrypoint.sh ./

# Seeds stay at /app/seed: a volume mounted at /data would hide anything baked in there. On start the
# server copies missing seed files into /data. setpriv (util-linux, part of Debian slim) drops to "node".
RUN chmod 0755 docker-entrypoint.sh \
 && chown -R root:root /app && chmod -R a+rX /app \
 && mkdir -p /data && chown node:node /data

EXPOSE 8080
ENTRYPOINT ["/app/docker-entrypoint.sh"]
