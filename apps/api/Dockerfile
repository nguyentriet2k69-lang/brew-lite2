FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN groupadd --system --gid 1001 brewlite \
  && useradd --system --uid 1001 --gid brewlite brewlite
COPY --from=build --chown=1001:1001 /app/dist ./dist
USER brewlite
EXPOSE 3001
CMD ["node", "dist/main.js"]
