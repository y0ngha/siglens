import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';

vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

describe('getFundamentalDataProvider (prod)', () => {
    // 첫 케이스가 콜드 적재(변환 + 외부 의존 로드)를 본문에서 치르지 않게 미리 받는다.
    // 첫 케이스는 이 레지스트리를 그대로 쓰고, 이후 리셋 뒤 재평가는 변환 결과를 재사용한다.
    beforeAll(async () => {
        await Promise.all([
            import('@/shared/api/fmp/getFundamentalDataProvider'),
            import('@/shared/api/fmp/CachedFundamentalProvider'),
        ]);
    }, MODULE_LOAD_TIMEOUT_MS);

    afterEach(() => {
        vi.resetModules();
    });

    it('returns a CachedFundamentalProvider instance in prod', async () => {
        const { getFundamentalDataProvider } =
            await import('@/shared/api/fmp/getFundamentalDataProvider');
        const { CachedFundamentalProvider } =
            await import('@/shared/api/fmp/CachedFundamentalProvider');
        expect(getFundamentalDataProvider()).toBeInstanceOf(
            CachedFundamentalProvider
        );
    });

    it('returns the same singleton across calls', async () => {
        const { getFundamentalDataProvider } =
            await import('@/shared/api/fmp/getFundamentalDataProvider');
        expect(getFundamentalDataProvider()).toBe(getFundamentalDataProvider());
    });

    it('keeps the FMP path for US symbols', async () => {
        const { getFundamentalDataProvider } =
            await import('@/shared/api/fmp/getFundamentalDataProvider');
        expect(getFundamentalDataProvider('AAPL')).toBe(
            getFundamentalDataProvider()
        );
    });

    it('keeps the FMP path for crypto symbols', async () => {
        const { getFundamentalDataProvider } =
            await import('@/shared/api/fmp/getFundamentalDataProvider');
        expect(getFundamentalDataProvider('BTCUSD')).toBe(
            getFundamentalDataProvider()
        );
    });

    it('routes Korean symbols to a different provider than FMP', async () => {
        // FMP 플랜이 KRX를 커버하지 않아 yahoo 백엔드로 가야 한다.
        const { getFundamentalDataProvider } =
            await import('@/shared/api/fmp/getFundamentalDataProvider');
        expect(getFundamentalDataProvider('005930.KS')).not.toBe(
            getFundamentalDataProvider('AAPL')
        );
    });

    it('FMP 경로의 peer enrich는 한국 peer를 yahoo 경로로 보낸다', async () => {
        // FMP peer 목록에 현대차가 섞여 와도 FMP key-metrics-ttm(한국은 402)을 부르지 않는다.
        const fmpFetch = vi.fn(
            async (path: string, _params: { symbol: string }) =>
                path === 'stock-peers'
                    ? [
                          {
                              symbol: '005380.KS',
                              companyName: 'Hyundai Motor',
                              marketCap: 4e10,
                          },
                      ]
                    : []
        );
        vi.doMock('@/shared/api/fmp/httpClient', () => ({ fmpGet: fmpFetch }));
        vi.doMock('@/shared/cache/redisClient', () => ({
            getRedisClient: () => null,
        }));
        const { getFundamentalDataProvider } =
            await import('@/shared/api/fmp/getFundamentalDataProvider');
        const kr = getFundamentalDataProvider('005380.KS');
        const krMetrics = {
            peRatioTTM: 5,
            priceToSalesRatioTTM: 0.3,
            pbRatioTTM: null,
            pegRatioTTM: null,
            enterpriseValueOverEBITDATTM: null,
            epsTTM: null,
        };
        const krSpy = vi
            .spyOn(kr, 'getKeyMetricsTtm')
            .mockResolvedValue(krMetrics);

        const peers = await getFundamentalDataProvider('F').getStockPeers('F');

        expect(peers).toEqual([
            {
                symbol: '005380.KS',
                companyName: 'Hyundai Motor',
                marketCap: 4e10,
                per: 5,
                psr: 0.3,
            },
        ]);
        expect(krSpy).toHaveBeenCalledWith('005380.KS');
        expect(
            fmpFetch.mock.calls.filter(
                ([, params]) => params.symbol === '005380.KS'
            )
        ).toEqual([]);
        vi.doUnmock('@/shared/api/fmp/httpClient');
        vi.doUnmock('@/shared/cache/redisClient');
    });

    it.each(['005930.KS', '247540.KQ', '005930.ks'])(
        'returns the same KR singleton for %s',
        async symbol => {
            const { getFundamentalDataProvider } =
                await import('@/shared/api/fmp/getFundamentalDataProvider');
            expect(getFundamentalDataProvider(symbol)).toBe(
                getFundamentalDataProvider('005930.KS')
            );
        }
    );
});
