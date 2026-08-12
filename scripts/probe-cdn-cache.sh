#!/usr/bin/env bash
# Cloudflare 엣지 캐시 실측 프로브.
#
# 요청 클래스별로 같은 URL을 두 번 GET해 `cf-cache-status`가 MISS → HIT으로
# 넘어가는지 본다. 두 번째가 HIT이면 그 클래스는 "캐시 가능", DYNAMIC/BYPASS면
# 엣지를 우회하는 것이다 (룰 매칭 실패 또는 의도된 우회).
#
# ⚠️ HEAD(-I)로 재면 CF는 항상 DYNAMIC을 돌려준다. 반드시 GET(-o /dev/null)으로 잰다.
#
# 사용법: scripts/probe-cdn-cache.sh [origin]   (기본 https://siglens.io)
set -euo pipefail

ORIGIN="${1:-https://siglens.io}"
UA='Mozilla/5.0 (probe-cdn-cache)'

probe() {
    local label="$1" url="$2"
    shift 2
    local first second
    first=$(curl -s -o /dev/null -D - "$url" -H "user-agent: $UA" "$@" |
        awk 'BEGIN{IGNORECASE=1} /^cf-cache-status:/{print $2}' | tr -d '\r')
    second=$(curl -s -o /dev/null -D - "$url" -H "user-agent: $UA" "$@" |
        awk 'BEGIN{IGNORECASE=1} /^cf-cache-status:/{print $2}' | tr -d '\r')
    printf '%-28s %-10s %-10s %s\n' "$label" "${first:-none}" "${second:-none}" "$url"
}

printf '%-28s %-10s %-10s %s\n' 'CLASS' '1st' '2nd' 'URL'

# 캐시되어야 하는 것들
probe 'HTML (landing)' "$ORIGIN/"
probe 'HTML (symbol)' "$ORIGIN/AAPL"
probe 'HTML (symbol tab)' "$ORIGIN/AAPL/overall"

# RSC — 룰이 적용되기 전에는 DYNAMIC(우회), 적용 후에는 MISS → HIT.
# `_rsc` 값은 아무거나 넣어도 된다. 캐시 키가 URL이므로 값만 고정하면 재현된다.
probe 'RSC (prefetch)' "$ORIGIN/AAPL?_rsc=probe1" -H 'RSC: 1' -H 'Next-Router-Prefetch: 1'
probe 'RSC (navigation)' "$ORIGIN/AAPL/overall?_rsc=probe2" -H 'RSC: 1'

# `_rsc`가 붙었는데 RSC 헤더가 없는 요청 — proxy.ts가 307로 파라미터를 떼야 한다.
# (캐시 상태가 아니라 status/location을 본다.)
printf '\n_rsc 오염 가드: '
curl -s -o /dev/null -w 'status=%{http_code} location=%{redirect_url}\n' \
    "$ORIGIN/AAPL?_rsc=probe1" -H "user-agent: $UA"

# 우회가 정상인 것들
probe 'API (bypass 기대)' "$ORIGIN/api/health"

# 정적 자산은 확장자 기본 캐싱으로 이미 HIT이어야 한다.
CHUNK=$(curl -s "$ORIGIN/AAPL" -H "user-agent: $UA" |
    grep -o '/_next/static/chunks/[A-Za-z0-9_~.-]*\.js' | head -1)
if [ -n "$CHUNK" ]; then
    probe 'static chunk' "$ORIGIN$CHUNK" -H 'accept-encoding: br'
else
    # 조용히 건너뛰면 "이상 없음"으로 오독된다 — 못 찾았다는 사실을 남긴다.
    printf '%-28s %-10s %-10s %s\n' 'static chunk' 'skipped' '-' 'HTML에서 chunk URL을 못 찾음'
fi
