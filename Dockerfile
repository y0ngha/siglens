# syntax=docker/dockerfile:1

# ---- builder ----
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
WORKDIR /app
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn
RUN --mount=type=secret,id=SIGLENS_GITHUB_TOKEN \
    SIGLENS_GITHUB_TOKEN="$(cat /run/secrets/SIGLENS_GITHUB_TOKEN)" \
    yarn install --immutable
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_ADSENSE_ENABLED
ARG NEXT_PUBLIC_ADSENSE_PUBLISHER_ID
ARG NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM
ARG NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS
# DATABASE_URL은 빌드 타임 ISR prerender에 필요 (news/[category] 등).
# ARG는 최종 이미지 레이어에 남지 않으므로 ENV보다 안전하다.
# 값은 --build-arg로 주입 (CI/CD에서 secret manager에서 읽어 전달).
ARG DATABASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_ADSENSE_ENABLED=$NEXT_PUBLIC_ADSENSE_ENABLED \
    NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=$NEXT_PUBLIC_ADSENSE_PUBLISHER_ID \
    NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM=$NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM \
    NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS=$NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS \
    DATABASE_URL=$DATABASE_URL
RUN --mount=type=secret,id=SIGLENS_GITHUB_TOKEN \
    SIGLENS_GITHUB_TOKEN="$(cat /run/secrets/SIGLENS_GITHUB_TOKEN)" \
    yarn build
RUN node scripts/assert-standalone-skills.mjs

# ---- runner ----
FROM node:22-alpine AS runner
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/skills ./skills
# sharp는 standalone에 자동 트레이싱되지 않음 → builder에서 명시 복사 (플랫폼 @img 패키지 포함)
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img
# sharp가 standalone에 트레이싱됐는지 빌드타임 검증 (누락 시 빌드 실패)
RUN node -e "require.resolve('sharp')" || (echo 'FAIL: sharp가 standalone에 없음' && exit 1)
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
