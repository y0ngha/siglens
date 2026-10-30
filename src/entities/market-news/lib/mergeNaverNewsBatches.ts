import { toNaverNewsItem } from '@/entities/news-article/lib/naverNewsClient';
import type { NaverNewsItem } from '@/shared/api/naver/naverSearch';
import type { MarketNewsItem } from './marketNewsClientPort';

/**
 * 질의별 네이버 결과를 하나의 시장 피드로 합친다 — 정규화 불가·lookback 밖 기사를
 * 버리고, URL 해시(id) 기준으로 중복을 걷어낸 뒤 최신순으로 정렬한다.
 *
 * 같은 기사가 `코스피`·`국내 증시` 양쪽에 잡히는 것이 정상이다. 앞선 질의의 기사가
 * 이긴다(삽입 순서 보존). 네이버는 기사에 붙은 종목코드를 주지 않고 추정으로 채우면
 * 무관한 종목 페이지에 기사가 걸리므로 `tickers`는 항상 비운다.
 */
export function mergeNaverNewsBatches(
    batches: readonly (readonly NaverNewsItem[])[],
    sentinel: string,
    cutoff: Date
): MarketNewsItem[] {
    const byId = new Map<string, MarketNewsItem>();
    for (const raw of batches.flat()) {
        const item = toNaverNewsItem(raw, sentinel);
        if (item === null) continue;
        if (new Date(item.publishedAt) < cutoff) continue;
        if (byId.has(item.id)) continue;
        byId.set(item.id, { ...item, tickers: [] });
    }

    return [...byId.values()].toSorted((a, b) =>
        b.publishedAt.localeCompare(a.publishedAt)
    );
}
