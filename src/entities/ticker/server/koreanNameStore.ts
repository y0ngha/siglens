import { tryGetDatabaseClient } from '@/shared/db/client';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import type { KoreanTickerRepository } from '@/shared/db/types';
import type { KoreanTickerEntry, TickerSearchResult } from '@/shared/lib/types';
import { DrizzleKoreanTickerRepository } from '../api';
import { KOREAN_SEARCH_SNAPSHOT_TTL_MS } from '../lib/cacheKeys';
import {
    matchKoreanNameQuery,
    pickListedKrSuffix,
    siblingKrSymbol,
    toKoreanNameMap,
    toSearchableEntry,
    toTickerDisplayNames,
    withCanonical,
    type SearchableKoreanEntry,
    type TickerDisplayName,
} from '../lib/koreanNameSearch';

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
    entries: SearchableKoreanEntry[];
    loadedAt: number;
}

let snapshot: KoreanSearchSnapshot | null = null;
let snapshotLoad: Promise<SearchableKoreanEntry[]> | null = null;
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
async function loadSnapshotFromDatabase(): Promise<SearchableKoreanEntry[]> {
    const repository = tryGetRepository();
    if (!repository) return snapshot?.entries ?? [];

    const generation = snapshotGeneration;
    // 정본은 **로드 지점**에서 입힌다 — 매칭 술어와 반환값 모두 자동으로 정본을 본다
    // (`withCanonical` JSDoc).
    const entries = (await readAllFromDatabase(repository))
        .map(withCanonical)
        .map(toSearchableEntry);
    // 빈 결과(DB 장애)는 새 스냅샷으로 삼지 않고 직전 스냅샷으로 답한다. 무효화가 로드 중에
    // 끼었으면 `snapshot`이 이미 비어 있어 `[]`로 떨어진다(낡은 목록을 되살리지 않는다).
    // 결과가 비지 않았는데 세대가 어긋난 경우(아래)는 저장하지 않을 뿐, 이 로드에 합류했던
    // 호출자에게는 그 결과를 그대로 돌려준다 — 무효화 직전에 시작한 읽기라 잠깐 낡을 수
    // 있지만, 무효화 뒤에 들어온 호출자는 새 로드를 탄다(`clearSnapshot`).
    if (entries.length === 0) return snapshot?.entries ?? [];
    if (generation === snapshotGeneration) {
        snapshot = { entries, loadedAt: Date.now() };
    }
    return entries;
}

async function loadAllEntries(): Promise<SearchableKoreanEntry[]> {
    if (
        snapshot !== null &&
        Date.now() - snapshot.loadedAt < KOREAN_SEARCH_SNAPSHOT_TTL_MS
    ) {
        return snapshot.entries;
    }

    // single-flight — 만료 순간 몰린 요청이 `findAll()`을 N번 치지 않게 한다.
    if (snapshotLoad === null) {
        const load: Promise<SearchableKoreanEntry[]> =
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
 * Korean-name substring lookup over the in-memory snapshot of the persisted ticker store.
 *
 * ⚠️ **매칭 술어와 반환값 둘 다** 정본을 봐야 한다. 반환값만 덮으면 표시만 고쳐지고
 * 검색은 여전히 저장된(틀린) 이름으로만 걸린다 — 사용자가 올바른 이름(`실스큐`)을
 * 치면 0건, 틀린 이름(`씰스큐`)을 쳐야 나오는 상태가 된다. 스냅샷 로더가
 * `withCanonical`을 먼저 입히는 이유다. 옛 표기(`씰스큐`)를 계속 찾게 하려면 저장된
 * 값이 아니라 `KOREAN_SEARCH_ALIASES`에 명시한다 — 그래도 반환되는 이름은 정본이다.
 */
export async function searchByKoreanName(
    query: string
): Promise<TickerSearchResult[]> {
    return matchKoreanNameQuery(await loadAllEntries(), query);
}

/**
 * 심볼 목록의 **표기용 이름**을 한 번에 읽는다(`/symbols` 디렉터리).
 *
 * `getKoreanNames`는 한글명만 돌려주므로 비-ko 화면에서 쓸 이름이 없다. 여기서는
 * 같은 로더(`loadEntriesBySymbols` — DB 직접, 정본 오버라이드 포함)를 그대로
 * 쓰되 두 이름을 함께 내보낸다. 로더를 재사용하는 것이 핵심이다: 새 리더를 따로
 * 만들면 정본 한글명 오버라이드가 이 표면에만 빠져 화면마다 이름이 갈린다.
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
    return entries === null ? null : toTickerDisplayNames(symbols, entries);
}

/**
 * 한국 종목 심볼의 거래소 접미사(`.KS`/`.KQ`)를 `korean_tickers` 마스터로 바로잡는다.
 *
 * yahoo는 다른 시장의 같은 코드에 죽은 리스팅을 남겨 둔다. 실측(2026-10-22): `253450.KS`는
 * 2024-07-19에 멈춘 MUTUALFUND 리스팅이고 실제 종목(스튜디오드래곤)은 `253450.KQ`다. 모델이 접미사를
 * 잘못 고르면 그 리스팅의 2년 묵은 가격이 "오늘 시세"로 나갔다. (다시 보려면 yahoo `quote('253450.KS')`의
 * `quoteType`·`regularMarketTime`을 `253450.KQ`와 비교한다.)
 *
 * 마스터는 공공데이터포털 시드(KOSPI→`.KS`, KOSDAQ→`.KQ`, `toKoreanTickerRows`)다. 요청 심볼의 행이
 * **없고** 다른 접미사의 행이 있을 때만 바꾼다 — 요청 심볼의 행이 있으면(상폐 표시가 있어도) 그대로
 * 둔다. 시장을 옮긴 종목처럼 두 행이 모두 있는 경우를 마스터가 판정하지 않기 때문이다.
 *
 * 조회 실패·DB 미구성·행 없음은 전부 원래 심볼을 돌려준다(교정은 보조 장치라 실패가 호출을 막으면
 * 안 된다). PK `IN` 조회 한 번이다.
 */
export async function correctKrSymbolSuffix(symbol: string): Promise<string> {
    const upper = symbol.toUpperCase();
    if (!isKrEquitySymbol(upper)) return upper;
    const sibling = siblingKrSymbol(upper);
    const entries = await loadEntriesBySymbols([upper, sibling]);
    return entries === null
        ? upper
        : pickListedKrSuffix(upper, sibling, entries);
}

/** Resolve Korean names for a list of canonical ticker symbols. */
export async function getKoreanNames(
    symbols: string[]
): Promise<Record<string, string>> {
    if (symbols.length === 0) return {};

    return toKoreanNameMap(
        symbols,
        (await loadEntriesBySymbols(symbols)) ?? []
    );
}

/**
 * 이 인스턴스의 한글명 검색 스냅샷을 비운다. 다른 인스턴스는 최대
 * `KOREAN_SEARCH_SNAPSHOT_TTL_MS` 늦게 반영된다(데이터 정본은 DB).
 */
export function invalidateKoreanTickerCache(): void {
    clearSnapshot();
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
