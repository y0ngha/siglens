import { MS_PER_SECOND } from '@/shared/config/time';
import type { TickerSearchResult } from '@/shared/lib/types';
import { tryReadFmpConfig } from '@y0ngha/siglens-core';
import { toFmpSearchSymbol } from '@/shared/lib/fmpSymbol';
import type { FmpSearchResult } from '../model';

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const FMP_SEARCH_LIMIT = 20;
const FMP_FETCH_TIMEOUT_MS = MS_PER_SECOND * 10;
const US_EXCHANGES: ReadonlySet<string> = new Set([
    'NYSE',
    'NASDAQ',
    'AMEX',
    'CBOE',
    'OTC',
    'PNK',
]);

type FmpEndpoint = 'search-symbol' | 'search-name';

/** getAssetInfo가 쓰는 throwOnInfraFailure(인프라 에러 throw) vs 검색 UI 기본(빈 배열 degrade)을 가르는 옵션. */
interface FmpSearchOptions {
    throwOnInfraFailure?: boolean;
}

/** Type guard validating per-element FMP response shape before trusting it as `FmpSearchResult`. */
function isFmpSearchResultLike(value: unknown): value is FmpSearchResult {
    if (value === null || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.symbol === 'string' &&
        typeof v.name === 'string' &&
        typeof v.currency === 'string' &&
        typeof v.exchange === 'string' &&
        typeof v.exchangeFullName === 'string'
    );
}

/** Filter raw FMP rows down to validated `FmpSearchResult` entries; logs and drops malformed rows. */
function toFmpSearchResults(raw: readonly unknown[]): FmpSearchResult[] {
    const valid = raw.filter(isFmpSearchResultLike);
    const dropped = raw.length - valid.length;
    if (dropped > 0) {
        console.warn(
            `[fmpTickerApi] dropped ${dropped} malformed FMP row(s) (missing required fields)`
        );
    }
    return valid;
}

export function toTickerSearchResult(fmp: FmpSearchResult): TickerSearchResult {
    return {
        symbol: fmp.symbol,
        name: fmp.name,
        exchange: fmp.exchange,
        exchangeFullName: fmp.exchangeFullName,
    };
}

export function filterUsExchanges(
    results: FmpSearchResult[]
): FmpSearchResult[] {
    return results.filter(r => US_EXCHANGES.has(r.exchange));
}

async function fetchFmpEndpoint(
    endpoint: FmpEndpoint,
    query: string,
    options?: FmpSearchOptions
): Promise<FmpSearchResult[]> {
    const throwOnInfraFailure = options?.throwOnInfraFailure ?? false;

    const config = tryReadFmpConfig();
    if (!config) {
        // throwOnInfraFailure(getAssetInfo): 미설정은 인프라 문제 — null→404 캐싱을 막기 위해 throw.
        // 기본(검색 UI): 빈 결과로 degrade.
        if (throwOnInfraFailure)
            throw new Error('[fmpTickerApi] FMP config missing');
        return [];
    }

    // `search-symbol`은 심볼 조회이므로 FMP 표기로 정규화한다 — 미국 dual-class 주식은
    // FMP에서 하이픈 표기다(`BRK.B` → `BRK-B`). 정규화가 없으면 캐시·DB에 없는 dual-class
    // 심볼이 영영 해결되지 않아 하드 404가 된다(`asset_translations`에 점 포함 심볼 0건).
    // 정규화 규칙과 안전성 근거는 `toFmpSearchSymbol` JSDoc 참조.
    //
    // `search-name`은 회사명 질의라 그대로 보낸다 — 대문자화조차 하지 않는다(이름 검색의
    // 입력을 여기서 바꾸면 검색 UI 동작이 조용히 달라진다).
    const normalizedQuery =
        endpoint === 'search-symbol' ? toFmpSearchSymbol(query) : query;

    const params = new URLSearchParams({
        query: normalizedQuery,
        limit: String(FMP_SEARCH_LIMIT),
        apikey: config.apiKey,
    });
    const url = `${FMP_BASE_URL}/${endpoint}?${params}`;

    let res: Response;
    try {
        res = await fetch(url, {
            signal: AbortSignal.timeout(FMP_FETCH_TIMEOUT_MS),
        });
    } catch (e) {
        if (throwOnInfraFailure)
            throw new Error(`[fmpTickerApi] ${endpoint} fetch failed`, {
                cause: e,
            });
        return [];
    }

    if (!res.ok) {
        if (throwOnInfraFailure)
            throw new Error(`[fmpTickerApi] ${endpoint} HTTP ${res.status}`);
        return [];
    }

    let raw: unknown;
    try {
        raw = await res.json();
    } catch (e) {
        if (throwOnInfraFailure)
            throw new Error(`[fmpTickerApi] ${endpoint} JSON parse failed`, {
                cause: e,
            });
        return [];
    }

    // 비배열 응답은 신뢰할 수 없는 형태 — throwOnInfraFailure면 throw해 no-match 오인/캐싱 방지.
    if (!Array.isArray(raw)) {
        if (throwOnInfraFailure)
            throw new Error(
                `[fmpTickerApi] ${endpoint} unexpected non-array response`
            );
        return [];
    }

    // FMP search endpoints return a JSON array of records matching FmpSearchResult.
    // We validate per-element shape with `toFmpSearchResults` so malformed rows
    // (missing required fields) are dropped before reaching downstream consumers
    // (`filterUsExchanges`, `toTickerSearchResult`).
    // 200 + 빈 배열은 정상적인 "매칭 없음"이므로 throwOnInfraFailure여도 throw하지 않는다.
    return toFmpSearchResults(raw);
}

/**
 * `search-symbol` 응답에서 앱 심볼에 해당하는 row를 고른다 — 없으면 첫 US row로 폴백.
 *
 * 정확 일치 비교는 반드시 **FMP 표기** 기준이어야 한다. `searchBySymbol`이 질의를
 * 정규화해 보내므로(`HEI.A` → `HEI-A`) 응답 row의 symbol도 하이픈 형태로 돌아온다.
 * 호출부가 앱 표기(`HEI.A`)와 그대로 비교하면 점 포함 심볼은 절대 일치하지 않아
 * 안전망이 **조용히 죽고**, 최대 20개 US row 중 FMP가 먼저 준 것이 URL에 묶인다.
 *
 * 정규화를 아는 코드를 이 파일 한 곳에 모아 두려고 헬퍼로 뺐다 — 호출부가 각자
 * `toFmpSearchSymbol`을 다시 적용하면 두 곳이 어긋날 수 있다(감사 R3).
 */
export function findExactUsMatch(
    usResults: FmpSearchResult[],
    appSymbol: string
): FmpSearchResult | undefined {
    const fmpQuery = toFmpSearchSymbol(appSymbol);
    return usResults.find(r => r.symbol === fmpQuery) ?? usResults[0];
}

export async function searchBySymbol(
    query: string,
    options?: FmpSearchOptions
): Promise<FmpSearchResult[]> {
    return fetchFmpEndpoint('search-symbol', query, options);
}

export async function searchByName(query: string): Promise<FmpSearchResult[]> {
    return fetchFmpEndpoint('search-name', query);
}
