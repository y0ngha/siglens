// 1. vi.mock 선언 — Vitest가 정적 import 전에 호이스팅한다.

vi.mock('next/cache', () => ({
    unstable_cache: (fn: () => unknown) => fn,
}));

const { mockPeekMarketNewsDigestCache } = vi.hoisted(() => ({
    mockPeekMarketNewsDigestCache: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig()),
    peekMarketNewsDigestCache: mockPeekMarketNewsDigestCache,
}));

const { FIXTURE_ROW, mockGetMarketNewsList } = vi.hoisted(() => {
    const row = {
        id: 'm1',
        symbol: '__NEWS_CRYPTO__',
        source: 'CoinWire',
        url: 'https://x/btc',
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: 'BTC ETF inflows',
        titleKo: 'BTC ETF 유입',
        bodyEn: 'body text',
        bodyKo: null,
        summaryKo: '유입',
        sentiment: 'bullish',
        category: 'macro',
        priceImpact: 'high',
        tickers: ['BTCUSD'],
        analyzedAt: new Date(),
    };
    return {
        FIXTURE_ROW: row,
        mockGetMarketNewsList: vi.fn(async () => [row]),
    };
});
vi.mock('../api', () => ({
    getMarketNewsList: mockGetMarketNewsList,
}));

// isEnrichedRow / toEnrichedNewsItem / selectAggregateNewsItems — pass-through,
// identical to submitMarketNewsDigestAction.test.ts: this file tests the peek's
// options parity with the run path, not the row → EnrichedNewsItem mapping.
vi.mock('@/entities/news-article', async orig => ({
    ...(await orig()),
    isEnrichedRow: vi.fn(() => true),
    toEnrichedNewsItem: vi.fn((row: unknown) => row),
    selectAggregateNewsItems: vi.fn((items: unknown[]) => items),
}));

// 2. 정적 import — vi.mock 선언 이후에 배치한다.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { DEFAULT_DIGEST_MODEL_ID } from '../lib/marketNewsConstants';
import { peekMarketNewsDigestStatic } from '../api/marketNewsDigestStaticCache';

const DIGEST_RESULT: NewsAnalysisResponse = {
    currentDriverKo: '흐름',
    keyEventsKo: [],
    upcomingEventsKo: [],
    overallSentiment: 'bullish',
};

describe('peekMarketNewsDigestStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetMarketNewsList.mockResolvedValue([FIXTURE_ROW]);
    });

    it('(Happy) 캐시 hit → digest 그대로 반환', async () => {
        mockPeekMarketNewsDigestCache.mockResolvedValue(DIGEST_RESULT);

        const result = await peekMarketNewsDigestStatic('crypto', 'ko');

        expect(result).toEqual(DIGEST_RESULT);
    });

    it('(Worst) 캐시 miss → null 반환', async () => {
        mockPeekMarketNewsDigestCache.mockResolvedValue(null);

        const result = await peekMarketNewsDigestStatic('crypto', 'ko');

        expect(result).toBeNull();
    });

    it('(Worst) 내부에서 throw해도 null을 반환하고 로그를 남긴다 (침묵 스왈로 금지)', async () => {
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockGetMarketNewsList.mockRejectedValue(new Error('DB down'));

        const result = await peekMarketNewsDigestStatic('crypto', 'ko');

        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[MarketNewsDigest/PeekStatic] failed:',
            expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
    });

    /**
     * run path(`submitMarketNewsDigestAction`)와 정확히 같은 key-participating
     * 옵션을 넘겨야 한다 — core `peekMarketNewsDigestCache`는 이 필드들로
     * 캐시 키를 만들어서, 하나라도 다르면 아무도 쓴 적 없는 키를 읽어 영원히
     * miss한다(core JSDoc 경고). `categoryLabel`/`skipEnqueueIfMiss`/`signal`은
     * 키에 안 들어가므로 여기서 만들지 않는다.
     */
    it('(Happy) run path와 동일한 key-participating 옵션으로 core를 호출한다', async () => {
        mockPeekMarketNewsDigestCache.mockResolvedValue(null);

        await peekMarketNewsDigestStatic('crypto', 'ko');

        // toEnrichedMarketNewsItem's row→shape mapping drops `tickers` (not
        // part of isEnrichedRow's parameter shape) before the mocked
        // toEnrichedNewsItem pass-through, so the expected `news` entry
        // excludes it too.
        const { tickers: _tickers, ...shapedFixtureRow } = FIXTURE_ROW;
        expect(mockPeekMarketNewsDigestCache).toHaveBeenCalledWith({
            category: 'crypto',
            locale: 'ko',
            modelId: DEFAULT_DIGEST_MODEL_ID,
            news: [shapedFixtureRow],
            reasoning: true,
        });
    });

    it('(Happy) 카테고리별로 다른 sentinel을 조회한다', async () => {
        mockPeekMarketNewsDigestCache.mockResolvedValue(null);

        await peekMarketNewsDigestStatic('stock', 'ko');

        expect(mockGetMarketNewsList).toHaveBeenCalledWith('__NEWS_STOCK__');
    });
});
