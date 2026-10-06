import type { TickerSearchResult } from '@/shared/lib/types';

const TICKER_SEARCH_PATH = '/api/search';

/**
 * 티커 검색을 `GET /api/search`로 부른다(클라이언트용).
 *
 * 질의는 공백을 다듬고 소문자로 보낸다 — 서버 캐시 키가 이미 대소문자를 무시하므로
 * (`buildTickerSearchCacheKey`) 결과는 같고, `AAPL`과 `aapl`이 브라우저·CDN 캐시에서 한 항목을
 * 쓰게 된다.
 *
 * `signal`은 TanStack Query가 넘겨준다. 키 입력으로 질의가 바뀌면 지난 요청이 끊긴다 — Server
 * Action으로 부르던 때는 끊을 수 없어 타이핑하는 동안 요청이 차례로 쌓였다.
 */
export async function fetchTickerSearch(
    query: string,
    signal?: AbortSignal
): Promise<TickerSearchResult[]> {
    const params = new URLSearchParams({ q: query.trim().toLowerCase() });
    const response = await fetch(`${TICKER_SEARCH_PATH}?${params}`, {
        signal,
    });
    if (!response.ok) {
        throw new Error(`ticker search HTTP ${response.status}`);
    }
    return (await response.json()) as TickerSearchResult[];
}
