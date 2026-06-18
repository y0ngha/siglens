import { isE2E } from '@/shared/api/e2eEnv';
import { FmpMarketNewsClient } from './fmpMarketNewsClient';
import type { MarketNewsClientPort } from './marketNewsClientPort';

let cached: MarketNewsClientPort | null = null;

/**
 * Returns the singleton market-news client for the current environment.
 *
 * In E2E mode (`E2E_TEST=1`), returns `FakeMarketNewsClient` which serves
 * deterministic fixture data without touching FMP or env keys. In production,
 * returns `FmpMarketNewsClient`. The singleton is module-level so it is
 * constructed at most once per Next.js worker process.
 */
export function getMarketNewsClient(): MarketNewsClientPort {
    if (cached !== null) return cached;
    if (isE2E()) {
        // safe: require() enables conditional loading to exclude FakeMarketNewsClient from
        // the production bundle; the module path is known-correct at build time.
        const { FakeMarketNewsClient } =
            require('./FakeMarketNewsClient') as typeof import('./FakeMarketNewsClient');
        cached = new FakeMarketNewsClient();
        return cached;
    }
    cached = new FmpMarketNewsClient();
    return cached;
}
