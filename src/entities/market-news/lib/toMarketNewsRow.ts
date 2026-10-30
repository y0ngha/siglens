import {
    toNewsCategory,
    toNewsImpact,
    toNewsSentiment,
} from '@/shared/lib/news/newsEnumCoercion';
import type { NewsDisplayItem } from '@/shared/lib/types';
import type { MarketNewsRow } from '../model';

/** `market_news`에서 목록 읽기로 select한 컬럼 묶음. */
export interface MarketNewsDbRow {
    id: string;
    symbol: string;
    source: string;
    url: string;
    publishedAt: Date;
    titleEn: string;
    /** 이 경로에서는 select하지 않는다 — `toMarketNewsRow`가 항상 `null`로 채운다. */
    bodyEn?: string | null;
    titleKo: string | null;
    bodyKo: string | null;
    summaryKo: string | null;
    sentiment: string | null;
    category: string | null;
    priceImpact: string | null;
    tickers: string[];
    analyzedAt: Date | null;
}

/**
 * DB 행을 `MarketNewsRow`로 바꾼다. 감성·분류·영향도 문자열은 종목 뉴스 슬라이스와
 * 같은 강제 변환(`newsEnumCoercion`)을 거친다 — 두 벌을 두면 core가 enum 값을 추가했을 때
 * 한쪽만 갱신돼 그 슬라이스에서만 조용히 null로 떨어진다.
 */
export function toMarketNewsRow(row: MarketNewsDbRow): MarketNewsRow {
    const displayItem: NewsDisplayItem = {
        id: row.id,
        publishedAt: row.publishedAt.toISOString(),
        titleEn: row.titleEn,
        titleKo: row.titleKo,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: toNewsSentiment(row.sentiment),
        category: toNewsCategory(row.category),
        priceImpact: toNewsImpact(row.priceImpact),
        url: row.url,
        source: row.source,
    };
    return {
        ...displayItem,
        // 읽지 않는다 — `MarketNewsRow.bodyEn` 주석 참조.
        bodyEn: null,
        symbol: row.symbol,
        tickers: row.tickers,
        analyzedAt: row.analyzedAt,
    };
}
