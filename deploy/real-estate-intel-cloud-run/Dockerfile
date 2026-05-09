# Real Estate Intel MCP 本体リポジトリを直接ビルドする Cloud Run イメージ
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts --no-audit --no-fund --package-lock=false --prefer-offline
COPY tsconfig.json ./
COPY src ./src
COPY ui ./ui
RUN npm run build:server

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund --package-lock=false --prefer-offline
COPY --from=build /app/dist ./dist
COPY --from=build /app/ui ./ui

EXPOSE 8080
USER node

# メモリを抑えてコールドスタートを最速化（256MB でも十分動く設計）
ENV NODE_OPTIONS="--max-old-space-size=256"

CMD ["npm", "run", "start:http"]