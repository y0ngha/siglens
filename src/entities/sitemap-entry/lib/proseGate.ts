import type { SeoSnapshotTab } from '@/entities/seo-snapshot';

/**
 * 스냅샷 산문이 없으면 페이지가 noindex가 되는 탭(`hasCongressProse`·
 * `hasOverallProse`·`hasNewsProse` 게이트). sitemap은 이 탭들을 산문 보유 종목에만
 * 싣는다. 스냅샷 탭 이름 기준이다 — 세 탭 모두 URL 세그먼트와 같다.
 *
 * `news`는 산문이 없어도 sentiment 카드가 있으면 색인되므로 이 필터가 **색인 가능한
 * URL 일부까지 sitemap에서 뺀다.** 그 편이 낫다 — 빠진 URL은 내부 링크로 여전히
 * 발견되고, 반대 방향(noindex URL이 sitemap에 남는 것)은 GSC 오류가 된다.
 * 2026-09-18 배포 후 표본 138개에서 `/NEWTI/news`·`/QSPT/news`·`/TRPSX/news`가
 * 정확히 이 형태로 남아 있었다.
 *
 * 다만 이 게이트가 반대 방향을 **완전히** 막지는 못한다 — 판정 근거가
 * `listFreshSymbolTabs`의 행 존재 여부지 `content`가 아니어서, 서사 필드가 빈
 * 스냅샷이 신선하게 저장돼 있으면 sitemap은 "산문 있음"으로 본다. `congress`·
 * `overall`도 처음부터 같은 구조였다. 실제로 문제가 되면 판정을 `content` 기반으로
 * 올리면 된다(행마다 렌더러 게이트 실행 = sitemap 생성 비용 증가).
 */
export const PROSE_GATED_SITEMAP_TABS = [
    'congress',
    'overall',
    'news',
] as const satisfies readonly SeoSnapshotTab[];

export type ProseGatedSitemapTab = (typeof PROSE_GATED_SITEMAP_TABS)[number];

export interface BuildPopularEntriesOptions {
    /**
     * `"${SYMBOL}:${tab}"` — {@link PROSE_GATED_SITEMAP_TABS} 탭에 신선한 스냅샷이
     * 있는 조합. **없으면(`undefined`) 필터를 끈다** — 로더가 DB를 못 읽었을 때
     * 예전처럼 전부 싣는다(`loadPopularSitemapInputs`).
     */
    readonly symbolTabsWithProse?: ReadonlySet<string>;
}

/**
 * 산문 게이트 판정기. 주식·크립토 빌더가 같은 키 형식(`"SYMBOL:tab"`)을 써야 하므로
 * 삼항식을 각 빌더에 복제하지 않고 여기서 만든다 — 게이트 탭이 늘어날 때 한쪽
 * 빌더만 고치는 사고를 막는다.
 */
export function makeProseGate({
    symbolTabsWithProse,
}: BuildPopularEntriesOptions): (
    symbol: string,
    tab: ProseGatedSitemapTab
) => boolean {
    return (symbol, tab) =>
        symbolTabsWithProse === undefined ||
        symbolTabsWithProse.has(`${symbol}:${tab}`);
}
