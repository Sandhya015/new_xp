# Strapi 5 production image (Render, Fly, etc.)
# Build context: this directory (blog-cms). On Render, set Root Directory to `blog-cms`.

FROM node:20-bookworm-slim AS build

WORKDIR /opt/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Optional: set on Render (Docker → Build-time env) to your public HTTPS URL so the admin UI calls the right API.
# Example: https://your-strapi.onrender.com
ARG STRAPI_ADMIN_BACKEND_URL=
ENV STRAPI_ADMIN_BACKEND_URL=${STRAPI_ADMIN_BACKEND_URL}

ENV NODE_ENV=production
RUN npm run build && npm prune --omit=dev

# --- runtime
# Render: attach a persistent disk at /opt/app/public/uploads so uploads survive deploys (see .env.example).
FROM node:20-bookworm-slim AS runtime

WORKDIR /opt/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

# Own files as we copy — avoids `chown -R` over node_modules (very slow / looks stuck on many hosts).
COPY --chown=node:node --from=build /opt/app ./

COPY --chown=node:node scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p public/uploads && chown node:node public/uploads

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 1337

USER node

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
