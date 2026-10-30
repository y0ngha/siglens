import type { SuggestionHeadline } from '@y0ngha/siglens-core';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import type { Locale } from '@/shared/i18n/locales';
import { resolveNewsTitle } from '@/shared/lib/news/resolveNewsTitle';

/** {@link mergeHeadlines} 입력 한 건 — 뉴스 카드와 그것을 가져온 카테고리. */
export interface CategorizedNewsRow {
    readonly row: MarketNewsCardItem;
    readonly categoryId: SuggestionHeadline['category'];
}

function compareNewestFirst(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? 1 : -1;
}

/**
 * 카테고리별로 가져온 뉴스 카드를 최신순으로 합쳐 프롬프트용 헤드라인 상위 `max`건으로 만든다.
 *
 * `publishedAt`은 ISO-8601 문자열이라 사전순이 곧 시간순이다. 첫 티커가 있으면 `symbol`로 붙인다.
 */
export function mergeHeadlines(
    rows: readonly CategorizedNewsRow[],
    locale: Locale,
    max: number
): SuggestionHeadline[] {
    return [...rows]
        .sort((a, b) =>
            compareNewestFirst(a.row.publishedAt, b.row.publishedAt)
        )
        .slice(0, max)
        .map(({ row, categoryId }) => ({
            title: resolveNewsTitle(row, locale),
            category: categoryId,
            ...(row.tickers[0] !== undefined ? { symbol: row.tickers[0] } : {}),
        }));
}
