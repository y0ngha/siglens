import { describe, expect, it } from 'vitest';
import type { MarketNewsCardItem } from '@/entities/market-news/lib/toCardItem';
import { mergeHeadlines } from '../mergeHeadlines';

function row(overrides: Partial<MarketNewsCardItem>): MarketNewsCardItem {
    return {
        id: 'n1',
        publishedAt: '2026-09-01T00:00:00.000Z',
        titleEn: 'Fed holds rates steady',
        titleKo: '연준, 금리 동결',
        sentiment: null,
        category: null,
        bodyKo: null,
        summaryKo: null,
        priceImpact: null,
        url: 'https://example.com/n1',
        source: 'reuters',
        tickers: [],
        ...overrides,
    };
}

describe('mergeHeadlines', () => {
    it('sorts newest first across categories', () => {
        const result = mergeHeadlines(
            [
                {
                    row: row({
                        publishedAt: '2026-09-01T00:00:00.000Z',
                        titleKo: '오래된',
                    }),
                    categoryId: 'general',
                },
                {
                    row: row({
                        publishedAt: '2026-09-05T00:00:00.000Z',
                        titleKo: '최신',
                    }),
                    categoryId: 'stock',
                },
            ],
            'ko',
            8
        );
        expect(result.map(h => h.title)).toEqual(['최신', '오래된']);
    });

    it('keeps input order for equal timestamps', () => {
        const result = mergeHeadlines(
            [
                { row: row({ titleKo: 'A' }), categoryId: 'general' },
                { row: row({ titleKo: 'B' }), categoryId: 'stock' },
            ],
            'ko',
            8
        );
        expect(result.map(h => h.title)).toEqual(['A', 'B']);
    });

    it('truncates to max after sorting', () => {
        const result = mergeHeadlines(
            [
                {
                    row: row({
                        publishedAt: '2026-09-01T00:00:00.000Z',
                        titleKo: 'old',
                    }),
                    categoryId: 'general',
                },
                {
                    row: row({
                        publishedAt: '2026-09-02T00:00:00.000Z',
                        titleKo: 'new',
                    }),
                    categoryId: 'general',
                },
            ],
            'ko',
            1
        );
        expect(result).toEqual([{ title: 'new', category: 'general' }]);
    });

    it('attaches the first ticker as symbol only when present', () => {
        const result = mergeHeadlines(
            [
                {
                    row: row({
                        publishedAt: '2026-09-02T00:00:00.000Z',
                        titleKo: 'with',
                        tickers: ['AAPL', 'MSFT'],
                    }),
                    categoryId: 'stock',
                },
                {
                    row: row({ titleKo: 'without', tickers: [] }),
                    categoryId: 'general',
                },
            ],
            'ko',
            8
        );
        expect(result).toEqual([
            { title: 'with', category: 'stock', symbol: 'AAPL' },
            { title: 'without', category: 'general' },
        ]);
    });

    it('resolves the title for the given locale', () => {
        const result = mergeHeadlines(
            [{ row: row({}), categoryId: 'general' }],
            'en',
            8
        );
        expect(result[0]?.title).toBe('Fed holds rates steady');
    });
});
