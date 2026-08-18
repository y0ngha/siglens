// vi.mock is hoisted above all imports by vitest — must appear before any import statements.
// getYahooQuote()가 동적 import로 가져오는 모듈이라, 정적 import처럼 vi.mock으로 가로챈다.
const getQuoteOrThrow = vi.fn();
vi.mock('@/shared/api/yahoo/YahooMarketProvider', () => ({
    YahooMarketProvider: class {
        getQuoteOrThrow = getQuoteOrThrow;
    },
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchKrEquityQuoteName } from '@/entities/ticker/lib/krEquityQuoteName';

describe('fetchKrEquityQuoteName', () => {
    beforeEach(() => {
        getQuoteOrThrow.mockReset();
    });

    it('returns the yahoo quote name for a listed symbol', async () => {
        getQuoteOrThrow.mockResolvedValue({
            symbol: '005930.KS',
            price: 274500,
            changesPercentage: 2.42,
            name: 'Samsung Electronics Co., Ltd.',
        });

        const result = await fetchKrEquityQuoteName('005930.KS');

        expect(result).toBe('Samsung Electronics Co., Ltd.');
    });

    it('resolves null ONLY for "not listed" (yahoo quote resolves null)', async () => {
        // 실측: yahoo는 미상장 심볼에 throw가 아니라 undefined를 주고,
        // getQuoteOrThrow가 이를 null로 정규화한다.
        getQuoteOrThrow.mockResolvedValue(null);

        const result = await fetchKrEquityQuoteName('999999.KS');

        expect(result).toBeNull();
    });

    it('propagates an infra failure instead of swallowing it to null, so getAssetInfoResilient can degrade to 200 + noindex rather than notFound()', async () => {
        const error = new Error('[YahooMarketProvider] fetch failed');
        getQuoteOrThrow.mockRejectedValue(error);

        await expect(fetchKrEquityQuoteName('005930.KS')).rejects.toBe(error);
    });
});
