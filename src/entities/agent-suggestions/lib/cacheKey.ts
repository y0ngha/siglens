import { SUGGESTIONS_PROMPT_VERSION } from '@y0ngha/siglens-core';
import type { AgentSuggestionsInput } from '../model';

/** {@link suggestionsCacheKey} input — the request shape plus the instant it is being cached for. */
export interface SuggestionsCacheKeyInput extends AgentSuggestionsInput {
    /** Wall-clock instant the key is derived for; the hour bucket comes from this, not `Date.now()`, so callers are testable. */
    readonly now: Date;
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Cache key for one hour's worth of suggestions.
 *
 * Bucketed by UTC hour (not locale-local time) so the key rolls over at a
 * fixed, testable instant regardless of `locale`. `SUGGESTIONS_PROMPT_VERSION`
 * is folded in so a core prompt-text bump busts every cached entry instead of
 * serving stale copy for up to an hour (mirrors `reference_prompt_template_cache_version`).
 *
 * The `:u:${userId}` suffix is added only when the caller has portfolio
 * holdings — a portfolio-less member gets the same market-wide suggestions as
 * every other member in that locale/hour, so there is no reason to fragment
 * the cache per-user in that case.
 */
export function suggestionsCacheKey({
    locale,
    userId,
    portfolioSymbols,
    now,
}: SuggestionsCacheKeyInput): string {
    const hour = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(
        now.getUTCDate()
    )}${pad2(now.getUTCHours())}`;
    const base = `ai:suggest:v1:${SUGGESTIONS_PROMPT_VERSION}:${locale}:${hour}`;
    return portfolioSymbols.length > 0 ? `${base}:u:${userId}` : base;
}
