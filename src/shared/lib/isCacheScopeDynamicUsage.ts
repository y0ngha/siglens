/**
 * Next가 "캐시 스코프 안에서 동적 API를 썼다"고 알리는 제어 흐름 에러인지.
 *
 * `cookies()`/`headers()` 같은 동적 API를 `unstable_cache()` 안에서 호출하면
 * Next는 다음 형태로 던진다(next/dist/server/request/cookies.js):
 *
 *   Route ${route} used `cookies()` inside a function cached with
 *   `unstable_cache()`. Accessing Dynamic data sources inside a cache scope
 *   is not supported.
 *
 * **실패가 아니라 제어 흐름 신호**다 — ISR/prerender엔 애초에 요청 컨텍스트가
 * 없으므로 호출부가 정적 기본값으로 떨어지는 게 정답이다. 이걸 다른 인프라
 * 실패와 구분하지 않고 로그로 남기면 페이지가 생성될 때마다 오류가 쌓인다
 * (2026-07-26 실측: 9시간에 2,016건).
 *
 * ⚠️ `isDynamicServerError`와 **합치지 말 것**. 그쪽은 digest가
 * `DYNAMIC_SERVER_USAGE`이거나 메시지에 "Dynamic server usage"가 든 경우를 보는
 * 별개의 에러이고, 소비자들(`getAssetInfoResilient` 등)이 true일 때 **rethrow**
 * 한다. 합치면 그 경로들이 degrade에서 전파로 뒤집힌다.
 *
 * 매칭은 Next 메시지의 고정 부분만 본다. 문구가 바뀌면 다시 로그가 늘어날 뿐
 * 동작은 안전한 쪽(로그를 남김)으로 degrade한다.
 */
export function isCacheScopeDynamicUsage(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.message.includes('inside a function cached with') ||
            // `use cache`(cacheComponents) 변형. 지금은 cacheComponents가 꺼져 있어
            // 도달하지 않지만, 재활성화 시 같은 제어 흐름이 이 문구로 오므로 미리 잡는다
            // — 없으면 로그 폭주가 조용히 되살아난다(감사 재검토 #7).
            error.message.includes('inside "use cache"'))
    );
}
