/**
 * E2E test-mode guard. Server-side actions short-circuit worker/LLM submit
 * paths only when this returns true, so Playwright never reaches real external
 * analysis infrastructure. Keep this helper fixture-free so production traces
 * do not pull in `e2e/fixtures`.
 */
export function isE2E(): boolean {
    return process.env.E2E_TEST === '1';
}

/**
 * "E2E이되 실제 provider로 돌아가라는 옵트인이 없다" — 결정적인 fake/stub을 써야 하는 상태.
 *
 * `E2E_TEST=1`은 로컬 postgres 드라이버(`shared/db/client.ts`)도 고르므로, dev 서버를 로컬 DB에 붙이면서
 * 실제 외부 왕복(에이전트 LLM·웹 검색·Yahoo)을 시험하려면 `AGENT_REAL_PROVIDER=1`로 fake만 끌 수 있어야 한다.
 * CI는 이 값을 켜지 않아 e2e 스위트는 fake를 유지한다. 이 조건을 쓰는 곳(에이전트 provider, `web_search`
 * 가용 여부, Yahoo 소스)이 따로 변하지 않도록 한 곳에 둔다.
 */
export function isE2EFakeMode(): boolean {
    return isE2E() && process.env.AGENT_REAL_PROVIDER !== '1';
}
