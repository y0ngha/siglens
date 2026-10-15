vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));
vi.mock('server-only', () => ({}));

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';

describe('getInvestorFlowsFmpProvider (prod)', () => {
    beforeAll(async () => {
        await Promise.all([
            import('@/shared/api/fmp/getInvestorFlowsFmpProvider'),
            import('@/shared/api/fmp/CachedInvestorFlowsFmpProvider'),
        ]);
    }, MODULE_LOAD_TIMEOUT_MS);

    afterEach(() => {
        vi.resetModules();
    });

    it('returns a CachedInvestorFlowsFmpProvider in prod', async () => {
        const { getInvestorFlowsFmpProvider } =
            await import('@/shared/api/fmp/getInvestorFlowsFmpProvider');
        const { CachedInvestorFlowsFmpProvider } =
            await import('@/shared/api/fmp/CachedInvestorFlowsFmpProvider');
        expect(getInvestorFlowsFmpProvider()).toBeInstanceOf(
            CachedInvestorFlowsFmpProvider
        );
    });

    it('returns the same singleton across calls', async () => {
        const { getInvestorFlowsFmpProvider } =
            await import('@/shared/api/fmp/getInvestorFlowsFmpProvider');
        expect(getInvestorFlowsFmpProvider()).toBe(
            getInvestorFlowsFmpProvider()
        );
    });
});

// NOTE: the E2E branch (`require('./FakeInvestorFlowsFmpProvider')`) is not unit-tested: vitest cannot
// resolve the synchronous require (same limitation as getCongressTradesProvider.test.ts). The fake itself is
// covered by FakeInvestorFlowsFmpProvider.test.ts and the gate by createE2EGatedSingleton.test.ts.
