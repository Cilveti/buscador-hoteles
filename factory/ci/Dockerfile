# Tools are prepared without source or secrets. Refresh pins deliberately and rerun the baseline.
FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS bun
FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY postgresql.asc /etc/apt/keyrings/postgresql.asc
# PGDG supplies the same server version as the application's compose file on Ubuntu noble.
RUN printf 'deb [signed-by=/etc/apt/keyrings/postgresql.asc] https://apt.postgresql.org/pub/repos/apt noble-pgdg main\n' > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      postgresql-17=17.11-1.pgdg24.04+2 postgresql-client-17=17.11-1.pgdg24.04+2 \
    && rm -rf /var/lib/apt/lists/*
ENV CI=true NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /work
