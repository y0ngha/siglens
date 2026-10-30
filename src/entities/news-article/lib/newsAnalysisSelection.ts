import type { EnrichedNewsItem, NewsImpact } from '@y0ngha/siglens-core';

/**
 * 집계 뉴스 분석 프롬프트에 넣는 기사 수 상한. 뉴스가 많은 종목(예: NVDA)은 30일 창에만
 * 보강 행이 수백 건이라, 상한이 없으면 프롬프트가 비용·지연·lost-in-the-middle로 폭발한다.
 * 시장 영향이 큰 기사를 남기고 나머지는 버린다.
 */
export const MAX_AGGREGATE_NEWS_ITEMS = 25;

/** 클수록 시장 영향이 크다. 집계 프롬프트의 선택 순서를 정한다. */
const IMPACT_RANK: Record<NewsImpact, number> = {
    high: 3,
    medium: 2,
    low: 1,
    negligible: 0,
};

/**
 * 집계 뉴스 분석 프롬프트에 들어갈 기사를 고른다: 카드별 `priceImpact`
 * (high > medium > low > negligible) 순으로 정렬해 시장 영향이 큰 기사를 앞에 두고, 상위
 * {@link MAX_AGGREGATE_NEWS_ITEMS}건을 취한다.
 *
 * 입력 배열은 변경하지 않는다. 동률은 들어온 순서를 유지하므로(`toSorted`는 안정 정렬)
 * 호출부의 최신순이 영향도 구간 안에서 보존된다.
 */
export function selectAggregateNewsItems(
    items: ReadonlyArray<EnrichedNewsItem>
): EnrichedNewsItem[] {
    return items
        .toSorted(
            (a, b) =>
                IMPACT_RANK[b.card.priceImpact] -
                IMPACT_RANK[a.card.priceImpact]
        )
        .slice(0, MAX_AGGREGATE_NEWS_ITEMS);
}
