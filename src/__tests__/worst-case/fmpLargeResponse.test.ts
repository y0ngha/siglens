vi.mock('@y0ngha/siglens-core', () => ({
    createCacheProvider: vi.fn().mockReturnValue(null),
}));

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

vi.mock('@/shared/config/time', () => ({
    MS_PER_HOUR: 3600000,
}));

import { FmpNewsClient } from '@/entities/news-article/lib/fmpNewsClient';
import { fmpGet } from '@/shared/api/fmp/httpClient';

const mockFmpGet = fmpGet as ReturnType<typeof vi.fn>;

function makeRawNews(count: number, baseTime = Date.now()) {
    return Array.from({ length: count }, (_, i) => ({
        symbol: 'AAPL',
        site: `Source${i}`,
        url: `https://example.com/article/${i}`,
        publishedDate: new Date(baseTime - i * 60000)
            .toISOString()
            .replace('T', ' ')
            .slice(0, 19),
        title: `Article ${i}`,
        text: `Body of article ${i}`,
    }));
}

describe('FMP large response handling', () => {
    const client = new FmpNewsClient();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('handles 1000+ news items without error', async () => {
        const largeResponse = makeRawNews(1200);
        mockFmpGet.mockResolvedValue(largeResponse);

        const result = await client.fetchNewsForPeriod(
            'AAPL',
            7 * 24 * 3600000
        );

        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThanOrEqual(1200);
    });

    it('handles empty array from FMP', async () => {
        mockFmpGet.mockResolvedValue([]);

        const result = await client.fetchNews('AAPL', '24h');

        expect(result).toEqual([]);
    });

    it('filters old articles beyond cutoff', async () => {
        const oldArticle = {
            symbol: 'AAPL',
            site: 'OldSource',
            url: 'https://example.com/old',
            publishedDate: '2020-01-01 00:00:00',
            title: 'Old Article',
            text: 'Old body',
        };
        const recentArticle = {
            symbol: 'AAPL',
            site: 'NewSource',
            url: 'https://example.com/new',
            publishedDate: new Date()
                .toISOString()
                .replace('T', ' ')
                .slice(0, 19),
            title: 'New Article',
            text: 'New body',
        };
        mockFmpGet.mockResolvedValue([oldArticle, recentArticle]);

        const result = await client.fetchNews('AAPL', '24h');

        const urls = result.map(r => r.url);
        expect(urls).not.toContain('https://example.com/old');
    });

    it('handles items with missing optional fields', async () => {
        mockFmpGet.mockResolvedValue([
            {
                symbol: 'AAPL',
                site: 'Source',
                url: 'https://example.com/minimal',
                publishedDate: new Date()
                    .toISOString()
                    .replace('T', ' ')
                    .slice(0, 19),
                title: 'Minimal',
                text: '',
            },
        ]);

        const result = await client.fetchNews('AAPL', '24h');

        expect(result.length).toBeLessThanOrEqual(1);
    });

    it('propagates FMP 500 error', async () => {
        mockFmpGet.mockRejectedValue(new Error('FMP news/stock 500'));

        await expect(client.fetchNews('AAPL', '30d')).rejects.toThrow('500');
    });
});
