import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import type { TickerSearchResult } from '@/shared/lib/types';

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

/**
 * Score a single search result against the query.
 *
 * Scoring rules (case-insensitive):
 * - Exact field match       → EXACT_MATCH_SCORE (100)
 * - Field starts with query → PREFIX_MATCH_SCORE (70)
 * - Field contains query    → SUBSTRING_MATCH_SCORE (40)
 * - No match in any field   → FALLBACK_SCORE (10)  (Fallback floor for a result that the upstream
 *                                                    search returned but whose displayed fields don't
 *                                                    literally contain the query, e.g. matched on an
 *                                                    English name the user didn't type, or a field
 *                                                    changed by koreanName enrichment.)
 * - Popular bonus           → +POPULAR_BONUS (15) (on top of base)
 */

/** Return the relevance score of a single field against the normalised query. */
function fieldScore(field: string, q: string): number {
    const f = field.toLowerCase();
    if (f === q) return EXACT_MATCH_SCORE;
    if (f.startsWith(q)) return PREFIX_MATCH_SCORE;
    if (f.includes(q)) return SUBSTRING_MATCH_SCORE;
    return 0;
}

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
 */
export function rankByRelevance(
    results: TickerSearchResult[],
    query: string
): TickerSearchResult[] {
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
