/**
 * Sentinel thrown by `useOptionsAnalysis` when the Server Action returns
 * `miss_no_trigger`, surfaced as `'cache_miss'` state so the widget renders
 * nothing (no data, no notice) instead of a generic error fallback.
 *
 * **Not bot-related — this is a `cacheOnly` cache miss, not a block.** The
 * only remaining caller that still sets `skipEnqueueIfMiss: true` is the
 * options-chain `cacheOnly` path
 * (`entities/options-chain/actions/optionsActions.ts`) — used when OI is
 * stale and an SSR snapshot narrative already exists, so the caller always
 * pairs `cacheOnly` with `hideView` and this state is never actually
 * visible. Every other axis action hardcodes `skipEnqueueIfMiss: false` (see
 * `src/app/api/analysis/stream/route.ts` top invariant) and can no longer
 * produce `miss_no_trigger`, so they no longer throw this sentinel. (SEO
 * prewarm also hardcodes `skipEnqueueIfMiss: false` — see
 * `src/app/api/cron/seo-prewarm/harvest.ts` — so it cannot produce this
 * status either.)
 */
export class CacheOnlyMissError extends Error {
    readonly isCacheOnlyMiss = true as const;
    constructor() {
        super('cache_miss');
        this.name = 'CacheOnlyMissError';
    }
}
