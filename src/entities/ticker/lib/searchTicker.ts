import { deduplicateResults, isKoreanInput } from './ticker';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import {
    buildTickerSearchCacheKey,
    TICKER_SEARCH_CACHE_TTL,
} from './cacheKeys';
import {
    filterUsExchanges,
    searchByName,
    searchBySymbol,
    toTickerSearchResult,
} from './fmpTickerApi';
import { translateCompanyNames } from './koreanTranslator';
import {
    getKoreanNames,
    searchByKoreanName,
    setKoreanTickers,
} from './koreanNameStore';
import { searchCryptoAssets } from './cryptoAssetStore';
import { searchKrEquity } from './krEquitySearch';
import { rankByRelevance } from './searchRelevance';
import { fireAndForget, type BackgroundTaskOptions } from './backgroundTask';
import { createSingleFlight } from './utils/singleFlight';
import { createCacheProvider } from '@y0ngha/siglens-core';
import type { KoreanTickerEntry, TickerSearchResult } from '@/shared/lib/types';

export const MAX_SEARCH_RESULTS = 10;

function toKoreanEntry(
    symbol: string,
    koreanName: string,
    unmappedMap: Map<string, TickerSearchResult>
): KoreanTickerEntry[] {
    const result = unmappedMap.get(symbol);
    if (!result) return [];
    return [
        {
            symbol,
            koreanName,
            name: result.name,
            exchange: result.exchange,
            exchangeFullName: result.exchangeFullName,
        },
    ];
}

/** Single-flight registry keyed by sorted-symbol list; collapses concurrent identical search queries into one translation call. */
const translationSingleFlight = createSingleFlight<void>();

function buildInFlightKey(symbols: readonly string[]): string {
    return [...symbols].sort().join(',');
}

function translateAndCache(unmapped: TickerSearchResult[]): Promise<void> {
    const key = buildInFlightKey(unmapped.map(r => r.symbol));
    return translationSingleFlight.run(key, async () => {
        const translated = await translateCompanyNames(
            unmapped.map(r => ({ symbol: r.symbol, name: r.name }))
        );

        const unmappedMap = new Map(unmapped.map(r => [r.symbol, r]));

        const entries = Object.entries(translated).flatMap<KoreanTickerEntry>(
            ([symbol, koreanName]) =>
                toKoreanEntry(symbol, koreanName, unmappedMap)
        );

        await setKoreanTickers(entries);
    });
}

/** @internal Test helper — clears the in-flight registry between cases. */
export function _resetInFlightTranslationsForTest(): void {
    translationSingleFlight._resetForTest();
}

/**
 * 구두점과 연속 공백만 지운다.
 *
 * 법인격 접미사(`Co`/`Ltd`/`Inc`)까지 지우는 안을 검토했다가 뺐다 — 실측한 유일한
 * 쌍(`SSNLF` vs `005930.KS`)은 FMP와 yahoo가 **같은** 표기(`Samsung Electronics
 * Co., Ltd.`)를 주고, 구두점만 지우면 이미 일치한다. 접미사까지 지우면 매칭만
 * 느슨해져 서로 다른 회사를 묶을 위험이 생기는데, 그걸 정당화할 실제 사례가 없다.
 */
function normalizedEnglishName(r: TickerSearchResult): string {
    return (r.name ?? '')
        .toLowerCase()
        .replace(/[.,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 같은 회사의 KRX 상장을 그 회사의 미국 장외(OTC) 중복 **바로 앞**에 놓는다.
 *
 * `삼성전자`는 `005930.KS`(KOSPI 주 상장, 원화)와 `SSNLF`(Other OTC, 비후원, 거래
 * 희박) 둘 다로 잡힌다. 둘 다 보여주되 — 의도적으로 OTC를 찾는 사용자를 막지
 * 않는다 — 기본값은 주 상장이어야 한다.
 *
 * **목록 끝으로 미는 게 아니라 짝 옆에 붙이는 이유**: 호출부가 곧바로
 * `slice(0, MAX_SEARCH_RESULTS)`한다. `삼성`처럼 같은 접두를 가진 종목이 많은 질의는
 * 결과가 10개를 쉽게 넘으므로, 끝으로 밀면 강등이 아니라 **삭제**가 된다(영문 경로는
 * 그 결과를 캐시에 써서 TTL 동안 고정시킨다). 짝을 붙여 두면 컷이 둘을 함께 자른다.
 *
 * 매칭 키는 한글명 **또는** 영문명이다. 한글명만 보면 영문 질의 경로에서 조용히
 * 아무 일도 일어나지 않는다 — 그 경로의 KRX 행에는 한글명이 안 붙어 있을 수 있다.
 * 영문명 비교는 구두점·연속 공백만 지우고 한다(법인격 접미사는 일부러 남긴다 —
 * 이유는 `normalizedEnglishName` 주석 참고).
 */
function preferPrimaryListing(
    results: TickerSearchResult[]
): TickerSearchResult[] {
    const isKrx = (r: TickerSearchResult) => isKrEquitySymbol(r.symbol);
    const isOtc = (r: TickerSearchResult) =>
        (r.exchangeFullName ?? '').toLowerCase().includes('otc');
    const koreanNameOf = (r: TickerSearchResult) =>
        (r.koreanName ?? '').trim().toLowerCase();

    const krxRows = results.filter(isKrx);
    if (krxRows.length === 0) return results;

    // 같은 회사의 KRX 상장이 목록에 있는 OTC 항목만 대상이다. 무조건 OTC를 내리면
    // OTC만 있는 종목의 순위가 이유 없이 떨어진다.
    const matchingKrx = (otc: TickerSearchResult) => {
        const ko = koreanNameOf(otc);
        const en = normalizedEnglishName(otc);
        return krxRows.find(
            krx =>
                (ko.length > 0 && koreanNameOf(krx) === ko) ||
                (en.length > 0 && normalizedEnglishName(krx) === en)
        );
    };

    const attachedTo = new Map<string, TickerSearchResult[]>();
    const demoted = new Set<TickerSearchResult>();
    for (const row of results) {
        if (isKrx(row) || !isOtc(row)) continue;
        const krx = matchingKrx(row);
        if (!krx) continue;
        demoted.add(row);
        const bucket = attachedTo.get(krx.symbol);
        if (bucket) bucket.push(row);
        else attachedTo.set(krx.symbol, [row]);
    }
    if (demoted.size === 0) return results;

    return results.flatMap(row =>
        demoted.has(row) ? [] : [row, ...(attachedTo.get(row.symbol) ?? [])]
    );
}

/** Search for tickers by symbol or company name with bilingual support; Korean queries hit the Korean-name store, others hit FMP via cache with background translation enrichment (capped at 10 entries). */
export async function searchTicker(
    query: string,
    options?: BackgroundTaskOptions
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (isKoreanInput(trimmed)) {
        // Stock Korean names come from the korean_tickers table; crypto Korean names
        // come from crypto_assets.korean_name. Run both in parallel so a single
        // Korean keypress (e.g. "비트코") surfaces both stock and crypto matches.
        const [stockResults, cryptoResults] = await Promise.all([
            searchByKoreanName(trimmed),
            // Isolated catch so a crypto DB error doesn't discard stock results.
            searchCryptoAssets(trimmed).catch((): TickerSearchResult[] => []),
        ]);
        // deduplicateResults guards the unlikely case where a symbol exists in both stores.
        // 한글 질의가 바로 이 중복이 생기는 경로다 — `삼성전자`가 KOSPI 상장과
        // 미국 장외 비후원(SSNLF) 둘 다로 잡힌다. 영문 경로에만 걸면 정작 문제가
        // 생기는 쪽에는 적용되지 않는다.
        const ranked = preferPrimaryListing(
            rankByRelevance(
                deduplicateResults([...stockResults, ...cryptoResults]),
                trimmed
            )
        );
        return ranked.slice(0, MAX_SEARCH_RESULTS);
    }

    const cache = createCacheProvider();
    const cacheKey = buildTickerSearchCacheKey(trimmed);

    if (cache) {
        try {
            const cached = await cache.get<TickerSearchResult[]>(cacheKey);
            if (cached) return cached;
        } catch {
            // Graceful degradation: cache read failure falls through to provider fetch.
        }
    }

    const [symbolResults, nameResults, cryptoResults, krResults] =
        await Promise.all([
            searchBySymbol(trimmed),
            searchByName(trimmed),
            searchCryptoAssets(trimmed),
            // 코드 형상(`005930`)과 라틴 회사명(`samsung`) 질의를 yahoo에 태운다 —
            // 한글·1자 질의는 즉시 빈 배열이다(krEquitySearch.ts 참조). 미국 질의도
            // 태우지만 이 `Promise.all` 안이라 추가 비용은 합이 아니라 최댓값이고,
            // 실패는 아래 `.catch`가 빈 배열로 degrade시킨다.
            searchKrEquity(trimmed).catch((): TickerSearchResult[] => []),
        ]);

    const merged = deduplicateResults([
        ...filterUsExchanges(symbolResults).map(toTickerSearchResult),
        ...filterUsExchanges(nameResults).map(toTickerSearchResult),
        ...cryptoResults,
        ...krResults,
    ]);

    const koreanNames = await getKoreanNames(merged.map(r => r.symbol));

    const enriched = merged.map(result => ({
        ...result,
        koreanName: koreanNames[result.symbol],
    }));

    const unmapped = enriched.filter(r => !r.koreanName);
    if (unmapped.length > 0) {
        fireAndForget(
            translateAndCache(unmapped).catch(e =>
                console.warn('[searchTicker] background translation failed', e)
            ),
            options
        );
    }

    const ranked = preferPrimaryListing(rankByRelevance(enriched, trimmed));
    const final = ranked.slice(0, MAX_SEARCH_RESULTS);

    if (cache) {
        fireAndForget(
            cache
                .set(cacheKey, final, TICKER_SEARCH_CACHE_TTL)
                .catch(e =>
                    console.warn('[searchTicker] cache write failed', e)
                ),
            options
        );
    }

    return final;
}
