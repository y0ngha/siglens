const { mockGetDatabaseClient, mockListBySymbol } = vi.hoisted(() => ({
    mockGetDatabaseClient: vi.fn(),
    mockListBySymbol: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));

vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: class {
        listBySymbol = mockListBySymbol;
    },
}));

import { getNewsCardsAction } from '@/entities/news-article/actions/getNewsCardsAction';

describe('getNewsCardsAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetDatabaseClient.mockReturnValue({ db: {} });
    });

    it('returns allowlisted fields only, stripping internal DB fields', async () => {
        mockListBySymbol.mockResolvedValue([
            {
                id: 'news-1',
                publishedAt: '2026-05-25T10:00:00Z',
                titleEn: 'Apple beats earnings',
                titleKo: '애플 실적 발표',
                sentiment: 'bullish',
                category: 'earnings',
                bodyKo: '한국어 본문',
                summaryKo: '요약',
                priceImpact: 'high',
                url: 'https://example.com/1',
                source: 'reuters',
                // Internal fields that should NOT appear in output
                bodyEn: 'English body text',
                symbol: 'AAPL',
                analyzedAt: new Date('2026-05-25T10:30:00Z'),
            },
        ]);

        const result = await getNewsCardsAction('AAPL');

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: 'news-1',
            publishedAt: '2026-05-25T10:00:00Z',
            titleEn: 'Apple beats earnings',
            titleKo: '애플 실적 발표',
            sentiment: 'bullish',
            category: 'earnings',
            bodyKo: '한국어 본문',
            summaryKo: '요약',
            priceImpact: 'high',
            url: 'https://example.com/1',
            source: 'reuters',
        });

        // Ensure internal fields are stripped
        expect(result[0]).not.toHaveProperty('bodyEn');
        expect(result[0]).not.toHaveProperty('symbol');
        expect(result[0]).not.toHaveProperty('analyzedAt');
    });

    it('returns empty array when no news items exist', async () => {
        mockListBySymbol.mockResolvedValue([]);

        const result = await getNewsCardsAction('AAPL');

        expect(result).toEqual([]);
    });

    it('maps multiple rows correctly', async () => {
        mockListBySymbol.mockResolvedValue([
            {
                id: 'news-1',
                publishedAt: '2026-05-25T10:00:00Z',
                titleEn: 'Title 1',
                titleKo: null,
                sentiment: null,
                category: null,
                bodyKo: null,
                summaryKo: null,
                priceImpact: null,
                url: 'https://example.com/1',
                source: 'reuters',
                bodyEn: 'body',
                symbol: 'AAPL',
                analyzedAt: null,
            },
            {
                id: 'news-2',
                publishedAt: '2026-05-25T11:00:00Z',
                titleEn: 'Title 2',
                titleKo: '제목 2',
                sentiment: 'bearish',
                category: 'macro',
                bodyKo: '본문',
                summaryKo: '요약',
                priceImpact: 'low',
                url: 'https://example.com/2',
                source: 'bloomberg',
                bodyEn: 'body 2',
                symbol: 'AAPL',
                analyzedAt: new Date(),
            },
        ]);

        const result = await getNewsCardsAction('AAPL');

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('news-1');
        expect(result[1].id).toBe('news-2');
        expect(result[0]).not.toHaveProperty('bodyEn');
        expect(result[1]).not.toHaveProperty('bodyEn');
    });

    it('preserves null fields in the output', async () => {
        mockListBySymbol.mockResolvedValue([
            {
                id: 'news-1',
                publishedAt: '2026-05-25T10:00:00Z',
                titleEn: 'Pending analysis',
                titleKo: null,
                sentiment: null,
                category: null,
                bodyKo: null,
                summaryKo: null,
                priceImpact: null,
                url: 'https://example.com/1',
                source: 'reuters',
                bodyEn: null,
                symbol: 'AAPL',
                analyzedAt: null,
            },
        ]);

        const result = await getNewsCardsAction('AAPL');

        expect(result[0].titleKo).toBeNull();
        expect(result[0].sentiment).toBeNull();
        expect(result[0].priceImpact).toBeNull();
    });
});
