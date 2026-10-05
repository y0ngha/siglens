import type { SeoSnapshotTab } from '@/entities/seo-snapshot/model';

/**
 * 스냅샷 산문이 없으면 페이지가 noindex가 되는 탭. sitemap은 이 탭을 **렌더 가능한 산문을
 * 가진 종목**에만 싣는다. 스냅샷 탭 이름 기준이다 — URL 세그먼트와 같다.
 *
 * 차트(`technical`)·뉴스(`news`) 두 탭이다. 둘 다 종목 고유 텍스트가 AI 스냅샷 산문뿐이라
 * (`SEO_RECOVERY_2026_09.md` §5 A3), 페이지는 산문이 없으면 noindex(`no-prose`)다
 * (`SymbolIndexabilityInput.prose`). sitemap이 같은 판정으로 URL을 빼야 "sitemap에 있는데
 * noindex"(GSC 오류)와 그 반대(색인되는데 sitemap에 없음)가 둘 다 생기지 않는다 — 두 쪽이
 * 같은 `hasProseForTab`을 쓰고 `sitemapPageParity.test.ts`가 같은 픽스처로 일치를 고정한다.
 *
 * 판정 근거는 **행 존재가 아니라 렌더 가능한 산문**이다(`listFreshSymbolTabs`의 `hasProse`).
 * 서사 필드가 빈 스냅샷이 신선하게 저장돼 있어도 페이지는 noindex이므로 sitemap도 뺀다.
 * 예전 멤버였던 `congress`·`overall`은 페이지가 **항상** noindex라 sitemap 빌더가 아예
 * 엔트리를 내지 않는다 — 산문 유무로 가를 대상이 아니다.
 *
 * 이 목록은 lastmod 조회 대상이기도 하다: 맵의 `generatedAt`이 차트·뉴스 lastmod의 근거다.
 */
export const PROSE_GATED_SITEMAP_TABS = [
    'technical',
    'news',
] as const satisfies readonly SeoSnapshotTab[];

export type ProseGatedSitemapTab = (typeof PROSE_GATED_SITEMAP_TABS)[number];

/**
 * 스냅샷 조합 키. 로더(`server.ts`)가 만들고 게이트·시각 조회가 읽으므로 형식을
 * 한 곳에서 정의한다 — 두 쪽이 템플릿 문자열을 각자 쓰면 한쪽 변경이 조용히 모든 조합을
 * 놓치게 만든다.
 */
export function snapshotKey(symbol: string, tab: ProseGatedSitemapTab): string {
    return `${symbol}:${tab}`;
}

export interface BuildPopularEntriesOptions {
    /**
     * `"${SYMBOL}:${tab}"` → 그 조합의 **신선하고 렌더 가능한 산문이 있는 스냅샷의
     * `generatedAt`**({@link PROSE_GATED_SITEMAP_TABS} 탭만). 산문 게이트(키가 있는가)와
     * lastmod(`generatedAt`)가 **같은 데이터**에서 나온다 — 쿼리가 하나라 둘이 갈릴 수 없다.
     * 로더는 산문이 렌더되지 않는 행을 맵에 **넣지 않는다**(`loadPopularSitemapInputs`).
     *
     * **없으면(`undefined`) 필터를 끄고 lastmod는 폴백으로 간다** — 로더가 DB를 못
     * 읽었을 때 전부 싣는다. 페이지도 스냅샷 읽기 실패(`unknown`)에는 색인을 유지하므로
     * (fail-open) 같은 방향이다.
     */
    readonly snapshotGeneratedAt?: ReadonlyMap<string, Date>;
}

/**
 * 산문 게이트 판정기. 주식·크립토 빌더가 같은 키 형식(`"SYMBOL:tab"`)을 써야 하므로
 * 삼항식을 각 빌더에 복제하지 않고 여기서 만든다 — 게이트 탭이 늘어날 때 한쪽
 * 빌더만 고치는 사고를 막는다.
 */
export function makeProseGate({
    snapshotGeneratedAt,
}: BuildPopularEntriesOptions): (
    symbol: string,
    tab: ProseGatedSitemapTab
) => boolean {
    return (symbol, tab) =>
        snapshotGeneratedAt === undefined ||
        snapshotGeneratedAt.has(snapshotKey(symbol, tab));
}

/**
 * 스냅샷 생성 시각 조회기. 맵이 없거나(로더 실패) 그 조합의 신선한 스냅샷이 없으면
 * `undefined` — 호출 빌더가 각자의 폴백(세션 마감·`now − 1h`)을 쓴다.
 */
export function makeSnapshotTimeLookup({
    snapshotGeneratedAt,
}: BuildPopularEntriesOptions): (
    symbol: string,
    tab: ProseGatedSitemapTab
) => Date | undefined {
    return (symbol, tab) => snapshotGeneratedAt?.get(snapshotKey(symbol, tab));
}
