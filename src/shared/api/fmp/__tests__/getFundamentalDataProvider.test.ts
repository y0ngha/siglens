import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

describe('getFundamentalDataProvider (prod)', () => {
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
