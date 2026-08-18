// vi.mock is hoisted above all imports by vitest — must appear before any import statements.
// getYahooQuote()가 동적 import로 가져오는 모듈이라, 정적 import처럼 vi.mock으로 가로챈다.
const getQuoteOrThrow = vi.fn();
vi.mock('@/shared/api/yahoo/YahooMarketProvider', () => ({
    YahooMarketProvider: class {
        getQuoteOrThrow = getQuoteOrThrow;
    },
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    /**
     * E2E 빌드에는 외부 키가 없고 다른 provider는 전부 fake로 가는데 이 함수만 yahoo에
     * 직접 붙어 있었다. 큐레이션 카탈로그를 실재 여부의 근거로 삼으면 "시드된 종목은
     * 렌더 / 형상만 맞는 가짜 티커는 404"라는 실제 계약이 그대로 재현된다.
     */
    describe('E2E seam', () => {
        const originalE2E = process.env.E2E_TEST;

        beforeEach(() => {
            process.env.E2E_TEST = '1';
        });

        afterEach(() => {
            if (originalE2E === undefined) delete process.env.E2E_TEST;
            else process.env.E2E_TEST = originalE2E;
        });

        it('카탈로그에 있는 종목은 한글명을 돌려주고 yahoo를 부르지 않는다', async () => {
            await expect(fetchKrEquityQuoteName('005930.KS')).resolves.toBe(
                '삼성전자'
            );
            expect(getQuoteOrThrow).not.toHaveBeenCalled();
        });

        it('소문자 입력도 카탈로그에 걸린다', async () => {
            await expect(fetchKrEquityQuoteName('005930.ks')).resolves.toBe(
                '삼성전자'
            );
        });

        it('카탈로그 밖 코드는 null — 404 계약이 유지된다', async () => {
            await expect(
                fetchKrEquityQuoteName('999999.KS')
            ).resolves.toBeNull();
            expect(getQuoteOrThrow).not.toHaveBeenCalled();
        });
    });
});
