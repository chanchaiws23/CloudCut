# Backend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV FFMPEG_PATH=/usr/bin/ffmpeg

RUN apk add --no-cache libc6-compat openssl fontconfig ttf-dejavu ffmpeg

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "scripts/docker-entrypoint.sh"]
