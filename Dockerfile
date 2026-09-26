# AutoSmokeGuard frontend — build the Vite/React SPA, serve it with nginx.
#
# VITE_API_BASE_URL is a *build* argument, not a runtime env var: Vite inlines
# `import.meta.env.VITE_*` values into the JS bundle at build time (see
# src/lib/api.js — `API_BASE = import.meta.env.VITE_API_BASE_URL || ''`), so
# there is nothing left to configure once the container is running. Leave it
# empty (the default) and the SPA calls relative `/api` and `/media` paths,
# which docker/nginx.conf then reverse-proxies to the "backend" compose
# service — that is the setup docker-compose.yml uses. Only pass a real
# absolute URL here if the built SPA will be served from a different
# origin/domain than the API it talks to.

# =============================================================================
# Stage 1: build
# =============================================================================
FROM node:22-alpine AS build

WORKDIR /app

# package.json + lockfile copied (and installed) before source so this layer
# is cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# =============================================================================
# Stage 2: serve
# =============================================================================
FROM nginx:alpine AS runtime

# Replace the stock default server block entirely so it can't shadow/conflict
# with our SPA + proxy config.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Pre-create /media owned by uid 1000 — the same uid backend/Dockerfile's
# non-root `appuser` runs as. docker-compose.yml mounts the shared
# `backend-media` volume here (read-only) AND into the backend container;
# Docker initializes a fresh named volume's ownership from whichever
# container's image directory attaches to it FIRST, and that's a race this
# image has no control over (depends_on only orders container starts, not
# which one's volume attachment wins). Giving nginx's own copy of that path
# the same uid backend needs write access as means the volume ends up
# correctly owned no matter which container wins the race — nginx itself
# only ever needs read access, which the trailing "other" bits of 755 still
# grant to whatever uid its worker processes actually run as.
RUN mkdir -p /media && chown 1000:1000 /media

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
