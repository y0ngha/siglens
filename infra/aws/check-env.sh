#!/usr/bin/env bash
# 배포 전 env 완전성 검증(M5).
#
# infra/aws/env-gate.txt(필수·선택 SSM 키 목록)의 모든 필수 키가 SSM /siglens/* 에 존재하는지
# 확인한다. 하나라도 빠지면 누락 키를 나열하고 비정상 종료해 배포를 막는다. 런타임 컨테이너가
# 키 누락으로 부팅 실패/기능 불능에 빠지는 것을 롤 이전에 차단한다. 선택 키가 없으면 경고 한 줄만
# 남기고 통과한다(코드가 기본값으로 동작하는 키).
#
# env-gate.txt는 src/shared/config/envRegistry.ts에서 `yarn env:gate`로 생성한 파일이다(직접
# 고치지 않는다). 배포 잡에는 Node 도구가 없어서 레지스트리를 읽지 않고 커밋된 텍스트를 읽는다.
# 형식: `required KEY` / `optional KEY` / `override KEY` 한 줄씩, `#` 주석과 빈 줄은 무시한다.
#   required : 없으면 배포를 막는다.
#   optional : 기능 키. 없으면 경고 한 줄(기능이 꺼진다).
#   override : 없는 것이 정상(킬 스위치·튜닝·기본값 덮어쓰기). 없다고 경고하지 않고, SSM에 있으면 이름만 알린다.
#
# 키마다 왜 필수/선택인지는 레지스트리의 note와 주석에 있다. 빌드 타임 키(NEXT_PUBLIC_*,
# SIGLENS_GITHUB_TOKEN 등)는 SSM으로 받지 않으므로 목록에 없다.
set -euo pipefail
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
require aws

# 게이트 목록 위치: 이 스크립트 옆. 첫 인자로 덮어쓸 수 있다(테스트용).
ENV_GATE="${1:-$(dirname "$0")/env-gate.txt}"
[ -f "$ENV_GATE" ] || { log "ERROR: env gate list not found at $ENV_GATE (generate it: yarn env:gate)"; exit 1; }

REQUIRED_KEYS=()
OPTIONAL_KEYS=()
OVERRIDE_KEYS=()
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[[:space:]]*# || -z "${line// }" ]] && continue
  if [[ "$line" =~ ^[[:space:]]*(required|optional|override)[[:space:]]+([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*$ ]]; then
    case "${BASH_REMATCH[1]}" in
      required) REQUIRED_KEYS+=("${BASH_REMATCH[2]}") ;;
      optional) OPTIONAL_KEYS+=("${BASH_REMATCH[2]}") ;;
      override) OVERRIDE_KEYS+=("${BASH_REMATCH[2]}") ;;
    esac
  else
    log "ERROR: unparseable line in $ENV_GATE: $line"
    exit 1
  fi
done < "$ENV_GATE"

[ "${#REQUIRED_KEYS[@]}" -gt 0 ] || { log "ERROR: no required keys parsed from $ENV_GATE"; exit 1; }

# SSM /siglens/* 에 실제 존재하는 키 집합을 한 번에 가져온다(/siglens/ 접두 제거).
# get-parameters-by-path는 --max-items 미지정 시 자동 페이지네이션(전수 반환).
EXISTING=$(aws ssm get-parameters-by-path --path /siglens/ --recursive \
  --output json \
  | jq -r '.Parameters[].Name | ltrimstr("/siglens/")')

# 마이그레이션 게이트 우회가 SSM에 남아 있으면 알린다(값은 읽지 않는다). report/off는 비상용이라
# 배포가 통과한 뒤 지우지 않으면 게이트가 조용히 꺼진 채로 남는다. 위에서 이미 받은 목록만 쓴다.
if grep -qxF "MIGRATION_GATE" <<<"$EXISTING"; then
  log "WARN: SSM /siglens/MIGRATION_GATE is set — the migration gate may be overridden (report/off). Delete it once the deploy is clean: aws ssm delete-parameter --name /siglens/MIGRATION_GATE"
fi

MISSING=()
for key in "${REQUIRED_KEYS[@]}"; do
  grep -qxF "$key" <<<"$EXISTING" || MISSING+=("$key")
done

MISSING_OPTIONAL=()
# 선택 키가 하나도 없으면 배열이 비어 있어 `set -u` 아래에서 "${arr[@]}"가 터지는 bash 버전이 있다.
if [ "${#OPTIONAL_KEYS[@]}" -gt 0 ]; then
  for key in "${OPTIONAL_KEYS[@]}"; do
    grep -qxF "$key" <<<"$EXISTING" || MISSING_OPTIONAL+=("$key")
  done
fi

# override 키는 없는 것이 정상이라 빠졌다고 알리지 않는다. 거꾸로 **SSM에 있으면** 누군가 일부러
# 켜 둔 값(킬 스위치, 튜닝, 우회)이므로 이름만 한 줄로 알린다(값은 읽지 않는다). MIGRATION_GATE는
# 위에서 따로 안내했으니 여기서 빼 중복을 피한다.
SET_OVERRIDES=()
if [ "${#OVERRIDE_KEYS[@]}" -gt 0 ]; then
  for key in "${OVERRIDE_KEYS[@]}"; do
    [ "$key" = "MIGRATION_GATE" ] && continue
    ! grep -qxF "$key" <<<"$EXISTING" || SET_OVERRIDES+=("$key")
  done
fi

if [ "${#MISSING[@]}" -gt 0 ]; then
  log "ERROR: ${#MISSING[@]} required env key(s) missing from SSM /siglens/*:"
  for key in "${MISSING[@]}"; do log "  - $key"; done
  log "Load them first (e.g. infra/aws/04-params.sh <env-file>) before deploying."
  exit 1
fi

if [ "${#MISSING_OPTIONAL[@]}" -gt 0 ]; then
  log "WARN: ${#MISSING_OPTIONAL[@]} optional keys absent from SSM: ${MISSING_OPTIONAL[*]}"
fi

if [ "${#SET_OVERRIDES[@]}" -gt 0 ]; then
  log "WARN: ${#SET_OVERRIDES[@]} override key(s) set in SSM: ${SET_OVERRIDES[*]}"
fi

log "env completeness OK — all required keys present in SSM /siglens/*"
