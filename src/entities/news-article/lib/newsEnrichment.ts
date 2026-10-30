import type {
    EnrichedNewsItem,
    NewsCardAnalysis,
    NewsCategory,
    NewsImpact,
    NewsSentiment,
} from '@y0ngha/siglens-core';
import type { NewsRow } from '../api';

/** LLM 보강이 끝난 NewsRow — titleKo/summaryKo/sentiment/category/priceImpact가 non-null임이 보장되고, bodyKo만 null일 수 있다. */
export interface EnrichedNewsRow extends NewsRow {
    titleKo: string;
    summaryKo: string;
    sentiment: NewsSentiment;
    category: NewsCategory;
    priceImpact: NewsImpact;
    bodyKo: string | null;
}

/** 보강 필드가 모두 채워진 행만 통과시킨다. 하나라도 null이면 집계 분석 입력에서 빠진다. */
export function isEnrichedRow(row: NewsRow): row is EnrichedNewsRow {
    return (
        row.titleKo !== null &&
        row.summaryKo !== null &&
        row.sentiment !== null &&
        row.category !== null &&
        row.priceImpact !== null
    );
}

/** 보강된 행을 core `EnrichedNewsItem` 형상(`card` 하위 객체)으로 옮긴다. */
export function toEnrichedNewsItem(row: EnrichedNewsRow): EnrichedNewsItem {
    const card: NewsCardAnalysis = {
        titleKo: row.titleKo,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: row.sentiment,
        category: row.category,
        priceImpact: row.priceImpact,
    };
    return {
        id: row.id,
        symbol: row.symbol,
        source: row.source,
        url: row.url,
        publishedAt: row.publishedAt,
        titleEn: row.titleEn,
        bodyEn: row.bodyEn,
        card,
    };
}
