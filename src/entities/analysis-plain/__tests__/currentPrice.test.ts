import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGetQuote = vi.fn();

vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: vi.fn(async () => 'us-equity'),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote: mockGetQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: () => ({}),
}));

const { resolveCurrentPrice } = await import('../lib/currentPrice');

/**
 * 이 분기는 한때 SSE 라우트 안에만 있었고, 그래서 프리웜은 현재가 없이 평이화를
 * 구웠다 — 그 결과가 `"현재 주가가 어느 수준인지는 제시된 자료에 명시되어 있지
 * 않지만"`으로 시작하는 산문이었고 그대로 검색 스니펫에 실린다. 두 경로가 공유하는
 * 지금은 여기서 검증한다.
 */
describe('resolveCurrentPrice', () => {
    beforeEach(() => {
        mockGetQuote.mockReset();
    });

    it('payload에 숫자가 있으면 시세를 조회하지 않는다', async () => {
        const price = await resolveCurrentPrice('AAPL', {
            planCheck: { currentPrice: 316.85 },
        });

        expect(price).toBeUndefined();
        expect(mockGetQuote).not.toHaveBeenCalled();
    });

    /**
     * `fundamental`·`news`·`financials` payload에는 숫자 필드가 하나도 없다.
     * 이 경로가 살아 있어야 그 세 탭이 현재가를 얻는다.
     */
    it('숫자가 없으면 시세를 조회해 현재가를 돌려준다', async () => {
        mockGetQuote.mockResolvedValue({ price: 316.85 });

        const price = await resolveCurrentPrice('AAPL', {
            summaryKo: '숫자 없는 산문입니다',
        });

        expect(price).toBe(316.85);
        expect(mockGetQuote).toHaveBeenCalledWith('AAPL');
    });

    it.each([
        ['시세 없음', null],
        ['가격이 0', { price: 0 }],
        ['가격이 숫자가 아님', { price: '316.85' }],
    ])('%s이면 undefined다 — 평이화를 막지 않는다', async (_label, quote) => {
        mockGetQuote.mockResolvedValue(quote);

        expect(
            await resolveCurrentPrice('AAPL', { summaryKo: '산문' })
        ).toBeUndefined();
    });

    it('조회가 던져도 평이화를 막지 않는다', async () => {
        mockGetQuote.mockRejectedValue(new Error('provider down'));

        expect(
            await resolveCurrentPrice('AAPL', { summaryKo: '산문' })
        ).toBeUndefined();
    });
});
