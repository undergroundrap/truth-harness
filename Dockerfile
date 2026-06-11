# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV CI=true \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/theorem-python/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 python3-pip python3-venv tini \
  && python3 -m venv /opt/theorem-python \
  && /opt/theorem-python/bin/python -m pip install sympy==1.14.0 \
  && useradd --create-home --uid 10001 theorem \
  && mkdir -p /workspace \
  && chown -R theorem:theorem /workspace /home/theorem \
  && rm -rf /var/lib/apt/lists/*

USER theorem
WORKDIR /workspace

COPY --chown=theorem:theorem package.json package-lock.json ./
COPY --chown=theorem:theorem apps/cli/package.json apps/cli/package.json
COPY --chown=theorem:theorem packages/benchmarks/package.json packages/benchmarks/package.json
COPY --chown=theorem:theorem packages/core/package.json packages/core/package.json
COPY --chown=theorem:theorem packages/mcp-server/package.json packages/mcp-server/package.json
RUN npm ci

COPY --chown=theorem:theorem . .
RUN npm run build

FROM base AS dev

ENTRYPOINT ["tini", "--"]
CMD ["npm", "run", "check"]

FROM dev AS verify

RUN npm run check && npm run proof:launch
