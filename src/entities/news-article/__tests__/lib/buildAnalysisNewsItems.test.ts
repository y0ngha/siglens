/**
 * buildAnalysisNewsItems — AI 분석 axis가 공통으로 받는 news input pipeline 검증.
 *
 * /news (submitNewsAnalysisAction) + /overall (submitOverallAnalysisAction news axis)이
 * 같은 함수를 호출해 동일 `news IDs hash` cache key를 만들어야 axis 분석이 공유된다.
 *
 * - filter: titleKo/bodyKo/priceImpact 등 분석 결과 누락된 row 제거
 * - map: NewsRow → EnrichedNewsItem 변환
 * - cap: priceImpact 우선 top 25 (MAX_AGGREGATE_NEWS_ITEMS)
 */

import { describe, it, expect } from 'vitest';
import {
    buildAnalysisNewsItems,
    MAX_AGGREGATE_NEWS_ITEMS,
} from '@/entities/news-article';
import type { NewsRow } from '@/entities/news-article/api';
import type { NewsImpact } from '@y0ngha/siglens-core';

function makeAnalyzedRow(
    id: string,
    priceImpact: NewsImpact = 'medium'
): NewsRow {
    return {
        id,
        symbol: 'AAPL',
        source: 'Reuters',
        url: `https://reuters.com/${id}`,
        publishedAt: '2025-07-01T10:00:00.000Z',
        titleEn: 'Apple news',
        bodyEn: 'body',
        titleKo: '애플 뉴스',
        bodyKo: '본문',
        summaryKo: '요약',
        sentiment: 'bullish',
        priceImpact,
        category: 'earnings',
        analyzedAt: new Date('2025-07-01T11:00:00.000Z'),
    } as unknown as NewsRow;
}

function makeUnanalyzedRow(id: string): NewsRow {
    return {
        ...makeAnalyzedRow(id),
        titleKo: null,
        bodyKo: null,
        summaryKo: null,
        priceImpact: null,
        sentiment: null,
        category: null,
        analyzedAt: null,
    } as unknown as NewsRow;
}

describe('buildAnalysisNewsItems', () => {
    it('Happy: 분석 완료된 row만 변환해 EnrichedNewsItem 배열을 반환한다', () => {
        const rows = [
            makeAnalyzedRow('a1'),
            makeAnalyzedRow('a2'),
            makeAnalyzedRow('a3'),
        ];
        const items = buildAnalysisNewsItems(rows);
        expect(items).toHaveLength(3);
        expect(items.map(i => i.id).sort()).toEqual(['a1', 'a2', 'a3']);
    });

    it('미분석 row(titleKo=null)는 필터링한다', () => {
        const rows = [
            makeAnalyzedRow('a1'),
            makeUnanalyzedRow('u1'),
            makeAnalyzedRow('a2'),
            makeUnanalyzedRow('u2'),
        ];
        const items = buildAnalysisNewsItems(rows);
        expect(items).toHaveLength(2);
        expect(items.map(i => i.id).sort()).toEqual(['a1', 'a2']);
    });

    it('30개 row → MAX_AGGREGATE_NEWS_ITEMS(25)로 cap', () => {
        const rows = Array.from({ length: 30 }, (_, i) =>
            makeAnalyzedRow(`id-${i}`)
        );
        const items = buildAnalysisNewsItems(rows);
        expect(items).toHaveLength(MAX_AGGREGATE_NEWS_ITEMS);
        expect(items).toHaveLength(25);
    });

    it('priceImpact 우선: high > medium > low > negligible 순서로 cap', () => {
        const rows = [
            ...Array.from({ length: 10 }, (_, i) =>
                makeAnalyzedRow(`neg-${i}`, 'negligible')
            ),
            ...Array.from({ length: 10 }, (_, i) =>
                makeAnalyzedRow(`low-${i}`, 'low')
            ),
            ...Array.from({ length: 5 }, (_, i) =>
                makeAnalyzedRow(`med-${i}`, 'medium')
            ),
            ...Array.from({ length: 5 }, (_, i) =>
                makeAnalyzedRow(`high-${i}`, 'high')
            ),
        ];
        const items = buildAnalysisNewsItems(rows);
        expect(items).toHaveLength(25);
        // 상위 5개: high, 다음 5개: medium, 다음 10개: low, 마지막 5개: negligible(10개 중 5개만 들어감)
        expect(
            items.slice(0, 5).every(i => i.card.priceImpact === 'high')
        ).toBe(true);
        expect(
            items.slice(5, 10).every(i => i.card.priceImpact === 'medium')
        ).toBe(true);
        expect(
            items.slice(10, 20).every(i => i.card.priceImpact === 'low')
        ).toBe(true);
        expect(
            items.slice(20, 25).every(i => i.card.priceImpact === 'negligible')
        ).toBe(true);
    });

    it('동일 input → 동일 output 순서 (cache 공유 결정성)', () => {
        // /news + /overall이 동일 rows를 받으면 결과 항목 순서까지 같아야
        // sorted news IDs hash가 동일 → cache key 동일.
        const rows = [
            makeAnalyzedRow('a', 'medium'),
            makeAnalyzedRow('b', 'high'),
            makeAnalyzedRow('c', 'low'),
            makeAnalyzedRow('d', 'high'),
            makeAnalyzedRow('e', 'medium'),
        ];
        const r1 = buildAnalysisNewsItems(rows);
        const r2 = buildAnalysisNewsItems(rows);
        expect(r1.map(i => i.id)).toEqual(r2.map(i => i.id));
        // input이 변이되지 않았는지 (sample IDs 보존)
        expect(rows.map(r => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('빈 배열 input → 빈 배열 output (throw 없음)', () => {
        expect(buildAnalysisNewsItems([])).toEqual([]);
    });

    it('모든 row가 미분석이면 빈 배열 (filter 후 0개)', () => {
        const rows = [
            makeUnanalyzedRow('u1'),
            makeUnanalyzedRow('u2'),
            makeUnanalyzedRow('u3'),
        ];
        expect(buildAnalysisNewsItems(rows)).toEqual([]);
    });
});
