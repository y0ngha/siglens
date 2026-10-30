import type { EnrichedNewsItem } from '@y0ngha/siglens-core';
import {
    isEnrichedRow,
    toEnrichedNewsItem,
} from '@/entities/news-article/lib/newsEnrichment';
import type { MarketNewsRow } from '../model';

/**
 * `isEnrichedRow` / `toEnrichedNewsItem`이 검사하는 필드만 골라 담는다. 명시적 매핑이라
 * 두 엔티티 사이의 형상 어긋남이 조용한 런타임 불일치가 아니라 컴파일 타임 TS 오류로
 * 드러난다.
 */
function toEnrichedRowShape(
    row: MarketNewsRow
): Parameters<typeof isEnrichedRow>[0] {
    return {
        id: row.id,
        symbol: row.symbol,
        source: row.source,
        url: row.url,
        publishedAt: row.publishedAt,
        titleEn: row.titleEn,
        titleKo: row.titleKo,
        bodyEn: row.bodyEn,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: row.sentiment,
        category: row.category,
        priceImpact: row.priceImpact,
        analyzedAt: row.analyzedAt,
    };
}

/**
 * `MarketNewsRow`를 core의 `EnrichedNewsItem`으로 바꾼다. 아직 보강되지 않았으면 `null`.
 *
 * 다이제스트 입력은 `selectDigestNews`가 이 함수로 만든다. 그 소비자(`submitMarketNewsDigestAction`
 * 생성, `peekMarketNewsDigestStatic` SSR peek, seo-prewarm cron의 뉴스 허브)가 같은
 * `EnrichedNewsItem[]`을 만들어야 core 다이제스트 캐시 키(`MarketNewsDigestCacheKeyOptions.news`)가
 * 맞는다. 구현을 하나로 두어 이 일치를 호출부의 기억이 아니라 구조로 보장한다.
 */
export function toEnrichedMarketNewsItem(
    row: MarketNewsRow
): EnrichedNewsItem | null {
    const shaped = toEnrichedRowShape(row);
    if (!isEnrichedRow(shaped)) return null;
    return toEnrichedNewsItem(shaped);
}
