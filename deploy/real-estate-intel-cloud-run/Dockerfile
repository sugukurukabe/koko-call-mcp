# 世界最速クラス起動向け最小イメージ（node:24-alpine）
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-optional --no-audit --no-fund --prefer-offline

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 8080
USER node

# メモリを抑えてコールドスタートを最速化（256MB でも十分動く設計）
ENV NODE_OPTIONS="--max-old-space-size=256"

CMD ["npm", "start"]