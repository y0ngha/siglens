import type { EnrichedNewsItem, NewsImpact } from '@y0ngha/siglens-core';
import {
    MAX_AGGREGATE_NEWS_ITEMS,
    selectAggregateNewsItems,
} from '../lib/newsAnalysisSelection';

function makeItem(id: string, priceImpact: NewsImpact): EnrichedNewsItem {
    return {
        id,
        symbol: 'NVDA',
        source: 'reuters.com',
        url: `https://example.com/${id}`,
        publishedAt: '2026-05-01T12:00:00Z',
        titleEn: `Title ${id}`,
        bodyEn: `Body ${id}`,
        card: {
            titleKo: `제목 ${id}`,
            bodyKo: `본문 ${id}`,
            summaryKo: `요약 ${id}`,
            sentiment: 'neutral',
            category: 'other',
            priceImpact,
        },
    };
}

describe('selectAggregateNewsItems 함수는', () => {
    it('priceImpact 내림차순(high > medium > low > negligible)으로 정렬한다', () => {
        const items = [
            makeItem('a', 'low'),
            makeItem('b', 'high'),
            makeItem('c', 'negligible'),
            makeItem('d', 'medium'),
        ];

        const result = selectAggregateNewsItems(items);

        expect(result.map(i => i.id)).toEqual(['b', 'd', 'a', 'c']);
    });

    it('동일 impact 내에서는 입력 순서(최신순)를 유지한다', () => {
        const items = [
            makeItem('first', 'high'),
            makeItem('second', 'high'),
            makeItem('third', 'high'),
        ];

        const result = selectAggregateNewsItems(items);

        expect(result.map(i => i.id)).toEqual(['first', 'second', 'third']);
    });

    it('25개를 초과하면 priceImpact 상위 25개만 남긴다', () => {
        // 30 low-impact + 5 high-impact. The 5 high must survive; only 20 of
        // the lows fill the remaining slots (25 - 5).
        const lows = Array.from({ length: 30 }, (_, i) =>
            makeItem(`low-${i}`, 'low')
        );
        const highs = Array.from({ length: 5 }, (_, i) =>
            makeItem(`high-${i}`, 'high')
        );
        const items = [...lows, ...highs];

        const result = selectAggregateNewsItems(items);

        expect(result).toHaveLength(MAX_AGGREGATE_NEWS_ITEMS);
        // All 5 high-impact items are kept and come first.
        expect(result.slice(0, 5).map(i => i.id)).toEqual(highs.map(i => i.id));
        // low 항목 중 슬롯을 잃은 것(low-20..low-29)은 결과에 포함되지 않는다.
        expect(
            result.every(
                i =>
                    !(
                        i.id.startsWith('low-') &&
                        Number(i.id.split('-')[1]) >= 20
                    )
            )
        ).toBe(true);
        // low-29 는 20번 슬롯을 초과하므로(5 high + 20 low = 25) 제외된다.
        expect(result.some(i => i.id === 'low-29')).toBe(false);
    });

    it('25개 이하이면 모두 유지한다(정렬만 적용)', () => {
        const items = Array.from({ length: 10 }, (_, i) =>
            makeItem(`x-${i}`, 'medium')
        );

        const result = selectAggregateNewsItems(items);

        expect(result).toHaveLength(10);
    });

    it('입력 배열을 변형하지 않는다', () => {
        const items = [makeItem('a', 'low'), makeItem('b', 'high')];
        const snapshot = items.map(i => i.id);

        selectAggregateNewsItems(items);

        expect(items.map(i => i.id)).toEqual(snapshot);
    });
});
