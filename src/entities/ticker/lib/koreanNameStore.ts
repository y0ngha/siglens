import { tryGetDatabaseClient } from '@/shared/db/client';
import {
    KOREAN_SEARCH_SNAPSHOT_TTL_MS,
    LEGACY_KOREAN_TICKERS_REDIS_KEY,
} from './cacheKeys';
import { createCacheProvider } from '@y0ngha/siglens-core';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
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
    const client = tryGetDatabaseClient();
    if (!client) return null;
    return new DrizzleKoreanTickerRepository(client.db);
}

/**
 * 한글명 검색용 인스턴스 메모리 스냅샷. `findAll()` 전체(약 3.3만 행)를 들고 있다가
 * `KOREAN_SEARCH_SNAPSHOT_TTL_MS` 뒤에 다시 읽는다.
 *
 * DB `ILIKE`로 바꾸지 않은 이유: `rankByRelevance`가 후보 **전체**를 보고 순위를 매긴다.
 * "삼" 같은 짧은 질의는 수천 행이 걸려 `LIMIT`을 걸면 순위가 깨지고, 걸지 않으면 키 입력마다
 * 수천 행이 DB에서 전송된다. 메모리 스냅샷은 동작(전체 대상 부분 일치 → 순위)을 그대로
 * 두면서 예전 Redis 왕복과 수 MB 파싱을 없앤다.
 */
interface KoreanSearchSnapshot {
    entries: KoreanTickerEntry[];
    loadedAt: number;
}

let snapshot: KoreanSearchSnapshot | null = null;
let snapshotLoad: Promise<KoreanTickerEntry[]> | null = null;
/**
 * 로드 도중 무효화가 일어났는지 가리는 세대 번호. 무효화가 로드 중에 끼면 그 로드가
 * 가져온 (이미 낡은) 결과를 스냅샷에 넣지 않는다.
 */
let snapshotGeneration = 0;

/**
 * 스냅샷과 진행 중 로드를 함께 버린다. `snapshotLoad`를 비우지 않으면 무효화 뒤에 온
 * 요청이 무효화 이전에 시작된 낡은 로드에 합류해 옛 데이터를 받는다.
 */
function clearSnapshot(): void {
    snapshot = null;
    snapshotLoad = null;
    snapshotGeneration += 1;
}

/** Test helper — 스냅샷과 진행 중 로드를 비운다. */
export function __resetKoreanSearchSnapshotForTests(): void {
    clearSnapshot();
}

/**
 * DB에서 스냅샷을 새로 읽는다.
 *
 * **갱신 실패 시 마지막 정상 스냅샷을 돌려준다**(SERVER.md#DC-7). 만료된 스냅샷은 지우지
 * 않으므로(`loadedAt`도 그대로) 실패·빈 결과면 옛 목록을 서빙하고 다음 호출이 곧바로
 * 다시 시도한다. 빈 배열을 돌려주면 일시 장애가 "검색 결과 없음"이라는 틀린 답이 된다.
 *
 * DB 장애 흡수(SERVER.md#DC-8): 예전 Redis 사본은 DB가 죽어도 검색을 살려 주는 층이기도
 * 했다. 이제 그 역할은 이 인스턴스 스냅샷이 맡는다 — 한 번이라도 로드된 인스턴스는 DB가
 * 죽어도 옛 목록으로 계속 답한다. 콜드 스타트 직후(스냅샷 없음)의 장애만 빈 배열이며,
 * 그 결과는 저장하지 않아 요청마다 재시도한다(`findAll` 폭주는 single-flight가 막는다).
 * 심볼 조회(`findBySymbols`)는 PK 조회라 따로 쓰기 폴백을 두지 않는다 — 호출부가 영문명으로
 * degrade한다.
 */
async function loadSnapshotFromDatabase(): Promise<KoreanTickerEntry[]> {
    const repository = tryGetRepository();
    if (!repository) return snapshot?.entries ?? [];

    const generation = snapshotGeneration;
    // 정본은 **로드 지점**에서 입힌다 — 매칭 술어와 반환값 모두 자동으로 정본을 본다
    // (`withCanonical` JSDoc).
    const entries = (await readAllFromDatabase(repository)).map(withCanonical);
    // 빈 결과(DB 장애)는 새 스냅샷으로 삼지 않는다. 무효화가 로드 중에 끼었으면 `snapshot`이
    // 이미 비어 있어 `[]`로 떨어진다(낡은 목록을 되살리지 않는다).
    if (entries.length === 0) return snapshot?.entries ?? [];
    if (generation === snapshotGeneration) {
        snapshot = { entries, loadedAt: Date.now() };
    }
    return entries;
}

async function loadAllEntries(): Promise<KoreanTickerEntry[]> {
    if (
        snapshot !== null &&
        Date.now() - snapshot.loadedAt < KOREAN_SEARCH_SNAPSHOT_TTL_MS
    ) {
        return snapshot.entries;
    }

    // single-flight — 만료 순간 몰린 요청이 `findAll()`을 N번 치지 않게 한다.
    if (snapshotLoad === null) {
        const load: Promise<KoreanTickerEntry[]> =
            loadSnapshotFromDatabase().finally(() => {
                // 무효화로 더 새로운 로드가 들어섰을 수 있다 — 내 것일 때만 비운다.
                if (snapshotLoad === load) snapshotLoad = null;
            });
        snapshotLoad = load;
    }
    return snapshotLoad;
}

/**
 * 심볼로 이름을 찾는다 — DB `findBySymbols`(PK `IN`)를 직접 읽는다. `findBySymbols`는
 * 상폐 행까지 돌려주므로(`KoreanTickerRepository.findBySymbols` JSDoc) 상폐 종목의 한글명도
 * 별도 보충 없이 나온다.
 *
 * **조회 실패(`null`)와 "행 없음"(`[]`)을 구분한다**(SERVER.md#DC-8). 예전 Redis 사본은 DB
 * 장애를 흡수하는 층이기도 했다 — 장애를 `[]`로 뭉개면 호출부가 이미 번역된 심볼을 "번역이
 * 없다"고 읽어 장애 동안 심볼마다 Gemini 번역을 돌린다. DB 클라이언트가 아예 없는 구성은
 * 장애가 아니라 "저장소 없음"이라 `[]`다.
 */
async function loadEntriesBySymbols(
    symbols: readonly string[]
): Promise<KoreanTickerEntry[] | null> {
    const repository = tryGetRepository();
    if (!repository) return [];

    const entries = await readBySymbolsFromDatabase(repository, symbols);
    return entries === null ? null : entries.map(withCanonical);
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
): Promise<KoreanTickerEntry[] | null> {
    try {
        return await repository.findBySymbols(symbols);
    } catch (e) {
        console.warn('[koreanNameStore] DB read failed', e);
        return null;
    }
}

/**
 * 저장된 행에 정본 한글명을 입힌다 — **이 저장소를 읽는 단일 관문**이다.
 *
 * `korean_tickers`는 `asset_translations`와 다른 테이블이라 `getAssetInfo` 출구의
 * 오버라이드가 닿지 않는다. 검색 자동완성·뉴스가 여기서 이름을 받으므로, 덮지
 * 않으면 종목 페이지엔 `실스큐`인데 검색엔 `씰스큐`가 뜬다.
 *
 * **로더(`loadSnapshotFromDatabase`/`loadEntriesBySymbols`)의 반환 지점에만 적용한다.**
 * 호출부마다 흩뿌리면 새 리더가 생길 때 조용히 빠진다 — 실제로 `searchByKoreanName`이
 * 그렇게 빠져 있었고, 그 함수는 반환값뿐 아니라 **매칭 술어**도 원본을 보고 있어서
 * 사용자가 올바른 이름을 치면 0건이 나왔다(리뷰 round 2). 로더에서 입히면 술어가
 * 자동으로 정본을 본다.
 *
 * 검색 스냅샷에는 정본을 입힌 값이 담긴다 — 정본 맵을 고치면 스냅샷 TTL(10분)·재시작 뒤
 * 반영된다(DB의 원본 행은 그대로라 맵에서 빼면 저장된 값이 다시 드러난다).
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
 * Korean-name substring lookup over the in-memory snapshot of the persisted ticker store.
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

/** 디렉터리 표기용 이름 한 벌 — 한글명이 없으면 영문명으로 떨어진다. */
export interface TickerDisplayName {
    readonly koreanName: string | null;
    /** `korean_tickers.name` — 영문 정식 명칭. */
    readonly name: string | null;
}

/**
 * 심볼 목록의 **표기용 이름**을 한 번에 읽는다(`/symbols` 디렉터리).
 *
 * `getKoreanNames`는 한글명만 돌려주므로 비-ko 화면에서 쓸 이름이 없다. 여기서는
 * 같은 로더(`loadEntriesBySymbols` — DB 직접, 정본 오버라이드 포함)를 그대로
 * 쓰되 두 이름을 함께 내보낸다. 로더를 재사용하는 것이 핵심이다: 새 리더를 따로
 * 만들면 정본 한글명 오버라이드가 이 표면에만 빠져 화면마다 이름이 갈린다(이
 * 파일 상단 주석의 사고가 정확히 그 형태였다).
 *
 * 암호화폐는 `korean_tickers`가 아니라 `crypto_assets`에 있어 여기서 안 나온다 —
 * 호출부가 `getCryptoAsset`으로 보강한다.
 */
export async function getTickerDisplayNames(
    symbols: readonly string[]
): Promise<Record<string, TickerDisplayName>> {
    return (await lookupTickerDisplayNames(symbols)) ?? {};
}

/**
 * {@link getTickerDisplayNames}와 같은 조회지만 **DB 조회 실패를 `null`로 알린다.**
 *
 * 대부분의 호출부(뉴스·검색 보강·디렉터리)는 실패를 "이름 없음"으로 읽어 영문명으로
 * degrade해도 되므로 `getTickerDisplayNames`를 쓴다. 실패와 "행 없음"을 구분해야 하는
 * 호출부 — 행이 없으면 번역을 시작하는 `getAssetInfo`의 FMP 경로 — 만 이 함수를 쓴다.
 */
export async function lookupTickerDisplayNames(
    symbols: readonly string[]
): Promise<Record<string, TickerDisplayName> | null> {
    if (symbols.length === 0) return {};

    const entries = await loadEntriesBySymbols(symbols);
    if (entries === null) return null;
    const bySymbol = new Map(entries.map(e => [e.symbol, e]));

    return Object.fromEntries(
        symbols.flatMap<readonly [string, TickerDisplayName]>(symbol => {
            const entry = bySymbol.get(symbol);
            // 저장된 행이 없어도 정본 한글명은 내보낸다 — `getKoreanNames`가
            // 같은 이유로 같은 폴백을 갖는다(위 주석 참고).
            const koreanName =
                CANONICAL_KOREAN_NAMES.get(symbol) ?? entry?.koreanName ?? null;
            const name = entry?.name ?? null;
            return koreanName === null && name === null
                ? []
                : [[symbol, { koreanName, name }]];
        })
        // `Object.fromEntries`는 반환 타입을 `{ [k: string]: TickerDisplayName }`로
        // 넓히지만, 위 `flatMap`이 `readonly [string, TickerDisplayName][]`만
        // 만들어 넣으므로 이 캐스트는 안전하다(`getKoreanNames`의 같은 캐스트와
        // 같은 이유).
    ) as Record<string, TickerDisplayName>;
}

/** Resolve Korean names for a list of canonical ticker symbols. */
export async function getKoreanNames(
    symbols: string[]
): Promise<Record<string, string>> {
    if (symbols.length === 0) return {};

    const entries = (await loadEntriesBySymbols(symbols)) ?? [];
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
 * 이 인스턴스의 한글명 검색 스냅샷을 비운다. 다른 인스턴스는 최대
 * `KOREAN_SEARCH_SNAPSHOT_TTL_MS` 늦게 반영된다(데이터 정본은 DB).
 *
 * 부수로 예전 Redis 사본(`LEGACY_KOREAN_TICKERS_REDIS_KEY`)을 best-effort로 지운다 —
 * 배포 뒤 KR cron이 한 번 지우면 남은 수 MB 키가 정리된다. `DEL`은 멱등이고 일 1회라
 * 비용이 없다. 다음 정리 PR에서 이 부분을 제거한다.
 */
export async function invalidateKoreanTickerCache(): Promise<void> {
    clearSnapshot();
    await deleteLegacyRedisKey();
}

async function deleteLegacyRedisKey(): Promise<void> {
    try {
        const cache = createCacheProvider();
        if (!cache) return;
        await cache.delete(LEGACY_KOREAN_TICKERS_REDIS_KEY);
    } catch {
        // Graceful degradation: 정리용 DEL의 실패는 전파하지 않는다.
    }
}

/** Upsert ticker entries to the DB and drop this instance's search snapshot. */
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

    clearSnapshot();
}
