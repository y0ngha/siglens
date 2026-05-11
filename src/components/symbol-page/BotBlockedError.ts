/**
 * Sentinel thrown by analysis fetchers when the Server Action gates a bot
 * request by returning `miss_no_trigger`. Caught at the hook level and
 * surfaced as `'bot_blocked'` state so the consuming UI can render
 * `BotBlockedNotice` instead of a generic error fallback.
 *
 * Centralized here (alongside `BotBlockedNotice`) so the three `useQuery`-
 * based analysis hooks (fundamental / news / overall) share a single
 * implementation. `useAnalysis` (mutation-based) does not throw this — it
 * cannot, because `useMutation` does not narrow on thrown error subtypes the
 * way `useQuery` does in its error branch derivation.
 */
export class BotBlockedError extends Error {
    readonly isBotBlocked = true as const;
    constructor() {
        super('bot_blocked');
        this.name = 'BotBlockedError';
    }
}
