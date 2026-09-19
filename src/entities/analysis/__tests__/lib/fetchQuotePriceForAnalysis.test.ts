import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetQuote = vi.fn();

vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn(async () => null),
}));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: vi.fn(async () => 'us-equity'),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote: mockGetQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: () => ({}),
}));

import { fetchQuotePriceForAnalysis } from '@/entities/analysis/lib/fetchQuotePriceForAnalysis';

describe('fetchQuotePriceForAnalysis', () => {
    beforeEach(() => {
        mockGetQuote.mockReset();
    });

    it('유효한 시세가 있으면 가격을 반환한다', async () => {
        mockGetQuote.mockResolvedValue({ price: 316.85 });

        expect(await fetchQuotePriceForAnalysis('AAPL')).toBe(316.85);
    });

    it.each([
        ['시세 없음', null],
        ['가격이 0', { price: 0 }],
        ['가격이 숫자가 아님', { price: '316.85' }],
    ])('%s이면 undefined다', async (_label, quote) => {
        mockGetQuote.mockResolvedValue(quote);

        expect(await fetchQuotePriceForAnalysis('AAPL')).toBeUndefined();
    });

    it('조회가 throw해도 undefined로 degrade되고, 에러 name만 로그한다(message는 절대 노출하지 않는다)', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const error = new Error('bound param: userId=u1-secret leaked here');
        error.name = 'DrizzleQueryError';
        mockGetQuote.mockRejectedValue(error);

        const result = await fetchQuotePriceForAnalysis('AAPL');

        expect(result).toBeUndefined();
        expect(spy).toHaveBeenCalledWith(
            '[fetchQuotePriceForAnalysis] quote lookup failed, degrading to undefined:',
            { errorName: 'DrizzleQueryError' }
        );
        const loggedArgs = spy.mock.calls.find(
            call =>
                call[0] ===
                '[fetchQuotePriceForAnalysis] quote lookup failed, degrading to undefined:'
        );
        expect(JSON.stringify(loggedArgs)).not.toContain('u1-secret');
    });
});
