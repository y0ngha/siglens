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

/**
 * Score a single search result against the query.
 *
 * Scoring rules (case-insensitive):
 * - Exact field match       → 100
 * - Field starts with query → 70
 * - Field contains query    → 40
 * - No match in any field   → 10  (Fallback floor for a result that the upstream search returned
 *                                   but whose displayed fields don't literally contain the query,
 *                                   e.g. matched on an English name the user didn't type, or a
 *                                   field changed by koreanName enrichment.)
 * - Popular bonus           → +15 (on top of base)
 */

/** Return the relevance score of a single field against the normalised query. */
function fieldScore(field: string, q: string): number {
    const f = field.toLowerCase();
    if (f === q) return 100;
    if (f.startsWith(q)) return 70;
    if (f.includes(q)) return 40;
    return 0;
}

export function scoreSearchRelevance(
    result: ScorableResult,
    query: string,
    isPopular: boolean
): number {
    const q = query.toLowerCase().trim();
    const fields = [result.koreanName, result.symbol, result.name];

    const scores = fields.filter(Boolean).map(field => fieldScore(field!, q));
    const base = Math.max(10, ...scores);

    const popularBonus = isPopular ? 15 : 0;
    return base + popularBonus;
}

/**
 * Re-rank a deduplicated result list by relevance score (DESC).
 * Array.prototype.sort is stable, so same-score results preserve their input order.
 * Does NOT slice — caller is responsible for capping to MAX_SEARCH_RESULTS.
 */
export function rankByRelevance(
    results: TickerSearchResult[],
    query: string
): TickerSearchResult[] {
    const scored = results.map(result => ({
        result,
        score: scoreSearchRelevance(
            result,
            query,
            isPopularSymbol(result.symbol)
        ),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.result);
}
