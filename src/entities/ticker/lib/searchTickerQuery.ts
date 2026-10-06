import { searchTicker } from './searchTicker';
import { isE2E } from '@/shared/api/e2eEnv';
import type { TickerSearchResult } from '@/shared/lib/types';

/**
 * Deterministic AAPL-family fixture returned under E2E_TEST so the ticker
 * autocomplete renders real options without a live FMP call (CI has no
 * FMP_API_KEY). Mirrors the E2E short-circuit pattern used by the data-provider
 * factories (getMarketDataProvider, getFundamentalDataProvider, etc.).
 *
 * Crypto entries (BTCUSD/ETHUSD) are included so that Korean-name searches
 * (e.g. "비트코") surface the expected crypto result with the 코인 badge in
 * the autocomplete dropdown. The koreanName values mirror what seed.ts writes
 * to crypto_assets so the fixture is consistent with the seeded DB.
 */
const E2E_TICKER_FIXTURE: ReadonlyArray<TickerSearchResult> = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Select',
        koreanName: '애플',
    },
    {
        symbol: 'AAPU',
        name: 'Direxion Daily AAPL Bull 2X Shares',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Market',
    },
    {
        symbol: 'AAPD',
        name: 'Direxion Daily AAPL Bear 1X Shares',
        exchange: 'NASDAQ',
        exchangeFullName: 'NASDAQ Global Market',
    },
    {
        symbol: 'BTCUSD',
        name: 'Bitcoin USD',
        exchange: 'CRYPTO',
        exchangeFullName: 'Cryptocurrency',
        koreanName: '비트코인',
        marketProfile: 'crypto',
    },
    {
        symbol: 'ETHUSD',
        name: 'Ethereum USD',
        exchange: 'CRYPTO',
        exchangeFullName: 'Cryptocurrency',
        koreanName: '이더리움',
        marketProfile: 'crypto',
    },
];

/**
 * 질의 길이 상한(`GET /api/search`가 400으로 거절한다). 티커·회사명·한국어 이름 어느 것도
 * 이보다 길지 않다 — 그 이상은 FMP와 캐시 키에 의미 없는 부하만 준다.
 */
export const MAX_SEARCH_QUERY_LENGTH = 100;

/**
 * 티커 검색 한 건 — `GET /api/search`(라우트 핸들러)가 부른다.
 *
 * 예전에는 Server Action(`searchTickerAction`)이었다. Server Action은 POST라 브라우저도
 * CDN도 캐시하지 못하고, 취소되지 않으며, 다른 액션과 한 줄로 한 번에 하나씩 나간다 —
 * 타이핑 중 검색이 서로의 뒤에, 그리고 같은 화면의 다른 액션 뒤에 쌓였다. 로직은 그대로
 * 두고 전송만 GET으로 옮겼다.
 */
export async function searchTickerQuery(
    query: string
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (isE2E()) {
        // Hermetic E2E path: never touch FMP. Filter the fixture by the typed
        // query (symbol, name, or koreanName — case-insensitive so Korean
        // prefix queries like "비트코" match the BTCUSD entry); fall back to
        // the full fixture set so the listbox is never empty.
        const needle = trimmed.toLowerCase();
        const matches = E2E_TICKER_FIXTURE.filter(
            t =>
                t.symbol.toLowerCase().includes(needle) ||
                t.name.toLowerCase().includes(needle) ||
                (t.koreanName?.toLowerCase().includes(needle) ?? false)
        );
        return matches.length > 0 ? matches : [...E2E_TICKER_FIXTURE];
    }

    return searchTicker(trimmed);
}
