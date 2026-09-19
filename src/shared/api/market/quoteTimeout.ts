import type { MarketDataProvider, MarketQuote } from '@y0ngha/siglens-core';

/**
 * Bound (ms) for a single quote lookup — shared by every consumer that
 * needs "a quote, or give up soon" (agent-chat tools, the analysis SSE
 * route's position-bucket lookup, plain-language current-price enrichment,
 * fundamental-analysis `currentPrice`, ...). FMP 429 storms can push a
 * single `getQuote` call to ~85s (10s request timeout + 10/15/20s backoff);
 * a quote is always a nice-to-have enrichment at these call sites, never a
 * precondition for the underlying result, so a slow/failing provider must
 * degrade within a short bound rather than stall the caller — single
 * source, replacing five separate local `= 5_000` literals.
 */
export const QUOTE_LOOKUP_TIMEOUT_MS = 5_000;

/**
 * Races `provider.getQuote(symbol)` against {@link QUOTE_LOOKUP_TIMEOUT_MS},
 * resolving to `null` on timeout — never rejecting for that reason (a
 * `Promise.race` loser is simply abandoned, not cancelled).
 *
 * Returns the raw `MarketQuote | null` — a failed lookup comes back as
 * `null` (the adapters catch and return `null`, per the core
 * `MarketDataProvider.getQuote` contract). Callers still apply their own
 * validity check — `price > 0` guards against bad upstream data (a zero or
 * negative price) — and field extraction, both of which differ per call site
 * (a plain price, a `{price, dayChangePctRaw}` pair, a nullish-coalesced
 * price for a position bucket, ...) — this helper only owns the bounded
 * fetch, not the validation.
 */
export async function quoteWithTimeout(
    provider: Pick<MarketDataProvider, 'getQuote'>,
    symbol: string
): Promise<MarketQuote | null> {
    return Promise.race([
        provider.getQuote(symbol),
        new Promise<null>(resolve => {
            setTimeout(() => resolve(null), QUOTE_LOOKUP_TIMEOUT_MS).unref();
        }),
    ]);
}
