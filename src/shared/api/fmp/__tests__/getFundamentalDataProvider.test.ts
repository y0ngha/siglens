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
});
