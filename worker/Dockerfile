FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
WORKDIR /app
COPY .yarnrc.yml package.json yarn.lock ./
RUN yarn install
COPY tsconfig.json ./
COPY src/ ./src/
RUN yarn exec tsc

FROM node:20-alpine
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
WORKDIR /app
COPY --from=builder /app/.yarnrc.yml /app/package.json /app/yarn.lock ./
COPY --from=builder /app/.pnp.cjs /app/.pnp.loader.mjs ./
COPY --from=builder /app/.yarn ./.yarn
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["yarn", "node", "dist/index.js"]
