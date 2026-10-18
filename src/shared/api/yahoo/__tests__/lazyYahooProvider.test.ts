import { describe, expect, it, vi } from 'vitest';

const constructed = vi.fn();
vi.mock('@/shared/api/yahoo/YahooMarketProvider', () => ({
    YahooMarketProvider: class {
        constructor() {
            constructed();
        }
    },
}));

import { loadYahooProvider } from '../lazyYahooProvider';

describe('loadYahooProvider', () => {
    it('creates one provider and reuses it for every caller', async () => {
        const [first, second] = await Promise.all([
            loadYahooProvider(),
            loadYahooProvider(),
        ]);
        const third = await loadYahooProvider();

        expect(first).toBe(second);
        expect(third).toBe(first);
        expect(constructed).toHaveBeenCalledTimes(1);
    });
});
