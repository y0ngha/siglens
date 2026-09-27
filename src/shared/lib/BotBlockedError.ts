/**
 * Sentinel thrown by analysis fetchers when the Server Action returns
 * `miss_no_trigger`. Caught at the hook level and surfaced as `'bot_blocked'`
 * state so the consuming UI can render `BotBlockedNotice` instead of a
 * generic error fallback.
 *
 * **Not bot-specific anymore (2026-09-27).** The name and the `bot_blocked`
 * status literal predate the fix that removed UA-based generation gating —
 * `skipEnqueueIfMiss` is now hardcoded `false` in every axis action except
 * options (see `src/app/api/analysis/stream/route.ts` top invariant), so a
 * live request no longer produces `miss_no_trigger` because the caller was a
 * bot. The status is still reachable via the options-chain `cacheOnly` path
 * and via SEO-prewarm-seeded rows; this sentinel/UI pair is kept for those.
 *
 * Centralized here (alongside `BotBlockedNotice`) so the `useQuery`-based
 * analysis hooks share a single implementation. `useAnalysis`
 * (mutation-based) does not throw this — it cannot, because `useMutation`
 * does not narrow on thrown error subtypes the way `useQuery` does in its
 * error branch derivation.
 */
export class BotBlockedError extends Error {
    readonly isBotBlocked = true as const;
    constructor() {
        super('bot_blocked');
        this.name = 'BotBlockedError';
    }
}
