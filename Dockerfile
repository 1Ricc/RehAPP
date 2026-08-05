# One image: the API and the built SPA served by the same Node process.
#
# The hackathon git remote is self-hosted, and most hosts only auto-deploy from
# GitHub. A container sidesteps that entirely — `fly deploy` and `railway up`
# push this from the laptop, no git host in the loop.

# ---- stage 1: build the SPA ------------------------------------------------
FROM node:22-bookworm-slim AS frontend

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- stage 2: runtime ------------------------------------------------------
FROM node:22-bookworm-slim

# better-sqlite3 ships prebuilt binaries, but falls back to node-gyp when none
# matches the runtime. Without a toolchain that fallback fails at install time.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json backend/
RUN cd backend && npm ci --omit=dev

COPY backend/ backend/
COPY package.json ./
COPY --from=frontend /app/frontend/dist frontend/dist

ENV NODE_ENV=production
ENV PORT=8080
# Writable state lives outside the image, so a redeploy does not ship a
# half-played demo and a restart starts clean.
ENV REHUB_DATA_DIR=/data
# The day closes at 02:00 local (ORA_CHIUSURA_GIORNATA). Hosts run UTC, which
# would put "today" two hours off the demo that was rehearsed.
ENV TZ=Europe/Rome

EXPOSE 8080
CMD ["npm", "start"]
