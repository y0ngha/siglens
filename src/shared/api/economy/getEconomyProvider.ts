import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';
import { isE2E } from '@/shared/api/e2eEnv';
import type { EconomyProvider } from './EconomyProvider';

let cached: EconomyProvider | null = null;

/** /economy용 EconomyProvider — prod에선 FMP, E2E_TEST에선 결정적 Fake. */
export function getEconomyProvider(): EconomyProvider {
    if (cached !== null) return cached;
    if (isE2E()) {
        // Sync factory + gated require — getMarketDataProvider 패턴 미러.
        // FakeEconomyProvider는 fixture를 들고 있어 prod 번들에서 dead로 남기 위함.
        const { FakeEconomyProvider } =
            require('./FakeEconomyProvider') as typeof import('./FakeEconomyProvider');
        cached = new FakeEconomyProvider();
        return cached;
    }
    cached = new FmpEconomyProvider();
    return cached;
}
