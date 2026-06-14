# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV CI=true \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    TRUTH_HARNESS_CONTAINER=1 \
    TRUTH_HARNESS_MAXIMA=maxima-sage \
    TRUTH_HARNESS_Z3=z3 \
    PATH="/opt/truth-harness-python/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates maxima-sage maxima-sage-share python3 python3-pip python3-venv tini z3 \
  && python3 -m venv /opt/truth-harness-python \
  && /opt/truth-harness-python/bin/python -m pip install sympy==1.14.0 \
  && useradd --create-home --uid 10001 truth \
  && mkdir -p /workspace \
  && chown -R truth:truth /workspace /home/truth \
  && rm -rf /var/lib/apt/lists/*

USER truth
WORKDIR /workspace

COPY --chown=truth:truth package.json package-lock.json ./
COPY --chown=truth:truth apps/cli/package.json apps/cli/package.json
COPY --chown=truth:truth packages/benchmarks/package.json packages/benchmarks/package.json
COPY --chown=truth:truth packages/core/package.json packages/core/package.json
COPY --chown=truth:truth packages/mcp-server/package.json packages/mcp-server/package.json
RUN npm ci

COPY --chown=truth:truth . .
RUN npm run build

FROM base AS dev

ENTRYPOINT ["tini", "--"]
CMD ["npm", "run", "check"]

FROM dev AS verify

RUN npm run check && npm run proof:launch:engines

FROM dev AS lean-proof

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl git xz-utils \
  && rm -rf /var/lib/apt/lists/*

USER truth
ENV ELAN_HOME="/home/truth/.elan" \
    PATH="/home/truth/.elan/bin:${PATH}" \
    TRUTH_HARNESS_LEAN=lean

RUN curl -fsSL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh \
  | sh -s -- -y --default-toolchain leanprover/lean4:v4.12.0 \
  && elan toolchain install leanprover/lean4:v4.12.0 \
  && lean --version

RUN npm run proof:lean-fixture

CMD ["npm", "run", "proof:lean-fixture"]
