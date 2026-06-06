import type { EnrichedNewsItem } from '@y0ngha/siglens-core';
import type { NewsRow } from '../api';
import { isEnrichedRow, toEnrichedNewsItem } from './newsEnrichment';
import { selectAggregateNewsItems } from './newsAnalysisSelection';

/**
 * AI 분석 axis가 input으로 받을 표준 news items를 만든다.
 *
 * 1. 미분석/번역 누락 row 필터 (`isEnrichedRow`)
 * 2. shape 변환 (`toEnrichedNewsItem`)
 * 3. priceImpact 우선 top-N cap (`selectAggregateNewsItems`)
 *
 * **왜 단일 함수로 묶나** — `submitNewsAnalysisAction`(`/news` 페이지)과
 * `submitOverallAnalysisAction`(`/overall` 페이지 news axis)이 core 안에서 동일한
 * `submitNewsAnalysis` 함수를 호출한다(`dependencyResolver` → `submitNewsAnalysis`).
 * 두 호출자가 같은 news input을 보내야 `symbol+modelId+hash(sorted news IDs)` 캐시
 * 키가 일치해 `/news`에서 한 분석이 `/overall` news axis로 그대로 hit한다. 호출자별로
 * 변환 파이프라인을 직접 짜면 한쪽이 step을 빼먹는 순간 cache miss로 종합 분석이
 * ~1분 대기 상태에 빠진다.
 *
 * 미래에 news를 input으로 받는 axis가 추가되면(예: 뉴스+옵션 결합 axis) 이 함수를
 * 재사용해 cache 공유를 자동으로 보장한다.
 *
 * 순수 함수 — 입력 배열을 변이하지 않는다(`selectAggregateNewsItems`가 `toSorted`).
 */
export function buildAnalysisNewsItems(
    rows: ReadonlyArray<NewsRow>
): EnrichedNewsItem[] {
    return selectAggregateNewsItems(
        rows.filter(isEnrichedRow).map(toEnrichedNewsItem)
    );
}
