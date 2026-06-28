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
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
# ISR_CACHE_BUCKET을 빌드 타임에 노출해야 next.config.ts의 cacheHandler 게이트
# (NODE_ENV==='production' && ISR_CACHE_BUCKET)가 빌드 시 true로 평가되어 핸들러가
# standalone server.js에 baked된다. 런타임 값은 runner가 SSM/--env-file로 별도 주입한다
# (여기서 하드코딩하지 않음 — 비어 있으면 핸들러 미등록 = 파일시스템 폴백).
ARG ISR_CACHE_BUCKET
ENV ISR_CACHE_BUCKET=$ISR_CACHE_BUCKET
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
# GIT_SHA must be re-declared in the runner stage — ARG scope is per-stage in Docker.
# Without this, process.env.GIT_SHA is unset at runtime and cache-handler/config.mjs
# falls back to buildId 'dev', causing every deploy to collide on the same
# siglens-isr/dev/ S3 prefix and breaking per-release cache isolation.
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
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
# ISR 캐시 핸들러 (production .mjs만, 테스트 제외) — standalone에 자동 포함되지 않아 명시 복사.
COPY --chown=node:node --from=builder /app/cache-handler/*.mjs ./cache-handler/
# AWS SDK + 그 의존 top-level 5개 (격리 require 시뮬로 확정: @aws-sdk/client-s3 로드에 필요).
COPY --chown=node:node --from=builder /app/node_modules/@aws-sdk ./node_modules/@aws-sdk
COPY --chown=node:node --from=builder /app/node_modules/@smithy ./node_modules/@smithy
COPY --chown=node:node --from=builder /app/node_modules/@aws-crypto ./node_modules/@aws-crypto
COPY --chown=node:node --from=builder /app/node_modules/@aws ./node_modules/@aws
COPY --chown=node:node --from=builder /app/node_modules/tslib ./node_modules/tslib
# 누락 시 즉시 빌드 실패(런타임 ENOSPC보다 빌드 실패가 낫다).
# require.resolve만으론 엔트리 모듈만 확인한다 — 미래 SDK 업그레이드가 런타임에
# 도달 가능하게 만드는 전이 의존(transitive dep)의 누락은 잡지 못한다. 실제로
# S3Client를 construct하면 의존 트리를 더 깊게 로드해 그런 누락을 빌드에서 잡는다.
RUN node -e "const {S3Client}=require('@aws-sdk/client-s3'); new S3Client({region:'ap-northeast-2'}); console.log('aws-sdk ok')" || (echo 'FAIL: @aws-sdk/client-s3 load/construct' && exit 1)
RUN node -e "require('node:fs').accessSync('./cache-handler/index.mjs')" || (echo 'FAIL: cache-handler 누락' && exit 1)
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
