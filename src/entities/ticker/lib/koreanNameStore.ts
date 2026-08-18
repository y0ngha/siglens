import { tryGetTickerDatabaseClient } from './db';
import { KOREAN_NAMES_CACHE_TTL, KOREAN_TICKERS_CACHE_KEY } from './cacheKeys';
import { createCacheProvider, type CacheProvider } from '@y0ngha/siglens-core';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';
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
    if (cached !== null) return cached;

    const repository = tryGetRepository();
    if (!repository) return [];

    const entries = await readAllFromDatabase(repository);
    if (cache && entries.length > 0) {
        await writeToCache(cache, entries);
    }
    return entries;
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
        return resolveFromCacheWithFallback(cached, symbols);
    }

    const repository = tryGetRepository();
    if (!repository) return [];

    return readBySymbolsFromDatabase(repository, symbols);
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

/** Korean-name substring lookup over the cached/persisted ticker store. */
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
        const koreanName = symbolMap.get(symbol);
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
