import type { SeoSnapshotTab } from '@/entities/seo-snapshot/model';

/**
 * 스냅샷 산문이 없으면 페이지가 noindex가 되는 탭. sitemap은 이 탭을 산문 보유
 * 종목에만 싣는다. 스냅샷 탭 이름 기준이다 — URL 세그먼트와 같다.
 *
 * 2026-10-01 SEO 감사(`docs/architecture/SEO_RECOVERY_2026_09.md` §10)로 `news` 하나만
 * 남았다. 예전 멤버였던 `congress`·`overall`은 이제 페이지가 **항상** noindex라 sitemap
 * 빌더가 아예 엔트리를 내지 않는다 — 산문 유무로 가를 대상이 아니다.
 *
 * `news`는 산문이 없어도 sentiment 카드가 있으면 색인되므로 이 필터가 **색인 가능한
 * URL 일부까지 sitemap에서 뺀다.** 그 편이 낫다 — 빠진 URL은 내부 링크로 여전히
 * 발견되고, 반대 방향(noindex URL이 sitemap에 남는 것)은 GSC 오류가 된다.
 * 2026-09-18 배포 후 표본 138개에서 `/NEWTI/news`·`/QSPT/news`·`/TRPSX/news`가
 * 정확히 이 형태로 남아 있었다.
 *
 * 다만 이 게이트가 반대 방향을 **완전히** 막지는 못한다 — 판정 근거가
 * `listFreshSymbolTabs`의 행 존재 여부지 `content`가 아니어서, 서사 필드가 빈
 * 스냅샷이 신선하게 저장돼 있으면 sitemap은 "산문 있음"으로 본다. 실제로 문제가
 * 되면 판정을 `content` 기반으로 올리면 된다(행마다 렌더러 게이트 실행 = sitemap
 * 생성 비용 증가).
 */
export const PROSE_GATED_SITEMAP_TABS = [
    'news',
] as const satisfies readonly SeoSnapshotTab[];

export type ProseGatedSitemapTab = (typeof PROSE_GATED_SITEMAP_TABS)[number];

/**
 * sitemap 로더가 한 번의 쿼리로 읽는 스냅샷 탭. 게이트 대상(`news`)에 더해
 * `technical`을 읽는다 — 차트 탭(`/{ticker}`)의 본문 산문이 이 스냅샷이라, 산문이
 * 새로 구워진 시각이 lastmod에 반영돼야 한다(`buildPopularEntries` JSDoc).
 *
 * 게이트(`PROSE_GATED_SITEMAP_TABS`)와 별개 상수다 — `technical`은 **싣느냐**를 정하지
 * 않고 **언제 바뀌었다고 말하느냐**만 정한다. 두 목록을 한 줄에 섞으면 `technical`이
 * 게이트로 오인된다.
 */
export const SITEMAP_SNAPSHOT_TABS = [
    'technical',
    'news',
] as const satisfies readonly SeoSnapshotTab[];

export type SitemapSnapshotTab = (typeof SITEMAP_SNAPSHOT_TABS)[number];

/**
 * 스냅샷 조합 키. 로더(`server.ts`)가 만들고 게이트·시각 조회가 읽으므로 형식을
 * 한 곳에서 정의한다 — 두 쪽이 템플릿 문자열을 각자 쓰면 한쪽 변경이 조용히 모든 조합을
 * 놓치게 만든다.
 */
export function snapshotKey(symbol: string, tab: SitemapSnapshotTab): string {
    return `${symbol}:${tab}`;
}

export interface BuildPopularEntriesOptions {
    /**
     * `"${SYMBOL}:${tab}"` → 그 조합의 **신선한 스냅샷 `generatedAt`**
     * ({@link SITEMAP_SNAPSHOT_TABS} 탭만). 산문 게이트(`news`에 키가 있는가)와
     * lastmod(`generatedAt`)가 **같은 데이터**에서 나온다 — 쿼리가 하나라 둘이 갈릴 수
     * 없다.
     *
     * **없으면(`undefined`) 필터를 끄고 lastmod는 폴백으로 간다** — 로더가 DB를 못
     * 읽었을 때 예전처럼 전부 싣는다(`loadPopularSitemapInputs`).
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
    tab: SitemapSnapshotTab
) => Date | undefined {
    return (symbol, tab) => snapshotGeneratedAt?.get(snapshotKey(symbol, tab));
}
