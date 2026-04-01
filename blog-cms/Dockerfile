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
FROM node:20-bookworm-slim AS runtime

WORKDIR /opt/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /opt/app ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 1337

RUN chown -R node:node /opt/app
USER node

CMD ["npm", "run", "start"]
