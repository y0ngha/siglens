#!/usr/bin/env bash
# 배포 직후 Cloudflare 엣지 캐시를 퍼지한다 — 켜져 있으면 **HTML 태그만**.
#
# 예전 배포는 `purge_everything`이었다. 그러면 콘텐츠 해시가 붙어 바뀔 일이 없는
# `/_next/static/*`, 최적화 이미지, 30일 revalidate OG 이미지까지 배포(하루 3~4회)마다
# 엣지에서 쫓겨나 오리진으로 돌아왔다(2026-10 비용 감사). 이제 오리진이 응답마다
# `Cache-Tag`를 달고(`src/shared/config/cdnCacheTags.ts`), 여기서는 배포마다 바뀌는
# 부류(`siglens-html`)만 지운다.
#
# 기본은 여전히 `purge_everything`이다 — 태그 퍼지는 저장소 변수 `CF_TAG_PURGE_ENABLED=true`로
# 켠다. 태그 헤더가 붙기 전에 캐시된 엔트리에는 태그가 없어 태그 퍼지로 지워지지 않으므로,
# `Cache-Tag`를 내보내는 첫 릴리스가 통째로 비운 뒤에야 태그 퍼지가 안전하다. 기본값을 안전한
# 쪽에 두어 "첫 배포 때 무언가를 기억해야 하는" 절차를 없앴다.
#
# 안전망: 태그 퍼지 API 호출이 실패하면 `purge_everything`으로 떨어지고 그 사실을 남긴다.
# 옛 HTML이 남아 옛 청크를 가리키는 것보다 한 번 통째로 비우는 편이 낫다.
#
# 사용법: scripts/purge-cdn-cache.sh [tag ...]
#   인자 없음 — 배포 모드. CF_TAG_PURGE_ENABLED=true면 siglens-html 태그만, 아니면 통째로.
#   인자 있음 — 운영자가 고른 태그만 퍼지한다(예: siglens-og). 변수와 무관하다.
#   env: CF_API_TOKEN (Zone → Cache Purge 권한), CF_ZONE_ID, CF_TAG_PURGE_ENABLED
# 종료 코드: 태그 퍼지나 폴백 중 하나라도 성공하면 0, 둘 다 실패하면 1.
set -uo pipefail

# src/shared/config/cdnCacheTags.ts `DEPLOY_PURGE_TAGS`와 같아야 한다(scripts/__tests__가 대조).
readonly DEFAULT_PURGE_TAGS='siglens-html'
readonly CF_API='https://api.cloudflare.com/client/v4'
# 퍼지 한 번이 배포 잡을 오래 잡지 않게 경계를 둔다.
readonly CURL_MAX_TIME=30

log() { printf '[purge-cdn] %s\n' "$*"; }
# GitHub Actions 주석으로도 남겨 폴백이 요약 화면에서 보이게 한다(로컬에서는 그냥 한 줄).
warn() { printf '::warning::[purge-cdn] %s\n' "$*"; }

if [ -z "${CF_API_TOKEN:-}" ] || [ -z "${CF_ZONE_ID:-}" ]; then
    warn 'CF_API_TOKEN / CF_ZONE_ID가 없다 — 퍼지하지 못했다'
    exit 1
fi

# $1: JSON 본문. 성공이면 0. 응답은 그대로 남긴다(실패 원인 확인용).
purge() {
    local body="$1" resp
    resp=$(curl -sS --max-time "$CURL_MAX_TIME" -X POST \
        "${CF_API}/zones/${CF_ZONE_ID}/purge_cache" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H 'Content-Type: application/json' \
        --data "$body")
    local rc=$?
    log "request: $body"
    log "response: ${resp:-<empty>} (curl exit $rc)"
    [ "$rc" -eq 0 ] && printf '%s' "$resp" | grep -q '"success":[[:space:]]*true'
}

purge_everything() {
    if purge '{"purge_everything":true}'; then
        log '✅ purge_everything 완료'
        return 0
    fi
    warn 'purge_everything도 실패했다 — CF_API_TOKEN(Zone:Cache Purge)과 CF_ZONE_ID를 확인할 것'
    return 1
}

if [ "$#" -gt 0 ]; then
    tags=("$@")
elif [ "${CF_TAG_PURGE_ENABLED:-}" = 'true' ]; then
    tags=("$DEFAULT_PURGE_TAGS")
else
    log 'CF_TAG_PURGE_ENABLED가 true가 아니다 — 통째로 비운다(Cache-Tag 첫 배포 뒤 켤 것)'
    purge_everything
    exit $?
fi

# 태그는 JSON에 그대로 들어가므로 따옴표·공백이 섞이면 본문이 깨진다. 우리 태그는 영숫자와
# `-`뿐이라 그 밖의 값은 호출 실수로 보고 통째로 비우는 쪽으로 간다.
json_tags=''
for tag in "${tags[@]}"; do
    if ! [[ "$tag" =~ ^[A-Za-z0-9._:-]+$ ]]; then
        warn "허용하지 않는 태그 '$tag' — purge_everything으로 폴백한다"
        purge_everything
        exit $?
    fi
    json_tags+="${json_tags:+,}\"${tag}\""
done

if purge "{\"tags\":[${json_tags}]}"; then
    log "✅ 태그 퍼지 완료: ${tags[*]}"
    exit 0
fi

warn "태그 퍼지 실패(${tags[*]}) — purge_everything으로 폴백한다"
purge_everything
