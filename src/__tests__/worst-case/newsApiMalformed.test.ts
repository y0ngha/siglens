vi.mock('@y0ngha/siglens-core', () => ({
    // unused by fmpNewsClient directly, but imported transitively
}));

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

vi.mock('@/shared/config/time', () => ({
    MS_PER_HOUR: 3600000,
}));

import {
    FmpNewsClient,
    normalizeFmpPublishedDate,
    hashUrlToId,
} from '@/entities/news-article/lib/fmpNewsClient';
import { fmpGet } from '@/shared/api/fmp/httpClient';

const mockFmpGet = fmpGet as ReturnType<typeof vi.fn>;

describe('FmpNewsClient malformed data handling', () => {
    const client = new FmpNewsClient();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('filters out items with unparseable publishedDate', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockFmpGet.mockResolvedValue([
            {
                symbol: 'AAPL',
                site: 'Example',
                url: 'https://example.com/valid',
                publishedDate: new Date()
                    .toISOString()
                    .replace('T', ' ')
                    .slice(0, 19),
                title: 'Valid article',
                text: 'Valid body',
            },
            {
                symbol: 'AAPL',
                site: 'Example',
                url: 'https://example.com/bad',
                publishedDate: 'not-a-date-at-all',
                title: 'Bad date',
                text: 'Body',
            },
        ]);

        const result = await client.fetchNews('AAPL', '24h');

        expect(result.length).toBeLessThanOrEqual(2);
        const urls = result.map(r => r.url);
        expect(urls).not.toContain('https://example.com/bad');
        warnSpy.mockRestore();
    });

    it('returns empty array when all items have invalid dates', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockFmpGet.mockResolvedValue([
            {
                symbol: 'AAPL',
                site: 'Example',
                url: 'https://example.com/1',
                publishedDate: 'garbage',
                title: 'A',
                text: 'B',
            },
        ]);

        const result = await client.fetchNews('AAPL', '24h');

        expect(result).toEqual([]);
    });

    it('handles empty response array', async () => {
        mockFmpGet.mockResolvedValue([]);

        const result = await client.fetchNews('AAPL', '7d');

        expect(result).toEqual([]);
    });

    it('propagates FMP 4xx/5xx errors', async () => {
        mockFmpGet.mockRejectedValue(new Error('FMP news/stock 500'));

        await expect(client.fetchNews('AAPL', '24h')).rejects.toThrow(
            'FMP news/stock 500'
        );
    });

    it('returns null for earnings when response is empty', async () => {
        mockFmpGet.mockResolvedValue([]);

        const result = await client.fetchEarningsReport('AAPL');

        expect(result).toBeNull();
    });

    it('returns null for earnings when date fields are missing', async () => {
        mockFmpGet.mockResolvedValue([
            {
                symbol: 'AAPL',
            },
        ]);

        const result = await client.fetchEarningsReport('AAPL');

        expect(result).toBeNull();
    });

    describe('normalizeFmpPublishedDate', () => {
        it('throws for completely invalid date', () => {
            expect(() => normalizeFmpPublishedDate('not-a-date')).toThrow(
                'Invalid FMP publishedDate'
            );
        });

        it('normalizes zoneless datetime to ISO', () => {
            const result = normalizeFmpPublishedDate('2025-01-15 14:30:00');
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('passes through valid ISO dates', () => {
            const iso = '2025-01-15T19:30:00.000Z';
            const result = normalizeFmpPublishedDate(iso);
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('hashUrlToId', () => {
        it('produces different IDs for URLs with same prefix but different paths', () => {
            const id1 = hashUrlToId('https://example.com/article/123');
            const id2 = hashUrlToId('https://example.com/article/456');
            expect(id1).not.toBe(id2);
        });

        it('produces consistent IDs for same URL', () => {
            const url = 'https://example.com/article/789';
            expect(hashUrlToId(url)).toBe(hashUrlToId(url));
        });

        it('returns 32-character string', () => {
            expect(hashUrlToId('https://example.com')).toHaveLength(32);
        });
    });
});
