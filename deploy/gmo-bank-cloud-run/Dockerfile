# 高速起動向け最小イメージ（node:24-alpine） — private connector 用
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund --package-lock=false --prefer-offline

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./

EXPOSE 8080
USER node

# メモリを抑えてコールドスタートを高速化
ENV NODE_OPTIONS="--max-old-space-size=256"

CMD ["npm", "start"]
