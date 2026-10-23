/**
 * Next가 "캐시 스코프 안에서 동적 API를 썼다"고 알리는 제어 흐름 에러인지.
 *
 * `cookies()`/`headers()` 같은 동적 API를 `unstable_cache()` 안에서 호출하면
 * Next 16.4는 다음 형태로 던진다(next/dist/server/use-cache/use-cache-messages.js의
 * `createCookiesInUnstableCacheError` 등 — `request/cookies.js`가 부른다):
 *
 *   Route "${route}": `cookies()` can't be read inside `unstable_cache()`. Read it
 *   outside the cached function and pass what you need as an argument.
 *
 * 요청 데이터 읽기(`cookies()`·`headers()`·`searchParams`·Route Handler의 `request.*`)는
 * `can't be read inside`, `connection()`은 `` `connection()` can't be called inside ``로 온다.
 * 16.3까지의 `used \`cookies()\` inside a function cached with …` 형태는 16.4에서
 * `prefetch()`·`navigation()` 오용 오류에만 남아 있어 더 이상 보지 않는다.
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
 * 동작은 안전한 쪽(로그를 남김)으로 degrade한다. 문구는
 * `__tests__/isCacheScopeDynamicUsage.test.ts`가 설치된 Next의 메시지 생성 함수로 직접
 * 확인하므로, Next가 문구를 또 바꾸면 그 테스트가 먼저 깨진다.
 * 코드를 고쳐야 하는 진짜 오류 — draftMode 켜기/끄기, revalidate 호출,
 * `"use cache: private"` 조합, `prefetch()`·`navigation()` — 는 일부러 잡지 않는다.
 * `"use cache"` 변형은 지금 cacheComponents가 꺼져 있어 도달하지 않지만, 재활성화 시 같은
 * 제어 흐름이 이 문구로 오므로 미리 잡는다(감사 재검토 #7).
 */
const CACHE_SCOPE_DYNAMIC_USAGE =
    /(?:can't be read|`connection\(\)` can't be called) inside `(?:unstable_cache\(\)|"use cache")`/;

export function isCacheScopeDynamicUsage(error: unknown): boolean {
    return (
        error instanceof Error && CACHE_SCOPE_DYNAMIC_USAGE.test(error.message)
    );
}
