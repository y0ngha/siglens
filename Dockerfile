# syntax=docker/dockerfile:1

# ---- builder ----
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
WORKDIR /app
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn
RUN --mount=type=secret,id=SIGLENS_GITHUB_TOKEN,required=true \
    SIGLENS_GITHUB_TOKEN="$(cat /run/secrets/SIGLENS_GITHUB_TOKEN)" \
    yarn install --immutable
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_ADSENSE_ENABLED
ARG NEXT_PUBLIC_ADSENSE_PUBLISHER_ID
ARG NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM
ARG NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_ADSENSE_ENABLED=$NEXT_PUBLIC_ADSENSE_ENABLED \
    NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=$NEXT_PUBLIC_ADSENSE_PUBLISHER_ID \
    NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM=$NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM \
    NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS=$NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS
# 빌드 타임 ISR prerender에 필요한 자격증명. secret mount로 주입해 빌드 로그·이미지
# 레이어에 자격증명이 남지 않게 한다.
#   - DATABASE_URL: news/[category]·legal 등 DB-backed prerender
#   - FMP_API_KEY: /economy(거시경제 지표/treasury)·/market(지수·섹터 quote) prerender.
#     없으면 빌드타임 FMP fetch가 실패해 EconomyDegraded/빈 패널이 이미지에 baked되고,
#     ISR revalidate(24h)까지 degraded 페이지가 서빙된다. (런타임 SSM에는 이미 존재)
RUN --mount=type=secret,id=SIGLENS_GITHUB_TOKEN,required=true \
    --mount=type=secret,id=DATABASE_URL,required=true \
    --mount=type=secret,id=FMP_API_KEY,required=true \
    SIGLENS_GITHUB_TOKEN="$(cat /run/secrets/SIGLENS_GITHUB_TOKEN)" \
    DATABASE_URL="$(cat /run/secrets/DATABASE_URL)" \
    FMP_API_KEY="$(cat /run/secrets/FMP_API_KEY)" \
    yarn build
RUN node scripts/assert-standalone-skills.mjs

# ---- runner ----
FROM node:22-alpine AS runner
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public
# sharp는 standalone에 자동 트레이싱되지 않음 → builder에서 명시 복사 (플랫폼 @img 패키지 포함)
COPY --chown=node:node --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --chown=node:node --from=builder /app/node_modules/@img ./node_modules/@img
# sharp explicit COPY가 성공했는지 확인 (require.resolve 실패 = COPY 누락)
RUN node -e "require.resolve('sharp')" || (echo 'FAIL: sharp가 node_modules에 없음' && exit 1)
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
