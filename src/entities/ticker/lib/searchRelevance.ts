import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';

export interface ScorableResult {
    symbol: string;
    name: string;
    koreanName?: string;
}

const POPULAR_STOCK_SET = new Set<string>(POPULAR_TICKERS);
const POPULAR_CRYPTO_SET = new Set<string>(POPULAR_CRYPTOS);

export function isPopularSymbol(symbol: string): boolean {
    return POPULAR_STOCK_SET.has(symbol) || POPULAR_CRYPTO_SET.has(symbol);
}

export const EXACT_MATCH_SCORE = 100;
export const PREFIX_MATCH_SCORE = 70;
export const SUBSTRING_MATCH_SCORE = 40;
export const FALLBACK_SCORE = 10;
export const POPULAR_BONUS = 15;

function fieldScore(field: string, q: string): number {
    // Empty query is not a meaningful match — every field startsWith(''), which would
    // incorrectly score everything as PREFIX_MATCH_SCORE; guard before substring tests.
    if (q === '') return 0;
    const f = field.toLowerCase();
    if (f === q) return EXACT_MATCH_SCORE;
    if (f.startsWith(q)) return PREFIX_MATCH_SCORE;
    if (f.includes(q)) return SUBSTRING_MATCH_SCORE;
    return 0;
}

/**
 * Score a single search result against the query.
 *
 * Scoring rules (case-insensitive), best match wins across all fields
 * (koreanName / symbol / name):
 * - Exact field match       → EXACT_MATCH_SCORE
 * - Field starts with query → PREFIX_MATCH_SCORE
 * - Field contains query    → SUBSTRING_MATCH_SCORE
 * - No match in any field   → FALLBACK_SCORE floor (the upstream search returned this result
 *                             but the displayed fields don't literally contain the query —
 *                             e.g. matched on an English name the user didn't type, or a field
 *                             changed by koreanName enrichment.)
 * - Popular bonus           → +POPULAR_BONUS on top of base
 *
 * Edge case — empty/whitespace-only query: after `.trim()` the query becomes `''`.
 * `fieldScore` guards this early (returns 0 for every field), so the base never rises
 * above FALLBACK_SCORE, and `scoreSearchRelevance` returns FALLBACK_SCORE (+ popular
 * bonus). The only active caller (`searchTicker`) short-circuits before an empty query
 * reaches here, but the guard makes the function self-defending.
 */
export function scoreSearchRelevance(
    result: ScorableResult,
    query: string,
    isPopular: boolean
): number {
    const q = query.toLowerCase().trim();
    const fields = [result.koreanName, result.symbol, result.name].filter(
        (f): f is string => Boolean(f)
    );

    const scores = fields.map(field => fieldScore(field, q));
    const base = Math.max(FALLBACK_SCORE, ...scores);

    const popularBonus = isPopular ? POPULAR_BONUS : 0;
    return base + popularBonus;
}

/**
 * Re-rank a deduplicated result list by relevance score (DESC).
 * .toSorted is stable in Node ≥20 / V8, so same-score results preserve their input order.
 * Does NOT slice — caller is responsible for capping to MAX_SEARCH_RESULTS.
 *
 * Generic over `T extends ScorableResult` so the input element type flows through to the
 * return (a `TickerSearchResult[]` in, a `TickerSearchResult[]` out), while still accepting
 * any list whose elements expose the scored fields. This keeps `ScorableResult` as the single
 * shared contract between the scorer and the ranker rather than a parallel narrower type.
 */
export function rankByRelevance<T extends ScorableResult>(
    results: T[],
    query: string
): T[] {
    return results
        .map(result => ({
            result,
            score: scoreSearchRelevance(
                result,
                query,
                isPopularSymbol(result.symbol)
            ),
        }))
        .toSorted((a, b) => b.score - a.score)
        .map(s => s.result);
}
