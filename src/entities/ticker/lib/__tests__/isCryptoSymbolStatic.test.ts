/**
 * Unit tests for `isCryptoSymbolStatic`.
 *
 * Verifies:
 *   1. Symbol is uppercased before being passed to `isCryptoSymbol`.
 *   2. `unstable_cache` is called with the correct key, tags, and revalidate TTL.
 *   3. The wrapped function returns the result from `isCryptoSymbol`.
 *
 * `unstable_cache` is mocked as a transparent pass-through so the inner fetcher
 * is always invoked — this lets us assert the key/tags/revalidate config while
 * still exercising the real isCryptoSymbol → wrapper call chain.
 *
 * Mirrors mock conventions in `cryptoAssetStore.test.ts`.
 */

// MISTAKES §17: all vi.mock above imports.
const mockIsCryptoSymbol = vi.fn<(symbol: string) => Promise<boolean>>();

vi.mock('../cryptoAssetStore', () => ({
    isCryptoSymbol: (symbol: string) => mockIsCryptoSymbol(symbol),
}));

/**
 * unstable_cache is mocked as a pass-through wrapper:
 *   unstable_cache(fn, key, options)() → fn()
 * This lets us capture the `key` and `options` arguments while still calling
 * the inner fetcher so the return value flows through to the caller.
 */
const mockUnstableCache = vi.fn(
    (
        fn: () => Promise<boolean>,
        _key: string[],
        _options: { revalidate: number; tags: string[] }
    ) => fn
);

vi.mock('next/cache', () => ({
    unstable_cache: (...args: Parameters<typeof mockUnstableCache>) =>
        mockUnstableCache(...args),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { isCryptoSymbolStatic } from '../isCryptoSymbolStatic';

describe('isCryptoSymbolStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uppercases the symbol before calling isCryptoSymbol', async () => {
        mockIsCryptoSymbol.mockResolvedValue(true);

        await isCryptoSymbolStatic('btcusd');

        expect(mockIsCryptoSymbol).toHaveBeenCalledWith('BTCUSD');
    });

    it('already-uppercase symbol passes through unchanged', async () => {
        mockIsCryptoSymbol.mockResolvedValue(false);

        await isCryptoSymbolStatic('ETHUSD');

        expect(mockIsCryptoSymbol).toHaveBeenCalledWith('ETHUSD');
    });

    it('calls unstable_cache with key [crypto-membership, UPPER]', async () => {
        mockIsCryptoSymbol.mockResolvedValue(false);

        await isCryptoSymbolStatic('btcusd');

        expect(mockUnstableCache).toHaveBeenCalledOnce();
        const [, key] = mockUnstableCache.mock.calls[0];
        expect(key).toEqual(['crypto-membership', 'BTCUSD']);
    });

    it('calls unstable_cache with revalidate = SECONDS_PER_DAY (24h)', async () => {
        mockIsCryptoSymbol.mockResolvedValue(false);

        await isCryptoSymbolStatic('btcusd');

        const [, , options] = mockUnstableCache.mock.calls[0];
        expect(options.revalidate).toBe(SECONDS_PER_DAY);
    });

    it('calls unstable_cache with tags = [symbol:UPPER]', async () => {
        mockIsCryptoSymbol.mockResolvedValue(false);

        await isCryptoSymbolStatic('btcusd');

        const [, , options] = mockUnstableCache.mock.calls[0];
        expect(options.tags).toEqual(['symbol:BTCUSD']);
    });

    it('returns true when isCryptoSymbol resolves true', async () => {
        mockIsCryptoSymbol.mockResolvedValue(true);

        const result = await isCryptoSymbolStatic('BTCUSD');

        expect(result).toBe(true);
    });

    it('returns false when isCryptoSymbol resolves false', async () => {
        mockIsCryptoSymbol.mockResolvedValue(false);

        const result = await isCryptoSymbolStatic('AAPL');

        expect(result).toBe(false);
    });
});
