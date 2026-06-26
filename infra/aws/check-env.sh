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

MISSING=()
for key in "${REQUIRED_KEYS[@]}"; do
  grep -qxF "$key" <<<"$EXISTING" || MISSING+=("$key")
done

if [ "${#MISSING[@]}" -gt 0 ]; then
  log "ERROR: ${#MISSING[@]} required env key(s) missing from SSM /siglens/*:"
  for key in "${MISSING[@]}"; do log "  - $key"; done
  log "Load them first (e.g. infra/aws/04-params.sh <env-file>) before deploying."
  exit 1
fi

log "env completeness OK — all ${#REQUIRED_KEYS[@]} required keys present in SSM /siglens/*"
