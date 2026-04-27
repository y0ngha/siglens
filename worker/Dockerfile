# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
WORKDIR /app
COPY .yarnrc.yml package.json yarn.lock ./
RUN --mount=type=secret,id=SIGLENS_GITHUB_TOKEN \
    SIGLENS_GITHUB_TOKEN="$(cat /run/secrets/SIGLENS_GITHUB_TOKEN)" yarn install
COPY tsconfig.json ./
COPY src/ ./src/
RUN --mount=type=secret,id=SIGLENS_GITHUB_TOKEN \
    SIGLENS_GITHUB_TOKEN="$(cat /run/secrets/SIGLENS_GITHUB_TOKEN)" yarn exec tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
