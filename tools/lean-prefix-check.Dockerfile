FROM node:22-bookworm-slim AS toolchain

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl zstd \
 && rm -rf /var/lib/apt/lists/*

# The official Linux x86-64 release archive, verified before extracting.
RUN curl --fail --silent --show-error --location --retry 3 \
      https://github.com/leanprover/lean4/releases/download/v4.36.0/lean-4.36.0-linux.tar.zst \
      --output /tmp/lean.tar.zst \
 && echo '2b7ab1ed8b92d2e6abfaf41344823b510064dbc9c0260cac73eb496ab2dea6eb  /tmp/lean.tar.zst' | sha256sum -c - \
 && mkdir /opt/lean \
 && tar --zstd --extract --file=/tmp/lean.tar.zst --directory=/opt/lean --strip-components=1 \
 && rm /tmp/lean.tar.zst \
 && /opt/lean/bin/lean --version \
 && test -x /opt/lean/bin/nanoda_bin

FROM toolchain AS pilot
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*
COPY docs/examples/lean-prefix-check/Challenge.lean \
     docs/examples/lean-prefix-check/Solution.lean \
     docs/examples/lean-prefix-check/DifferentStatement.lean \
     docs/examples/lean-prefix-check/Unfinished.lean \
     docs/examples/lean-prefix-check/lakefile.toml /opt/prefix-proof/
COPY docs/examples/lean-bfs-check/BfsModel.lean \
     docs/examples/lean-bfs-check/Challenge.lean \
     docs/examples/lean-bfs-check/Solution.lean \
     docs/examples/lean-bfs-check/DifferentStatement.lean \
     docs/examples/lean-bfs-check/lakefile.toml /opt/bfs-proof/
COPY tools/lean-prefix-check.mjs /opt/prefix-proof/verify.mjs
ENV PATH="/opt/lean/bin:${PATH}" LEAN_NUM_THREADS=2
USER node
WORKDIR /opt/prefix-proof
ENTRYPOINT ["node", "/opt/prefix-proof/verify.mjs"]
