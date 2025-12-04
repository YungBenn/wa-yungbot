FROM oven/bun:1 AS base
WORKDIR /usr/src/app

FROM base AS install
# Skip Puppeteer's Chromium download - we'll use system Chromium instead
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
WORKDIR /temp/dev
RUN bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
WORKDIR /temp/prod
RUN bun install --frozen-lockfile --production

FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

FROM base AS release

# Install Chromium and dependencies from apt
USER root
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer/whatsapp-web.js to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/index.ts .
COPY --from=prerelease /usr/src/app/package.json .

RUN mkdir -p .wwebjs_auth backups

VOLUME ["/usr/src/app/.wwebjs_auth", "/usr/src/app/backups"]

ENV NODE_ENV=production

# Change ownership of work directory before switching to bun user
RUN chown -R bun:bun /usr/src/app

USER bun
ENTRYPOINT [ "bun", "run", "index.ts" ]