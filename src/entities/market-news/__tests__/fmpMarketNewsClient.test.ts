import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FmpMarketNewsClient,
    parseArticleTickers,
} from '../lib/fmpMarketNewsClient';
import { MARKET_NEWS_LOOKBACK_MS } from '../lib/marketNewsConstants';

const TEST_API_KEY = 'test-api-key';
const mockFetch = vi.fn();
const originalFetch = global.fetch;
const originalEnv = process.env.FMP_API_KEY;

function mockFetchOnce(body: unknown) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => body,
    } as Response);
}

describe('FmpMarketNewsClient.fetchCategoryNews는', () => {
    beforeEach(() => {
        global.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockReset();
        process.env.FMP_API_KEY = TEST_API_KEY;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.FMP_API_KEY = originalEnv;
        vi.restoreAllMocks();
    });

    it('FMP 응답을 MarketNewsItem으로 매핑하고 sentinel symbol을 부여한다', async () => {
        mockFetchOnce([
            {
                symbol: 'BTCUSD',
                publishedDate: '2026-06-15 10:00:00',
                title: 'BTC up',
                text: 'body',
                site: 'CoinWire',
                url: 'https://x.com/btc',
            },
        ]);
        const items = await new FmpMarketNewsClient().fetchCategoryNews(
            'crypto',
            MARKET_NEWS_LOOKBACK_MS
        );
        expect(items).toHaveLength(1);
        expect(items[0].symbol).toBe('__NEWS_CRYPTO__');
        expect(items[0].tickers).toEqual(['BTCUSD']);
        expect(items[0].titleEn).toBe('BTC up');
    });

    it('lookback 이전 기사는 제외한다', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(
            new Date('2026-06-16T00:00:00Z').getTime()
        );
        mockFetchOnce([
            {
                symbol: 'BTCUSD',
                publishedDate: '2026-01-01 10:00:00',
                title: 'old',
                text: '',
                site: 's',
                url: 'https://x.com/old',
            },
        ]);
        const items = await new FmpMarketNewsClient().fetchCategoryNews(
            'crypto',
            MARKET_NEWS_LOOKBACK_MS
        );
        expect(items).toHaveLength(0);
    });

    it('articles 카테고리는 articles 스키마(link/date/content/tickers)를 매핑한다', async () => {
        mockFetchOnce([
            {
                title: 'Market wrap',
                date: '2026-06-15 11:00:00',
                content: '<p>Some HTML</p>',
                tickers: 'NASDAQ:AAPL,NYSE:MSFT',
                link: 'https://x.com/article',
                author: 'FMP',
                site: 'Financial Modeling Prep',
            },
        ]);
        const items = await new FmpMarketNewsClient().fetchCategoryNews(
            'articles',
            MARKET_NEWS_LOOKBACK_MS
        );
        expect(items).toHaveLength(1);
        expect(items[0].symbol).toBe('__NEWS_ARTICLES__');
        expect(items[0].tickers).toEqual(['AAPL', 'MSFT']);
        expect(items[0].url).toBe('https://x.com/article');
        expect(items[0].titleEn).toBe('Market wrap');
    });

    it('general 카테고리는 tickers를 빈 배열로 반환한다(symbol=null)', async () => {
        mockFetchOnce([
            {
                symbol: null,
                publishedDate: '2026-06-15 10:00:00',
                title: 'Macro update',
                text: 'body',
                publisher: 'Reuters',
                site: 'reuters.com',
                url: 'https://x.com/macro',
            },
        ]);
        const items = await new FmpMarketNewsClient().fetchCategoryNews(
            'general',
            MARKET_NEWS_LOOKBACK_MS
        );
        expect(items).toHaveLength(1);
        expect(items[0].tickers).toEqual([]);
        expect(items[0].source).toBe('Reuters');
    });
});

describe('FmpMarketNewsClient.fetchCategoryNews — tryNormalizeFmpPublishedDate 실패 처리는', () => {
    beforeEach(() => {
        global.fetch = mockFetch as unknown as typeof fetch;
        mockFetch.mockReset();
        process.env.FMP_API_KEY = TEST_API_KEY;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.FMP_API_KEY = originalEnv;
        vi.restoreAllMocks();
    });

    it('날짜 파싱 실패 시 console.warn을 1회 호출하고 해당 아이템을 건너뛴다', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        mockFetchOnce([
            {
                symbol: 'BTCUSD',
                publishedDate: 'INVALID_DATE_STRING',
                title: 'Bad date item',
                text: 'body',
                site: 'CoinWire',
                url: 'https://x.com/bad-date',
            },
            {
                symbol: 'ETHUSD',
                publishedDate: '2026-06-15 10:00:00',
                title: 'Good date item',
                text: 'body',
                site: 'CoinWire',
                url: 'https://x.com/good-date',
            },
        ]);

        const items = await new FmpMarketNewsClient().fetchCategoryNews(
            'crypto',
            MARKET_NEWS_LOOKBACK_MS
        );

        // The item with invalid date is skipped
        expect(items).toHaveLength(1);
        expect(items[0].titleEn).toBe('Good date item');

        // warn called exactly once (dedup by hasWarnedNormalizeFailure flag)
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('failed to normalize date');

        warnSpy.mockRestore();
    });

    it('동일 인스턴스에서 두 번째 실패는 warn을 중복 호출하지 않는다(dedup)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const badItems = [
            {
                symbol: 'BTCUSD',
                publishedDate: 'BAD_1',
                title: 'Bad 1',
                text: '',
                site: 's',
                url: 'https://x.com/b1',
            },
            {
                symbol: 'ETHUSD',
                publishedDate: 'BAD_2',
                title: 'Bad 2',
                text: '',
                site: 's',
                url: 'https://x.com/b2',
            },
        ];

        // First call
        mockFetchOnce(badItems);
        const client = new FmpMarketNewsClient();
        await client.fetchCategoryNews('crypto', MARKET_NEWS_LOOKBACK_MS);

        // warn should be called once despite 2 failures (dedup on instance)
        expect(warnSpy).toHaveBeenCalledTimes(1);

        warnSpy.mockRestore();
    });
});

describe('parseArticleTickers는', () => {
    it('EXCH: prefix를 제거하고 bare 티커를 반환한다', () => {
        expect(parseArticleTickers('NASDAQ:AAPL,NYSE:MSFT')).toEqual([
            'AAPL',
            'MSFT',
        ]);
    });

    it('null/undefined/빈 문자열이면 빈 배열을 반환한다', () => {
        expect(parseArticleTickers(null)).toEqual([]);
        expect(parseArticleTickers(undefined)).toEqual([]);
        expect(parseArticleTickers('')).toEqual([]);
    });

    it('EXCH: 없는 bare 티커도 그대로 반환한다', () => {
        expect(parseArticleTickers('AAPL,MSFT')).toEqual(['AAPL', 'MSFT']);
    });
});
