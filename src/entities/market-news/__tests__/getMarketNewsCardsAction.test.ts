// 1. All vi.mock(...) calls — hoisted by Vitest before any static import

// Mock database client
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));

// Mock the repository so we don't touch the real DB
const mockListByCategory = vi.fn(async () => [
    {
        id: 'm1',
        symbol: '__NEWS_CRYPTO__',
        source: 'CoinWire',
        url: 'https://x/btc',
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: 'BTC up',
        bodyEn: 'body',
        titleKo: 'BTC 상승',
        bodyKo: null,
        summaryKo: '요약',
        sentiment: 'bullish' as const,
        category: 'macro' as const,
        priceImpact: 'high' as const,
        tickers: ['BTCUSD'],
        analyzedAt: new Date('2026-06-15T12:00:00.000Z'),
    },
]);

vi.mock('../api', () => ({
    DrizzleMarketNewsRepository: vi.fn(function () {
        return { listByCategory: mockListByCategory };
    }),
    // 카드 리더는 서버 전용 컬럼(bodyEn/symbol/analyzedAt)을 애초에 select하지
    // 않는다 — 픽스처도 그 형상이어야 한다(감사: 비용 라운드 15).
    getMarketNewsCards: vi.fn(async () => [
        {
            id: 'm1',
            source: 'CoinWire',
            url: 'https://x/btc',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'BTC up',
            titleKo: 'BTC 상승',
            bodyKo: null,
            summaryKo: '요약',
            sentiment: 'bullish',
            category: 'macro',
            priceImpact: 'high',
            tickers: ['BTCUSD'],
        },
    ]),
}));

// 2. Static imports — grouped after all vi.mock() calls
import { describe, it, expect, vi } from 'vitest';
import { getMarketNewsCardsAction } from '../actions/getMarketNewsCardsAction';
import { getMarketNewsCards } from '../api';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';

// 3. Tests
describe('getMarketNewsCardsAction은', () => {
    it('카테고리에 해당하는 매핑된 카드를 반환한다(tickers 포함)', async () => {
        const result = await getMarketNewsCardsAction('crypto');
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');
        expect(result.items).toHaveLength(1);
        const card = result.items[0]!;
        // Core NewsDisplayItem fields
        expect(card.id).toBe('m1');
        expect(card.titleKo).toBe('BTC 상승');
        expect(card.sentiment).toBe('bullish');
        expect(card.source).toBe('CoinWire');
        // Extended: tickers
        expect(card.tickers).toEqual(['BTCUSD']);
    });

    it('빈 버킷이면 ok: true + 빈 items 배열을 반환한다', async () => {
        const { getMarketNewsCards } = await import('../api');
        vi.mocked(getMarketNewsCards).mockResolvedValueOnce([]);
        const result = await getMarketNewsCardsAction('forex');
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');
        expect(result.items).toEqual([]);
    });

    it('예외 발생 시 ok: false + error: "db error"를 반환한다', async () => {
        const { getMarketNewsCards } = await import('../api');
        vi.mocked(getMarketNewsCards).mockRejectedValueOnce(
            new Error('db error')
        );
        const result = await getMarketNewsCardsAction('crypto');
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('expected not ok');
        expect(result.error).toBe('db error');
    });

    /**
     * 3초 폴링 경로다. 상한이 없으면 화면이 다루지 않는 카드까지 매 tick 실어 보내고,
     * `compress: true` 이후로는 그 응답이 매번 오리진에서 gzip된다. 자르는 방향도
     * 함께 고정한다 — `slice(-N)`이면 첫 폴링에서 가장 오래된 카드로 조용히 뒤바뀐다.
     */
    it('상한을 넘으면 앞(최신)에서 상한만큼만 돌려준다', async () => {
        vi.mocked(getMarketNewsCards).mockResolvedValueOnce(
            Array.from(
                { length: NEWS_ROW_SERIALIZATION_LIMIT + 87 },
                (_, i) => ({ id: `c${i}` })
            ) as unknown as Awaited<ReturnType<typeof getMarketNewsCards>>
        );

        const result = await getMarketNewsCardsAction('crypto');

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('expected ok');
        expect(result.items).toHaveLength(NEWS_ROW_SERIALIZATION_LIMIT);
        expect(result.items[0]!.id).toBe('c0');
        expect(result.items.at(-1)!.id).toBe(
            `c${NEWS_ROW_SERIALIZATION_LIMIT - 1}`
        );
    });
});
