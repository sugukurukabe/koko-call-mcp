FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY server.js ./

EXPOSE 8080

USER node

CMD ["npm", "start"]
