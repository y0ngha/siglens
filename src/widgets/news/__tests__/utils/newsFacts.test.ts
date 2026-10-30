import {
    MAX_HEADLINES,
    countAnalyzed,
    getHeadlineItems,
    getLatestPublishedAt,
    getSentimentCounts,
} from '@/widgets/news/utils/newsFacts';
import type { NewsDisplayItem } from '@/shared/lib/types';

const item = (over: Partial<Record<string, unknown>>) =>
    ({
        id: 'x',
        title: 'T',
        publishedAt: '2025-01-01T00:00:00Z',
        sentiment: null,
        priceImpact: null,
        ...over,
    }) as unknown as NewsDisplayItem;

describe('getLatestPublishedAt', () => {
    it('가장 최근 값을 고르고 파싱 불가 값은 무시한다', () => {
        expect(
            getLatestPublishedAt([
                item({ publishedAt: '2025-01-01T00:00:00Z' }),
                item({ publishedAt: 'garbage' }),
                item({ publishedAt: '2025-03-01T00:00:00Z' }),
            ])
        ).toBe('2025-03-01T00:00:00Z');
    });

    it('비어 있으면 null이다', () => {
        expect(getLatestPublishedAt([])).toBeNull();
    });
});

describe('sentiment counting', () => {
    const items = [
        item({ sentiment: 'bullish' }),
        item({ sentiment: 'bullish' }),
        item({ sentiment: 'bearish' }),
        item({ sentiment: null }),
    ];

    it('감성별로 센다', () => {
        expect(getSentimentCounts(items)).toEqual({
            bullish: 2,
            neutral: 0,
            bearish: 1,
        });
    });

    it('분석된 기사 수는 sentiment가 있는 것만 센다', () => {
        expect(countAnalyzed(items)).toBe(3);
    });
});

describe('getHeadlineItems', () => {
    it('제목이 빈 기사를 건너뛰고 상한까지만 돌려준다', () => {
        const items = Array.from({ length: MAX_HEADLINES + 3 }, (_, i) =>
            item({ id: `id${i}`, titleKo: i === 0 ? '' : `T${i}` })
        );
        const headlines = getHeadlineItems(items, 'ko');
        expect(headlines).toHaveLength(MAX_HEADLINES);
        expect(headlines[0]!.id).toBe('id1');
    });
});
