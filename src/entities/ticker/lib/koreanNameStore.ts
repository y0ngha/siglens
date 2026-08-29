import { tryGetTickerDatabaseClient } from './db';
import { KOREAN_NAMES_CACHE_TTL, KOREAN_TICKERS_CACHE_KEY } from './cacheKeys';
import { createCacheProvider, type CacheProvider } from '@y0ngha/siglens-core';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import type { KoreanTickerEntry, TickerSearchResult } from '@/shared/lib/types';
import { DrizzleKoreanTickerRepository } from '../api';
import type { KoreanTickerRepository } from '@/shared/db/types';

function koreanEntryToSearchResult(
    entry: KoreanTickerEntry
): TickerSearchResult {
    return {
        symbol: entry.symbol,
        name: entry.name,
        koreanName: entry.koreanName,
        exchange: entry.exchange,
        exchangeFullName: entry.exchangeFullName,
        // `korean_tickers`는 미국·한국 종목을 함께 담는다(크립토만 별도 테이블). 행 자체에는
        // 프로필 컬럼이 없으므로 심볼 형상으로 판정한다 — 이게 없으면 한글 검색으로 찾은
        // 한국 종목이 us-equity로 표시된다.
        ...(isKrEquitySymbol(entry.symbol)
            ? { marketProfile: 'kr-equity' as const }
            : {}),
    };
}

function tryGetRepository(): KoreanTickerRepository | null {
    const client = tryGetTickerDatabaseClient();
    if (!client) return null;
    return new DrizzleKoreanTickerRepository(client.db);
}

async function readFromCache(
    cache: CacheProvider
): Promise<KoreanTickerEntry[] | null> {
    try {
        return await cache.get<KoreanTickerEntry[]>(KOREAN_TICKERS_CACHE_KEY);
    } catch {
        return null;
    }
}

async function writeToCache(
    cache: CacheProvider,
    entries: KoreanTickerEntry[]
): Promise<void> {
    try {
        await cache.set(
            KOREAN_TICKERS_CACHE_KEY,
            entries,
            KOREAN_NAMES_CACHE_TTL
        );
    } catch {
        // Graceful degradation: cache write failure should not propagate.
    }
}

async function loadEntriesFromCache(
    cache: CacheProvider | null
): Promise<KoreanTickerEntry[] | null> {
    if (!cache) return null;

    return readFromCache(cache);
}

async function loadAllEntries(): Promise<KoreanTickerEntry[]> {
    const cache = createCacheProvider();
    const cached = await loadEntriesFromCache(cache);
    // 정본은 **반환 지점**에서 입힌다 — 캐시에는 원본을 그대로 둬야 정본 맵을
    // 고쳤을 때 캐시 무효화 없이 반영된다(`withCanonical` JSDoc).
    if (cached !== null) return cached.map(withCanonical);

    const repository = tryGetRepository();
    if (!repository) return [];

    const entries = await readAllFromDatabase(repository);
    if (cache && entries.length > 0) {
        await writeToCache(cache, entries);
    }
    return entries.map(withCanonical);
}

/**
 * `loadAllEntries`와 같은 캐시 키(`KOREAN_TICKERS_CACHE_KEY`)를 읽지만 미스 처리
 * 방식이 다르다 — 단순화하면 이 저장소의 상폐 종목 보장이 캐시가 warm해진 순간
 * 조용히 깨진다.
 *
 * 캐시는 `findAll()`(상장 종목만) 결과로 채워진다. 캐시 hit에서 그 배열을
 * `filter`만 하면, DB에는 있지만 캐시엔 없는 상폐 심볼이 영원히 걸러진다 —
 * `findBySymbols`가 상폐 행까지 돌려주도록 만든 목적 자체가 무력화된다
 * (`KoreanTickerRepository.findBySymbols` JSDoc 참조). 그래서 캐시 hit이어도
 * 요청 심볼 중 캐시가 못 채운 것을 따로 추려 DB로 보충한다.
 *
 * 보충은 **국내 심볼로만** 한정한다. 상폐는 KR 티커에만 있는 개념이고, 오탈자·
 * 미상장 등으로 캐시에 없는 US/crypto 심볼까지 매번 DB를 때리면 흔한 캐시
 * 미스마다 쿼리가 하나씩 붙는다 — 이 함수가 핫 패스(`getKoreanNames`)에서
 * 호출되므로 그 비용은 무시할 수 없다.
 */
async function loadEntriesBySymbols(
    symbols: readonly string[]
): Promise<KoreanTickerEntry[]> {
    const cache = createCacheProvider();
    const cached = await loadEntriesFromCache(cache);
    if (cached !== null) {
        return (await resolveFromCacheWithFallback(cached, symbols)).map(
            withCanonical
        );
    }

    const repository = tryGetRepository();
    if (!repository) return [];

    return (await readBySymbolsFromDatabase(repository, symbols)).map(
        withCanonical
    );
}

async function resolveFromCacheWithFallback(
    cached: KoreanTickerEntry[],
    symbols: readonly string[]
): Promise<KoreanTickerEntry[]> {
    const requested = new Set(symbols);
    const hits = cached.filter(entry => requested.has(entry.symbol));

    const hitSymbols = new Set(hits.map(entry => entry.symbol));
    const missingKrSymbols = [...requested].filter(
        symbol => !hitSymbols.has(symbol) && isKrEquitySymbol(symbol)
    );
    if (missingKrSymbols.length === 0) return hits;

    const repository = tryGetRepository();
    if (!repository) return hits;

    const fallback = await readBySymbolsFromDatabase(
        repository,
        missingKrSymbols
    );
    return [...hits, ...fallback];
}

async function readAllFromDatabase(
    repository: KoreanTickerRepository
): Promise<KoreanTickerEntry[]> {
    try {
        return await repository.findAll();
    } catch (e) {
        console.warn('[koreanNameStore] DB read failed', e);
        return [];
    }
}

async function readBySymbolsFromDatabase(
    repository: KoreanTickerRepository,
    symbols: readonly string[]
): Promise<KoreanTickerEntry[]> {
    try {
        return await repository.findBySymbols(symbols);
    } catch (e) {
        console.warn('[koreanNameStore] DB read failed', e);
        return [];
    }
}

/**
 * 저장된 행에 정본 한글명을 입힌다 — **이 저장소를 읽는 단일 관문**이다.
 *
 * `korean_tickers`는 `asset_translations`와 다른 테이블이라 `getAssetInfo` 출구의
 * 오버라이드가 닿지 않는다. 검색 자동완성·뉴스가 여기서 이름을 받으므로, 덮지
 * 않으면 종목 페이지엔 `실스큐`인데 검색엔 `씰스큐`가 뜬다.
 *
 * **로더(`loadAllEntries`/`loadEntriesBySymbols`)의 반환 지점에만 적용한다.**
 * 호출부마다 흩뿌리면 새 리더가 생길 때 조용히 빠진다 — 실제로 `searchByKoreanName`이
 * 그렇게 빠져 있었고, 그 함수는 반환값뿐 아니라 **매칭 술어**도 원본을 보고 있어서
 * 사용자가 올바른 이름을 치면 0건이 나왔다(리뷰 round 2). 로더에서 입히면 술어가
 * 자동으로 정본을 본다.
 *
 * 캐시에는 원본을 쓴다 — 파생값을 저장하면 정본 맵 수정이 캐시 TTL에 묶인다.
 *
 * ⚠️ **`getKoreanNames`는 자체 오버라이드를 하나 더 갖는다 — 지우지 말 것.**
 * 이 함수는 *존재하는 행*만 고칠 수 있어서, 저장된 행이 아예 없는 심볼에는
 * 아무것도 못 한다. 번역이 아직 안 채워진 정본 심볼을 영문 대신 올바른 한글로
 * 보여 주려면 `getKoreanNames` 쪽 `CANONICAL_KOREAN_NAMES.get(symbol) ?? …`가
 * 필요하다. 행이 있는 심볼에 대해선 결과가 같아 중복처럼 보이지만 죽은 코드가
 * 아니다(리뷰 round 3).
 *
 * ## 저장된 행은 틀린 채로 남는다 — 의도다
 *
 * 정본이 있는 심볼은 `koreanName`이 항상 truthy가 되므로, `searchTicker`의
 * `unmapped` 필터와 `getAssetInfo`의 번역 트리거가 그 심볼을 다시 번역하지
 * 않는다. 즉 DB의 틀린 행(`LAES` → `씰스큐`)은 그대로 굳는다.
 *
 * 그게 맞다. 그 자가치유는 **LLM 번역기**이고, 애초에 저 틀린 이름을 만든 게
 * 그 번역기다. 사람이 정본을 정한 심볼에 다시 LLM을 붙이면 표기가 또 흔들린다.
 * 굳은 행은 이 관문을 지나는 한 어디에도 노출되지 않으므로 무해하다.
 * (심볼을 정본 맵에서 빼면 저장된 값이 다시 드러나고 자가치유도 되살아난다.)
 */
function withCanonical(entry: KoreanTickerEntry): KoreanTickerEntry {
    const canonical = CANONICAL_KOREAN_NAMES.get(entry.symbol);
    return canonical === undefined
        ? entry
        : { ...entry, koreanName: canonical };
}

/**
 * Korean-name substring lookup over the cached/persisted ticker store.
 *
 * ⚠️ **매칭 술어와 반환값 둘 다** 정본을 봐야 한다. 반환값만 덮으면 표시만 고쳐지고
 * 검색은 여전히 저장된(틀린) 이름으로만 걸린다 — 사용자가 올바른 이름(`실스큐`)을
 * 치면 0건, 틀린 이름(`씰스큐`)을 쳐야 나오는 상태가 된다(리뷰 round 2 지적).
 * `withCanonical`을 먼저 입히고 그 결과로 필터링하는 이유다.
 */
export async function searchByKoreanName(
    query: string
): Promise<TickerSearchResult[]> {
    const entries = await loadAllEntries();
    const normalizedQuery = query.toLowerCase();
    return entries.flatMap(entry =>
        entry.koreanName.toLowerCase().includes(normalizedQuery)
            ? [koreanEntryToSearchResult(entry)]
            : []
    );
}

/** Resolve Korean names for a list of canonical ticker symbols. */
export async function getKoreanNames(
    symbols: string[]
): Promise<Record<string, string>> {
    if (symbols.length === 0) return {};

    const entries = await loadEntriesBySymbols(symbols);
    const symbolMap = new Map(entries.map(e => [e.symbol, e.koreanName]));

    const pairs = symbols.flatMap<readonly [string, string]>(symbol => {
        // 정본이 저장된 이름을 덮는다. `korean_tickers`는 `asset_translations`와
        // **다른 테이블**이라, `getAssetInfo` 출구의 오버라이드가 이 경로에는
        // 닿지 않는다 — 검색 자동완성·뉴스가 여기서 이름을 받으므로 덮지 않으면
        // 종목 페이지엔 `실스큐`, 검색 드롭다운엔 `씰스큐`가 뜬다.
        //
        // 저장된 행이 없어도 정본은 내보낸다(`?? symbolMap.get`이 아니라 앞에
        // 둔 이유) — 번역이 아직 안 채워진 종목도 올바른 이름으로 보이는 편이 낫다.
        const koreanName =
            CANONICAL_KOREAN_NAMES.get(symbol) ?? symbolMap.get(symbol);
        return koreanName ? [[symbol, koreanName]] : [];
    });
    // Object.fromEntries widens to { [k: string]: string } but pairs is readonly [string, string][], so the cast is safe.
    return Object.fromEntries(pairs) as Record<string, string>;
}

/**
 * 한글 종목 캐시를 비운다. 검색은 이 캐시를 통째로 읽어 substring 필터를 돌리므로,
 * 상장 상태가 바뀐 뒤 비우지 않으면 상폐 종목이 TTL 동안 검색에 계속 뜬다.
 */
export async function invalidateKoreanTickerCache(): Promise<void> {
    const cache = createCacheProvider();
    if (!cache) return;
    await invalidateCache(cache);
}

async function invalidateCache(cache: CacheProvider): Promise<void> {
    try {
        await cache.delete(KOREAN_TICKERS_CACHE_KEY);
    } catch {
        // Graceful degradation: cache invalidation failure should not propagate.
    }
}

/** Upsert ticker entries to the DB and invalidate the Redis cache. */
export async function setKoreanTickers(
    newEntries: readonly KoreanTickerEntry[]
): Promise<void> {
    if (newEntries.length === 0) return;

    const repository = tryGetRepository();
    if (!repository) return;

    try {
        await repository.upsertMany(newEntries);
    } catch (e) {
        console.warn('[koreanNameStore] DB upsert failed', e);
        return;
    }

    const cache = createCacheProvider();
    if (!cache) return;

    await invalidateCache(cache);
}
