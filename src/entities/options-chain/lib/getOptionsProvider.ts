import type { OptionsDataProvider } from '@y0ngha/siglens-core';
import { YahooOptionsAdapter } from './YahooOptionsAdapter';

let cached: OptionsDataProvider | null = null;

/** Returns the app's options data provider (Yahoo in prod, fake under E2E_TEST). */
export function getOptionsProvider(): OptionsDataProvider {
    if (cached !== null) return cached;
    if (process.env.E2E_TEST === '1') {
        // require keeps the fake out of the production bundle.
        const { FakeOptionsDataProvider } =
            require('./FakeOptionsDataProvider') as typeof import('./FakeOptionsDataProvider');
        cached = new FakeOptionsDataProvider();
        return cached;
    }
    cached = new YahooOptionsAdapter();
    return cached;
}
