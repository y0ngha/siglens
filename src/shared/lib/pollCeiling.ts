import { ANALYSIS_POLL_MAX_DURATION_MS } from '@/shared/config/pollingConfig';

/**
 * Predicate for the poll-loop hard-ceiling check duplicated across every
 * `Date.now() - pollStartTime >= ANALYSIS_POLL_MAX_DURATION_MS` poll loop
 * (analysis hooks: chart, financials, fundamental, news, options, overall,
 * congress — see {@link ANALYSIS_POLL_MAX_DURATION_MS}'s JSDoc for the
 * per-loop-budget semantics this check enforces).
 *
 * This only extracts the *comparison*. Each call site's reaction to "ceiling
 * exceeded" (throw a domain-specific `Error`, `setState` an error variant,
 * etc.) stays exactly as it was at that call site — do not fold that
 * error-handling into this helper. It must remain a pure boolean check so it
 * stays reusable across call sites with different failure semantics.
 */
export function hasExceededPollCeiling(pollStartTime: number): boolean {
    return Date.now() - pollStartTime >= ANALYSIS_POLL_MAX_DURATION_MS;
}
