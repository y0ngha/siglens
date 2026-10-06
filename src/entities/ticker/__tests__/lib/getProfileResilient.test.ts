import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FundamentalProfile } from '@y0ngha/siglens-core';
import { getProfileResilient } from '@/entities/ticker/lib/getProfileResilient';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';

// getProfileResilient wraps staticSymbolCache(getProfile); mock the cache to
// drive the three outcomes (profile / null / throw) without FMP or Redis.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(),
}));
// The provider factory pulls in the FMP/yahoo clients; stub it so the import
// graph stays light (the fetcher closure is never invoked under the cache mock).
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForRuntimeDegrade: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: vi.fn(),
}));

const mockCache = vi.mocked(staticSymbolCache);
const mockGetProfile = vi.fn();
vi.mocked(getFundamentalDataProvider).mockImplementation(
    () =>
        ({ getProfile: mockGetProfile }) as unknown as ReturnType<
            typeof getFundamentalDataProvider
        >
);

describe('getProfileResilient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
    });

    it('passes a resolved profile through (degraded: false)', async () => {
        const profile = {
            symbol: 'AAPL',
            sector: 'Technology',
        } as unknown as FundamentalProfile;
        mockCache.mockResolvedValue(profile);

        expect(await getProfileResilient('AAPL')).toEqual({
            profile,
            degraded: false,
        });
    });

    it('passes null (non-existent ticker) through (degraded: false) so the caller can notFound()', async () => {
        mockCache.mockResolvedValue(null);

        expect(await getProfileResilient('ZZZZ')).toEqual({
            profile: null,
            degraded: false,
        });
    });

    it('passes a fetcher that delegates to the provider getProfile(upper) — the actual cache-miss path', async () => {
        const profile = {
            symbol: 'AAPL',
            sector: 'Technology',
        } as unknown as FundamentalProfile;
        mockGetProfile.mockResolvedValue(profile);
        mockCache.mockImplementation(async (_key, _tag, fetcher) => fetcher());

        expect(await getProfileResilient('AAPL')).toEqual({
            profile,
            degraded: false,
        });
        expect(mockGetProfile).toHaveBeenCalledWith('AAPL');
    });

    it('rethrows DYNAMIC_SERVER_USAGE (Next.js control-flow signal, not an infra failure)', async () => {
        const dynamicErr = Object.assign(new Error('Dynamic server usage'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mockCache.mockRejectedValue(dynamicErr);

        await expect(getProfileResilient('AAPL')).rejects.toBe(dynamicErr);
    });

    it('on FMP infra throw → { profile: null, degraded: true } (no throw → 200 noindex, never 500)', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockCache.mockRejectedValue(new Error('[fmpGet] profile HTTP 429'));

        expect(await getProfileResilient('AAPL')).toEqual({
            profile: null,
            degraded: true,
        });
        expect(errorSpy).toHaveBeenCalledWith(
            '[getProfileResilient] FMP profile infra failure, degrading:',
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    it('in E2E mode (no FMP key) the same FMP infra throw degrades SILENTLY — no console.error noise', async () => {
        vi.stubEnv('E2E_TEST', '1');
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockCache.mockRejectedValue(new Error('[fmpGet] profile HTTP 429'));

        // 반환값(degrade)은 비-E2E와 동일하되, E2E에선 로그만 침묵한다 — 비시드
        // ticker마다 FMP 키 부재로 정상 발생하는 degrade가 테스트 출력을 뒤덮지 않게.
        expect(await getProfileResilient('AAPL')).toEqual({
            profile: null,
            degraded: true,
        });
        expect(errorSpy).not.toHaveBeenCalled();

        errorSpy.mockRestore();
    });

    it('degrade 렌더는 revalidate를 5분으로 낮춘다 — 렌더 예산 초과 실패가 24h 굳지 않는다', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mockCache.mockRejectedValue(new Error('timeout'));

        await getProfileResilient('AAPL');
        expect(shortenRevalidateForRuntimeDegrade).toHaveBeenCalledOnce();
        errorSpy.mockRestore();
    });

    it('정상·null 결과는 revalidate를 건드리지 않는다', async () => {
        mockCache.mockResolvedValue(null);
        await getProfileResilient('ZZZZ');
        expect(shortenRevalidateForRuntimeDegrade).not.toHaveBeenCalled();
    });
});
