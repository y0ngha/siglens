import { unstable_cache } from 'next/cache';
import { isCryptoSymbol } from './cryptoAssetStore';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/**
 * ISR static-safe crypto membership predicate. Wraps `isCryptoSymbol` (raw
 * Neon POST fetch) in Next.js `unstable_cache` so ISR cold-gen does not
 * encounter a no-store fetch that throws `DYNAMIC_SERVER_USAGE`.
 *
 * Why wrap here rather than change `isCryptoSymbol` itself:
 * `isCryptoSymbol` is called on hot paths (getAssetInfo, search) where the
 * module-level `cryptoSymbolCache` Map already provides in-process dedup; that
 * path does not need `unstable_cache`. Adding `unstable_cache` directly to
 * `isCryptoSymbol` would conflate two caching layers (Map + Next cache) on the
 * hot path without benefit, and would make the hot-path DB read un-bypassable
 * on cold server starts. Keeping the `unstable_cache` wrapper here gives the
 * ISR cold-gen path of the page-level tab guard a cache-wrapped DB read, while
 * the hot path continues to use the faster in-process Map dedup.
 *
 * Why not wrap inside `isTabAllowedForSymbol` with an inline `unstable_cache`
 * call per invocation: This file keeps the two concerns (DB read vs cache
 * wrapper) in separate, testable units and mirrors the `getAssetInfoStatic.ts`
 * pattern (wrapping the inner fetch, not the outer predicate).
 *
 * revalidate=24h matches `getAssetInfoStatic`'s TTL — the crypto universe is
 * essentially static between deploys and the `symbol:UPPER` tag allows
 * on-demand invalidation via `revalidateTag` if needed.
 *
 * Per-call closure is intentional: `unstable_cache` options (including `tags`)
 * are static per closure instance, so a module-level singleton cannot carry a
 * per-symbol `tags: ['symbol:UPPER']` value. Creating a new closure each call
 * is the only way to attach the per-symbol tag for targeted `revalidateTag`
 * invalidation. Data Cache correctness is key-based, so the per-call closure
 * has no correctness cost; React `cache()` request-level dedup by function
 * identity does not apply here, but the persistent Data Cache dedup by key does.
 *
 * Graceful degradation: the underlying `isCryptoSymbol` already catches DB
 * errors and returns `false` (= treat as not-crypto), so error behavior is
 * unchanged through this wrapper.
 */
export function isCryptoSymbolStatic(symbol: string): Promise<boolean> {
    const upper = symbol.toUpperCase();
    return unstable_cache(
        () => isCryptoSymbol(upper),
        ['crypto-membership', upper],
        { revalidate: SECONDS_PER_DAY, tags: [`symbol:${upper}`] }
    )();
}
