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

/** 인기 종목 순위 — 주식 → 암호화폐 순으로 `POPULAR_*` 배열의 선언 순서를 따른다. */
const POPULAR_RANK = new Map<string, number>(
    [...POPULAR_TICKERS, ...POPULAR_CRYPTOS].map((symbol, index) => [
        symbol,
        index,
    ])
);

/** 인기 종목이 아니거나 어느 필드도 일치하지 않을 때의 "가장 나쁜" 값. */
const WORST_RANK = Number.MAX_SAFE_INTEGER;

/** 일치한 필드가 없을 때의 길이. 동률 처리에서 가장 뒤로 보낸다. */
const NO_MATCH_LENGTH = Number.MAX_SAFE_INTEGER;

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

/** 점수와 함께 동률 처리에 쓰는 "가장 잘 맞은 필드의 길이". */
export interface RelevanceMatch {
    score: number;
    /**
     * 최고 점수를 낸 필드 중 **가장 짧은** 필드의 길이. 일치한 필드가 없으면(폴백)
     * `NO_MATCH_LENGTH`.
     *
     * 접두 일치끼리 동점이면(`삼성` → 삼성전자·삼성SDI·삼성바이오로직스가 전부 70) 질의가 이름의
     * 더 큰 부분을 차지하는 쪽이 사용자가 찾는 것일 가능성이 높다 — 그래서 짧은 이름이 먼저다.
     */
    matchLength: number;
}

/**
 * Score a single search result against the query and report how long the best-matching
 * field was (see {@link RelevanceMatch.matchLength}).
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
 * above FALLBACK_SCORE, and the score is FALLBACK_SCORE (+ popular bonus). The only
 * active caller (`searchTicker`) short-circuits before an empty query reaches here,
 * but the guard makes the function self-defending.
 */
export function matchSearchRelevance(
    result: ScorableResult,
    query: string,
    isPopular: boolean
): RelevanceMatch {
    const q = query.toLowerCase().trim();
    const fields = [result.koreanName, result.symbol, result.name].filter(
        (f): f is string => Boolean(f)
    );

    const scored = fields.map(field => ({
        length: field.length,
        score: fieldScore(field, q),
    }));
    const base = Math.max(FALLBACK_SCORE, ...scored.map(f => f.score));

    // 폴백(base가 어느 필드 점수와도 같지 않은 경우)에는 일치한 필드가 없다.
    const matchedLengths = scored
        .filter(f => f.score === base)
        .map(f => f.length);
    const popularBonus = isPopular ? POPULAR_BONUS : 0;
    return {
        score: base + popularBonus,
        matchLength:
            matchedLengths.length === 0
                ? NO_MATCH_LENGTH
                : Math.min(...matchedLengths),
    };
}

/** Score only — see {@link matchSearchRelevance} for the rules. */
export function scoreSearchRelevance(
    result: ScorableResult,
    query: string,
    isPopular: boolean
): number {
    return matchSearchRelevance(result, query, isPopular).score;
}

/**
 * Re-rank a deduplicated result list by relevance.
 *
 * Order: score DESC, then — for equal scores — shorter best-matching field first
 * (`삼성` → 삼성전자 before 삼성바이오로직스), then lower index in the popular lists
 * first (`POPULAR_TICKERS`, then `POPULAR_CRYPTOS`), then input order. The last key is
 * explicit rather than leaning on sort stability so the ranking never depends on the
 * engine; it is what keeps DB order for results nothing else can tell apart.
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
        .map((result, index) => ({
            result,
            index,
            popularRank: POPULAR_RANK.get(result.symbol) ?? WORST_RANK,
            ...matchSearchRelevance(
                result,
                query,
                isPopularSymbol(result.symbol)
            ),
        }))
        .toSorted(
            (a, b) =>
                b.score - a.score ||
                a.matchLength - b.matchLength ||
                a.popularRank - b.popularRank ||
                a.index - b.index
        )
        .map(s => s.result);
}
