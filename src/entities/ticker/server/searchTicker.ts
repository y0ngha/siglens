import { deduplicateResults, isKoreanInput } from '../lib/ticker';
import {
    API_UNTRANSLATED_CACHE_TTL,
    buildApiTickerSearchCacheKey,
    buildTickerSearchCacheKey,
    TICKER_SEARCH_CACHE_TTL,
} from '../lib/cacheKeys';
import {
    filterUsExchanges,
    searchByName,
    searchBySymbol,
    toTickerSearchResult,
} from './fmpTickerApi';
import { isServerLlmAllowed } from '@/shared/lib/serverLlmPolicy';
import { translateCompanyNames } from './koreanTranslator';
import {
    getKoreanNames,
    searchByKoreanName,
    setKoreanTickers,
} from './koreanNameStore';
import { searchCryptoAssets } from './cryptoAssetStore';
import { searchKrEquity } from './krEquitySearch';
import { preferPrimaryListing } from '../lib/preferPrimaryListing';
import { rankByRelevance } from '../lib/searchRelevance';
import {
    fireAndForget,
    type BackgroundTaskOptions,
} from '@/shared/lib/backgroundTask';
import {
    createSingleFlight,
    __resetSingleFlightForTests,
} from '@/shared/lib/singleFlight';
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

/** 정렬한 심볼 목록을 키로 하는 single-flight 레지스트리 — 같은 검색 질의의 동시 번역 호출을 하나로 합친다. */
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

/** @internal 테스트 전용 — 케이스 사이에 진행 중 번역 레지스트리를 비운다. */
export function _resetInFlightTranslationsForTest(): void {
    __resetSingleFlightForTests(translationSingleFlight);
}

/**
 * 심볼·회사명으로 종목을 검색한다(한/영 이중 언어). 한글 질의는 한글명 저장소와 크립토를,
 * 그 외는 캐시를 거쳐 FMP·크립토·KRX(yahoo)를 조회하며 최대 `MAX_SEARCH_RESULTS`건을 돌려준다.
 * 한글명이 없는 결과는 백그라운드 번역으로 보강한다.
 */
export async function searchTicker(
    query: string,
    options?: BackgroundTaskOptions
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (isKoreanInput(trimmed)) {
        // 주식 한글명은 korean_tickers 테이블에서, 크립토 한글명은
        // crypto_assets.korean_name에서 온다. 둘을 병렬로 돌려 한글 키 입력 하나(예: "비트코")가
        // 주식·크립토 매칭을 함께 띄우게 한다.
        const [stockResults, cryptoResults] = await Promise.all([
            searchByKoreanName(trimmed),
            // 크립토 DB 오류가 주식 결과를 버리지 않도록 catch를 분리한다.
            searchCryptoAssets(trimmed).catch((): TickerSearchResult[] => []),
        ]);
        // deduplicateResults는 한 심볼이 두 저장소에 모두 있는 드문 경우를 막는다.
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
            // 서버 키 LLM을 못 쓰는 흐름(공개 API)이 남긴 번역 없는 결과 — 웹은 이 키를 읽지 않는다.
            if (!isServerLlmAllowed()) {
                const untranslated = await cache.get<TickerSearchResult[]>(
                    buildApiTickerSearchCacheKey(trimmed)
                );
                if (untranslated) return untranslated;
            }
        } catch {
            // 캐시 읽기 실패는 프로바이더 조회로 내려가는 graceful degradation이다.
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

    const ranked = preferPrimaryListing(rankByRelevance(enriched, trimmed));
    const final = ranked.slice(0, MAX_SEARCH_RESULTS);

    // 화면에 나가는 상위 `MAX_SEARCH_RESULTS`개만 번역한다. 예전에는 병합 결과 전체(FMP
    // 심볼·이름 검색 각 20건 + 크립토 + KRX, 최대 ~45건)를 번역해, 보이지도 않는 이름에
    // LLM 출력 토큰을 썼다(2026-10 비용 감사 L2). 잘린 종목은 다른 질의에서 상위에
    // 오를 때 그때 번역된다.
    const unmapped = final.filter(r => !r.koreanName);
    const translate = isServerLlmAllowed();
    if (translate && unmapped.length > 0) {
        fireAndForget(
            translateAndCache(unmapped).catch(e =>
                console.warn('[searchTicker] background translation failed', e)
            ),
            options
        );
    }

    // 서버 키 LLM을 못 쓰는 흐름(공개 API)이 번역 없는 결과를 웹이 읽는 캐시(24시간)에 쓰면, 웹이 그 캐시를
    // 적중해 번역을 시도할 기회를 잃는다. 그런 결과는 API 전용 키에 1시간만 두어 반복 호출이 FMP/Yahoo를
    // 다시 부르지 않게 한다(웹은 이 키를 읽지 않는다). 번역이 끝난 결과는 그대로 공유 캐시에 쓴다.
    if (cache) {
        const apiOnly = !translate && unmapped.length > 0;
        fireAndForget(
            cache
                .set(
                    apiOnly ? buildApiTickerSearchCacheKey(trimmed) : cacheKey,
                    final,
                    apiOnly
                        ? API_UNTRANSLATED_CACHE_TTL
                        : TICKER_SEARCH_CACHE_TTL
                )
                .catch(e =>
                    console.warn('[searchTicker] cache write failed', e)
                ),
            options
        );
    }

    return final;
}
