#!/usr/bin/env bash
# 배포 직후 ISR·엣지 캐시 예열.
#
# ISR 캐시는 배포마다 비워진다 — `cache-handler`가 `siglens-isr/{GIT_SHA}/`를
# prefix로 쓰기 때문이다(ISR_CACHE_HANDLER.md). 게다가 배포 마지막 단계가
# Cloudflare 캐시를 통째로 퍼지하므로, 새 릴리스 직후에는 **모든** 페이지가
# CF MISS + ISR MISS다.
#
# 2026-09-17 실측(v0.79.1 배포 40분 뒤 Googlebot UA 전수 크롤): 3,185개 응답 중
# 88%가 두 캐시 모두 MISS였고 원시 HTML 응답이 중앙값 1.05초·p99 4.5초였다.
# 동시 5요청이면 오리진이 중앙값 3.3초로 밀린다(t4g.medium). Googlebot의 크롤
# 속도는 응답 시간에 연동되므로, 배포 직후 크롤 창이 느린 응답으로 채워지면
# 크롤 예산이 줄어든다.
#
# 그래서 배포가 끝나면 **중요한 URL부터** 직접 한 번 긁어 캐시를 채운다.
# sitemap 순서가 곧 중요도 순서다(`POPULAR_TICKERS`가 노출 내림차순).
#
# 2026-10-04 갱신: 예열 범위가 150개였는데 sitemap은 1,140개(static 21 · popular
# 1,032 · crypto 87)다 — 나머지 약 990개는 배포 뒤 첫 크롤러가 콜드 렌더를 맞았다.
# 같은 날 Googlebot UA로 동시 4요청 전수 크롤을 하니 종목 페이지 응답이 중앙값
# 1.2~1.6초, p95 4.3~5초였다. 그래서 sitemap 셋(static → popular → crypto, 중요도
# 순)을 전부 읽고 기본 상한을 1,500으로 올렸다(전체를 덮는다). 오리진이 응답하지 않는
# 최악의 경우를 끊으려고 URL당 `--max-time`은 30초에서 20초로 낮췄다 — 정상 응답의
# p95가 5초 안팎이라 20초면 충분하다.
#
# 사용법: scripts/warm-isr.sh [origin] [limit]   (기본 https://siglens.io 1500)
#   예열은 배포 성공 여부를 바꾸지 않는다 — 실패해도 항상 0으로 끝난다.
set -uo pipefail

ORIGIN="${1:-https://siglens.io}"
LIMIT="${2:-1500}"
CONCURRENCY="${WARM_CONCURRENCY:-4}"
# 봇으로 판정되지 않는 평범한 UA를 쓴다 — `isBot`이 참이면 종목 페이지의 분석
# 생성 트리거가 꺼져 사람이 받는 것과 다른 경로를 예열하게 된다.
UA="${WARM_UA:-Mozilla/5.0 (compatible; siglens-warm/1.0; +https://siglens.io)}"

urls_file=$(mktemp)
trap 'rm -f "$urls_file"' EXIT

# `sed`는 두 식으로 나눈다 — `</\?loc>`의 `\?`는 GNU 확장이라 macOS BSD sed에서는
# 치환이 통째로 실패해 URL 대신 `<loc>…</loc>` 문자열을 긁는다(로컬 실측).
# `awk NR<=LIMIT`를 쓴다 — `head`는 상한에 닿는 순간 파이프를 닫아 앞단 curl이
# SIGPIPE로 죽고 `curl: (56)`을 찍는다(예열은 멀쩡히 되지만 로그가 거짓말을 한다).
for sitemap in sitemap-static.xml sitemap-popular.xml sitemap-crypto.xml; do
    curl -sS --compressed --max-time 30 "${ORIGIN}/${sitemap}" |
        grep -o '<loc>[^<]*</loc>' | sed -e 's|<loc>||g' -e 's|</loc>||g'
done | awk -v n="$LIMIT" 'NR<=n' > "$urls_file"

total=$(wc -l < "$urls_file" | tr -d ' ')
if [ "$total" -eq 0 ]; then
    echo "⚠️ 예열할 URL을 못 읽었다 (sitemap 응답 확인). 배포는 그대로 진행한다."
    exit 0
fi

echo "ISR 예열 시작: ${total}개 URL, 동시 ${CONCURRENCY} (${ORIGIN})"
start=$(date +%s)
export UA
# xargs -P는 오리진을 밀지 않도록 낮게 유지한다 — 동시 5부터 응답이 눈에 띄게 느려졌다.
# `-a`는 GNU 전용이라 stdin 리다이렉트로 넘긴다(macOS에서도 돈다).
#
# `--compressed` 필수: 기본 curl은 Accept-Encoding을 아예 보내지 않아 비압축 본문이
# CF 캐시에 굳고, 그 뒤 모든 사용자가 5~11배 본문을 받는다(CDN_CACHING.md의 2026-08 사고).
results=$(xargs -P "$CONCURRENCY" -I{} \
    curl -sS --compressed --max-time 20 -o /dev/null \
    -H "user-agent: $UA" -w '%{http_code}\n' {} < "$urls_file")
elapsed=$(( $(date +%s) - start ))

ok=$(printf '%s\n' "$results" | grep -c '^200$')
echo "ISR 예열 끝: ${ok}/${total} 200, ${elapsed}초"
printf '%s\n' "$results" | sort | uniq -c | sort -rn | head -5
exit 0
