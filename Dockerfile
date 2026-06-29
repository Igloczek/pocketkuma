ARG BUN_IMAGE=oven/bun:1.2.17-debian

############################################
# Build healthcheck
############################################
FROM golang:1.23-bookworm AS build_healthcheck
WORKDIR /app
COPY ./extra/healthcheck.go ./extra/healthcheck.go
RUN go build -o /app/extra/healthcheck ./extra/healthcheck.go

############################################
# Build in Bun
############################################
FROM ${BUN_IMAGE} AS build
WORKDIR /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
COPY --from=build_healthcheck /app/extra/healthcheck /app/extra/healthcheck
RUN bun run build
RUN mkdir ./data

############################################
# Runtime image
############################################
FROM ${BUN_IMAGE} AS release
WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/igloczek/uptime-buna"

ENV UPTIME_KUMA_IS_CONTAINER=1
ENV NODE_ENV=production

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
COPY --from=build /app/extra/healthcheck ./extra/healthcheck
COPY --from=build /app/extra/push-examples ./extra/push-examples
COPY --from=build /app/extra/rdap-dns.json ./extra/rdap-dns.json
COPY --from=build /app/src ./src
RUN mkdir ./data

EXPOSE 3001
HEALTHCHECK --interval=60s --timeout=30s --start-period=180s --retries=5 CMD extra/healthcheck
ENTRYPOINT ["bun"]
CMD ["src/server/server.ts"]
