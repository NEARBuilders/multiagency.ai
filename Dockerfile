# syntax=docker/dockerfile:1.7

FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile --ignore-scripts

# UI/API load remotely at runtime; drop source + now-dangling workspace links
RUN rm -rf api ui plugins && \
    find node_modules -maxdepth 1 -type l ! -exec test -e {} \; -delete 2>/dev/null || true
RUN node -e "const p=require('./package.json');p.workspaces.packages=p.workspaces.packages.filter(e=>!['api','ui'].includes(e)&&e!=='plugins/*');require('fs').writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"

# ── Runtime ──
FROM oven/bun:1-alpine
WORKDIR /app

RUN apk add --no-cache curl

RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001

COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/bos.config.json .
COPY --from=builder --chown=appuser:appgroup /app/package.json .
COPY --from=builder --chown=appuser:appgroup /app/bun.lock .
COPY --from=builder --chown=appuser:appgroup /app/bunfig.toml .

RUN mkdir -p .bos/generated .bos/logs && \
    chown -R appuser:appgroup .bos && \
    chown appuser:appgroup /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

USER appuser
CMD ["sh", "-c", "bun run start"]
