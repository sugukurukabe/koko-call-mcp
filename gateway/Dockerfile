FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
COPY config ./config

RUN npm run build

FROM node:24-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

EXPOSE 8090

USER node

CMD ["node", "dist/server.js"]
