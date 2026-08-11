#!/usr/bin/env bash
# 배포 전 env 완전성 검증(M5).
#
# .env.example의 모든 필수 키가 SSM /siglens/* 에 존재하는지 확인한다. 하나라도
# 빠지면 누락 키를 나열하고 비정상 종료해 배포를 막는다. 런타임 컨테이너가 키
# 누락으로 부팅 실패/기능 불능에 빠지는 것을 롤 이전에 차단한다.
#
# 제외 대상:
#   - NEXT_PUBLIC_* : 빌드 타임에 이미지로 인라인됨(런타임 SSM env 아님)
#   - SIGLENS_GITHUB_TOKEN : 빌드 타임 전용(패키지 설치). 04-params.sh도 동일 제외.
#   - 주석/빈 줄
# 04-params.sh의 EXCLUDE 규칙과 정합한다.
set -euo pipefail
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
require aws

# .env.example 위치: repo 루트(infra/aws에서 두 단계 위).
ENV_EXAMPLE="${1:-$(dirname "$0")/../../.env.example}"
[ -f "$ENV_EXAMPLE" ] || { log "ERROR: .env.example not found at $ENV_EXAMPLE"; exit 1; }

EXCLUDE='^(NEXT_PUBLIC_|SIGLENS_GITHUB_TOKEN)'

# Optional keys: present in .env.example but intentionally absent from SSM in production.
#
# ANTHROPIC_CHAT_API_KEY / OPENAI_CHAT_API_KEY used to sit in this list, on the premise
# that they were BYOK-only and deliberately unprovisioned. That premise was wrong: both
# have existed in /siglens/* since 2026-06-29, holding the same values as their
# analysis-side counterparts. They are server-paid keys like GEMINI_CHAT_API_KEY and
# DEEPSEEK_CHAT_API_KEY — `getServerPrimaryKey` in
# src/entities/chat-message/actions/chatAction.ts reads them for every chat request whose
# model routes to that provider, including the free-tier models claude-haiku-4-5 and
# gpt-5-mini. Listing them as optional meant this gate would wave through a deploy that
# had silently lost them, breaking Claude/ChatGPT chat for every non-BYOK caller. All four
# *_CHAT_API_KEY are REQUIRED.
#
# DEBUG_VERBOSE_LOGS is an optional debug flag (defaults off when unset); it is never
# provisioned in prod SSM and must likewise not block deploy.
#
# The *_API_KEY (no CHAT) quartet is REQUIRED for the same class of reason:
# ANTHROPIC/GEMINI/OPENAI/DEEPSEEK_API_KEY are the analysis-side server keys read by
# @y0ngha/siglens-core's resolveServerApiKey, and every one of the four providers appears
# in TIER_CONFIG.models.free (claude-haiku-4-5 -> Anthropic, gpt-5-mini -> OpenAI,
# gemini-2.5-flash* -> Gemini, deepseek-v4-* -> DeepSeek), i.e. the server pays for all
# four. Core validates them lazily at call time, so a missing key does not crash startup —
# it fails the first analysis that routes to that provider, over SSE, with HTTP 200. That
# is exactly the silent failure this gate exists to catch.
OPTIONAL_KEYS=(
  DEBUG_VERBOSE_LOGS
  # Optional SNS email subscription address for ISR cache alarms. The SNS topic
  # and CloudWatch alarm wiring (07-alarms.sh) are created regardless; only the
  # email subscription is skipped when this is absent. Never block deploy for it.
  ALARM_EMAIL
)

# 필수 키 수집: KEY=... 형태 라인에서 KEY만 추출(주석/빈 줄 스킵, EXCLUDE 제외).
REQUIRED_KEYS=()
while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*# || -z "${line// }" ]] && continue
  [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*= ]] || continue
  key="${BASH_REMATCH[1]}"
  [[ "$key" =~ $EXCLUDE ]] && continue
  REQUIRED_KEYS+=("$key")
done < "$ENV_EXAMPLE"

[ "${#REQUIRED_KEYS[@]}" -gt 0 ] || { log "ERROR: no required keys parsed from $ENV_EXAMPLE"; exit 1; }

# SSM /siglens/* 에 실제 존재하는 키 집합을 한 번에 가져온다(/siglens/ 접두 제거).
# get-parameters-by-path는 --max-items 미지정 시 자동 페이지네이션(전수 반환).
EXISTING=$(aws ssm get-parameters-by-path --path /siglens/ --recursive \
  --output json \
  | jq -r '.Parameters[].Name | ltrimstr("/siglens/")')

is_optional() {
  local k="$1"
  for opt in "${OPTIONAL_KEYS[@]}"; do
    [ "$k" = "$opt" ] && return 0
  done
  return 1
}

MISSING=()
for key in "${REQUIRED_KEYS[@]}"; do
  if ! grep -qxF "$key" <<<"$EXISTING"; then
    if is_optional "$key"; then
      log "WARN: optional key $key not in SSM — skipping (BYOK provider, not required for prod)"
    else
      MISSING+=("$key")
    fi
  fi
done

if [ "${#MISSING[@]}" -gt 0 ]; then
  log "ERROR: ${#MISSING[@]} required env key(s) missing from SSM /siglens/*:"
  for key in "${MISSING[@]}"; do log "  - $key"; done
  log "Load them first (e.g. infra/aws/04-params.sh <env-file>) before deploying."
  exit 1
fi

log "env completeness OK — all required keys present in SSM /siglens/*"
