# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
# Alpine's base image has no libssl; without it Prisma can't detect the OpenSSL
# version at generate time and silently defaults to a mismatched engine binary.
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# The query engine dlopen's libssl at runtime too, not just at generate time.
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
# Only used by the Render hosted deployment (render.yaml); irrelevant to local/Docker
# Compose, which overrides CMD with its own command.
COPY docker-entrypoint-hosted.sh ./
RUN chmod +x ./docker-entrypoint-hosted.sh

EXPOSE 4000
CMD ["node", "dist/server.js"]
