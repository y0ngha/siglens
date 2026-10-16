import type { FmpProfileIdentifiers } from '@/shared/api/fmp/profileIdentifiersClient';
import type { CusipMissStore } from '../api/cusipMissStore';
import {
    INVESTOR_FLOWS_CUSIP_BLANKET_FAILURE_RATIO,
    INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS,
    INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD,
    INVESTOR_FLOWS_CUSIP_RECHECK_BATCH,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
    INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED,
} from '../lib/investorFlowsPolicy';
import { MISS_TTL_SECONDS } from '../api/cusipMissStore';
import type {
    CusipMapRow,
    RecheckCandidate,
} from '../api/investorFlowsUniverseRepository';
import {
    cusipFromIsin,
    figiTickersMatchSymbol,
    parseProfileCusip,
} from '../lib/cusip';

/** 한 실행이 시도하는 심볼 수 상한. 나머지는 다음 실행이 이어 간다(재개 가능). */
export const MAX_SYMBOLS_PER_RUN = 1_500;
/** FMP profile 동시 호출 수. 플랜 한도(분당 ~300) 안에서 호출당 ~0.8초 → 분당 ~220건. */
export const PROFILE_CONCURRENCY = 3;
const CANDIDATE_PAGE_SIZE = 500;

export interface SyncCusipMapDeps {
    repo: {
        listUnmappedUsSymbols(
            afterSymbol: string,
            limit: number
        ): Promise<string[]>;
        upsertCusipMap(rows: readonly CusipMapRow[]): Promise<void>;
        listRecheckCandidates(limit: number): Promise<RecheckCandidate[]>;
        markChecked(ids: readonly number[]): Promise<void>;
        /** `cusips` 중 이미 맵에 있는 것. */
        findExistingCusips(cusips: readonly string[]): Promise<Set<string>>;
        countMapped(): Promise<number>;
        getState(key: string): Promise<string | null>;
        /** 키가 없을 때만 기록한다(set-once). */
        setStateIfAbsent(key: string, value: string): Promise<void>;
    };
    now: () => Date;
    misses: CusipMissStore;
    fetchProfile: (symbol: string) => Promise<FmpProfileIdentifiers | null>;
    /** CUSIP → 티커 목록. 요청한 CUSIP 중 처리한 것만 결과에 담는다(데드라인으로 중단 가능). */
    mapCusipsToTickers: (
        cusips: readonly string[],
        shouldStop: () => boolean
    ) => Promise<Map<string, string[]>>;
    isRateLimitError: (error: unknown) => boolean;
    isDeadlineReached: () => boolean;
    log: (message: string, detail?: unknown) => void;
}

export interface SyncCusipMapResult {
    status: 'complete' | 'capped' | 'deadline' | 'rate_limited';
    candidates: number;
    fromProfile: number;
    fromFigi: number;
    misses: number;
    errors: number;
    /** 기존 매핑을 FMP와 다시 대조한 수 / 그중 CUSIP이 바뀌어 새 행을 만든 수. */
    rechecked: number;
    cusipChanged: number;
    /** 이번 실행에서 연속 실패 임계에 닿아 `persistentError` miss가 걸린 심볼 수. */
    failuresMarked: number;
    /** 시도의 거의 전부가 실패해(전면 장애) 이번 실행의 실패를 세지 않았는가. */
    blanketOutage: boolean;
    /** 이 실행이 "전수 한 바퀴 완료" 표식을 **처음** 세웠는가(이미 서 있었으면 false). */
    universeCompleted: boolean;
}

type FigiCandidate = { symbol: string; cusip: string };

/** 매핑 하나의 키 — 같은 실행에서 방금 FMP로 만든 매핑을 재대조에서 알아보는 데 쓴다. */
const mappingKey = (row: { cusip: string; symbol: string }): string =>
    `${row.cusip}|${row.symbol}`;

/**
 * 티커 DB의 미국 보통주 후보 중 CUSIP 매핑이 없는 종목을 채운다 — 증분·재개 가능.
 *
 * 1. FMP `profile`의 `cusip` → source `fmp`.
 * 2. `cusip`이 없고 미국·캐나다 ISIN이 있으면 ISIN에서 CUSIP을 꺼내 후보로 두고, OpenFIGI가 그 CUSIP을
 *    **같은 티커**로 해석할 때만 source `openfigi`로 받아들인다. (OpenFIGI는 CUSIP→티커만 풀 수 있고
 *    티커→CUSIP은 못 푼다 — 그래서 "발견"이 아니라 "검증" 역할이다.)
 * 3. ETF·펀드·식별자 없음·프로필 없음은 Redis에 "최근 실패"로 표식해 다음 실행이 건너뛴다.
 *
 * FMP 호출은 `PROFILE_CONCURRENCY`씩 청크로 보내고 청크마다 DB에 쓴다. 속도 제한(429)이면 실행을 접는다.
 *
 * **인프라 오류(FMP 402·400·5xx·타임아웃, OpenFIGI 장애)는 즉시 표식하지 않는다.** 그 심볼은 후보로 남아 다음 실행에
 * 재시도되고, 심볼별 **연속 실패일 수**를 센다(`CusipMissStore.recordFailures`):
 *  - 하루(UTC)에 심볼당 **최대 1번**만 센다 — 부트스트랩 중 같은 날 수동으로 연달아 돌려도 한 번이다.
 *  - 시도가 `INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS`(20) 이상이고 `…_FAILURE_RATIO`(90%) 이상이 실패한 실행은
 *    전면 장애라 **아무것도 세지 않는다**(FMP·OpenFIGI를 따로 판정, `blanketOutage`).
 *  - `INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD`(3)일째 실패하면 7일짜리 miss를 걸어 후보에서 뺀다(그래야 전수 한 바퀴가
 *    끝난다). miss가 만료되면 다시 후보가 된다. 속도 제한은 세지 않는다.
 * 전수 한 바퀴 완료 표식은 실행 **시작 시점**의 후보가 0건일 때만 선다(아래).
 */
export async function runCusipMapSync(
    deps: SyncCusipMapDeps
): Promise<SyncCusipMapResult> {
    const result: SyncCusipMapResult = {
        status: 'complete',
        candidates: 0,
        fromProfile: 0,
        fromFigi: 0,
        misses: 0,
        errors: 0,
        rechecked: 0,
        cusipChanged: 0,
        failuresMarked: 0,
        blanketOutage: false,
        universeCompleted: false,
    };

    // 1) 후보 수집 — 최근 실패 표식이 없는 것만, 상한까지.
    const candidates: string[] = [];
    let after = '';
    for (;;) {
        // 페이지는 앞 페이지의 마지막 심볼에 의존해 직렬이다.
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const page = await deps.repo.listUnmappedUsSymbols(
            after,
            CANDIDATE_PAGE_SIZE
        );
        if (page.length === 0) break;
        after = page[page.length - 1] as string;
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const missed = await deps.misses.findRecentMisses(page);
        for (const symbol of page) {
            if (!missed.has(symbol)) candidates.push(symbol);
        }
        if (candidates.length >= MAX_SYMBOLS_PER_RUN) {
            candidates.length = MAX_SYMBOLS_PER_RUN;
            result.status = 'capped';
            break;
        }
    }
    result.candidates = candidates.length;

    const figiCandidates: FigiCandidate[] = [];
    const newMisses: { symbol: string; ttlSeconds: number }[] = [];
    // 인프라 오류로 이번에 못 얻은 심볼 — 연속 실패를 세어 임계에 닿으면 miss로 후보에서 뺀다(아래).
    const failedProfiles: string[] = [];
    let profileAttempts = 0;
    const failedFigi: string[] = [];
    // 이번 실행이 FMP profile로 만든 매핑 — 재대조(아래 4)가 같은 profile을 다시 받지 않게 한다.
    const mappedFromProfile = new Set<string>();

    // 2) FMP profile — 청크 단위, 청크마다 저장.
    for (let i = 0; i < candidates.length; i += PROFILE_CONCURRENCY) {
        if (deps.isDeadlineReached()) {
            result.status = 'deadline';
            break;
        }
        const chunk = candidates.slice(i, i + PROFILE_CONCURRENCY);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const settled = await Promise.allSettled(
            chunk.map(symbol => deps.fetchProfile(symbol))
        );
        const rows: CusipMapRow[] = [];
        let stop = false;
        settled.forEach((outcome, index) => {
            const symbol = chunk[index] as string;
            if (outcome.status === 'rejected') {
                if (deps.isRateLimitError(outcome.reason)) stop = true;
                else {
                    profileAttempts += 1;
                    result.errors += 1;
                    failedProfiles.push(symbol);
                    deps.log(
                        `[cusip-map] profile failed ${symbol}:`,
                        outcome.reason
                    );
                }
                return;
            }
            profileAttempts += 1;
            const profile = outcome.value;
            if (profile === null) {
                newMisses.push({
                    symbol,
                    ttlSeconds: MISS_TTL_SECONDS.noProfile,
                });
                return;
            }
            if (profile.isEtf || profile.isFund) {
                newMisses.push({
                    symbol,
                    ttlSeconds: MISS_TTL_SECONDS.notCommonStock,
                });
                return;
            }
            const cusip = parseProfileCusip(profile.cusip);
            if (cusip !== null) {
                rows.push({ cusip, symbol, source: 'fmp' });
                return;
            }
            const derived = cusipFromIsin(profile.isin);
            if (derived !== null)
                figiCandidates.push({ symbol, cusip: derived });
            else
                newMisses.push({
                    symbol,
                    ttlSeconds: MISS_TTL_SECONDS.noCusip,
                });
        });
        if (rows.length > 0) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await deps.repo.upsertCusipMap(rows);
            result.fromProfile += rows.length;
            for (const row of rows) mappedFromProfile.add(mappingKey(row));
        }
        if (stop) {
            result.status = 'rate_limited';
            break;
        }
    }

    // 3) OpenFIGI 검증 — ISIN에서 낸 CUSIP이 같은 티커인지.
    if (figiCandidates.length > 0 && result.status !== 'rate_limited') {
        try {
            const resolved = await deps.mapCusipsToTickers(
                figiCandidates.map(candidate => candidate.cusip),
                deps.isDeadlineReached
            );
            const verified: CusipMapRow[] = [];
            for (const { symbol, cusip } of figiCandidates) {
                const tickers = resolved.get(cusip);
                if (tickers === undefined) continue; // 이번 실행에선 확인 못 함 — 다음에 재시도
                if (figiTickersMatchSymbol(tickers, symbol)) {
                    verified.push({ cusip, symbol, source: 'openfigi' });
                } else {
                    newMisses.push({
                        symbol,
                        ttlSeconds: MISS_TTL_SECONDS.figiMismatch,
                    });
                }
            }
            if (verified.length > 0) {
                await deps.repo.upsertCusipMap(verified);
                result.fromFigi += verified.length;
            }
        } catch (error) {
            // 속도 제한은 다음 실행으로 미룬다(후보는 표식 없이 남는다). 그 밖의 장애는 후보별 연속 실패로 센다 —
            // 일시 장애는 임계 전에 풀려 다시 시도되고, 영구 장애는 임계 뒤 miss로 빠져 전수 한 바퀴를 막지 않는다.
            deps.log('[cusip-map] OpenFIGI verification stopped:', error);
            if (!deps.isRateLimitError(error)) {
                result.errors += 1;
                failedFigi.push(...figiCandidates.map(c => c.symbol));
            }
        }
    }

    result.misses = newMisses.length;
    await deps.misses.recordMisses(newMisses);
    // 전면 장애(시도 대부분이 실패)는 심볼 고유의 문제가 아니므로 세지 않는다. 실행 단위로 FMP·OpenFIGI를 따로 본다.
    const profileBlanket = isBlanketOutage(
        profileAttempts,
        failedProfiles.length
    );
    const figiBlanket = isBlanketOutage(
        figiCandidates.length,
        failedFigi.length
    );
    result.blanketOutage = profileBlanket || figiBlanket;
    if (profileBlanket) {
        deps.log(
            `[cusip-map] blanket FMP outage: ${failedProfiles.length} of ${profileAttempts} profile fetches failed — failures not counted this run`
        );
    }
    if (figiBlanket) {
        deps.log(
            `[cusip-map] blanket OpenFIGI outage: ${failedFigi.length} of ${figiCandidates.length} candidates failed — failures not counted this run`
        );
    }
    const persistent = await deps.misses.recordFailures(
        [
            ...(profileBlanket ? [] : failedProfiles),
            ...(figiBlanket ? [] : failedFigi),
        ],
        INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD,
        MISS_TTL_SECONDS.persistentError,
        deps.now().toISOString().slice(0, 10)
    );
    result.failuresMarked = persistent.length;
    if (persistent.length > 0) {
        deps.log(
            `[cusip-map] ${persistent.length} symbol(s) failed on ${INVESTOR_FLOWS_CUSIP_FAILURE_THRESHOLD} separate (UTC) days — skipped for a week:`,
            persistent
        );
    }

    // 전수 한 바퀴 완료 표식(set-once) — 상한·마감·속도 제한 없이 끝났고 후보가 하나도 없을 때만. 이 표식이 서야
    // sec-13f가 수집을 시작한다. 한 번 서면 지우지 않는다: 이후 신규 상장·CUSIP 변경으로 후보가 다시 생겨도 게이트는
    // 그대로다(늦은 매핑은 baseline 규칙과 `investor-flows:reingest-13f`가 다룬다).
    // 후보는 이 실행 **시작 시점**에 센 값이라 실행 중의 오류는 이미 후보 안에 있다(그래서 오류 수를 따로 볼 필요가 없다).
    // 기존 매핑 재대조(아래 4)는 일부러 조건에 넣지 않는다 — 그건 유지보수이지 유니버스 완결의 일부가 아니다.
    if (result.status === 'complete' && result.candidates === 0) {
        result.universeCompleted = await markUniverseComplete(deps);
    }

    // 4) 기존 매핑 재대조 — 작은 배치로 오래된 것부터(전수 재처리 금지).
    if (result.status === 'complete' || result.status === 'capped') {
        await recheckExistingMappings(deps, result, mappedFromProfile);
    }
    return result;
}

/**
 * 이미 저장된 `fmp` 매핑을 FMP profile의 현재 CUSIP과 대조한다(실행당 `INVESTOR_FLOWS_CUSIP_RECHECK_BATCH`개,
 * 가장 오래 안 본 것부터). 프로필 CUSIP이 **맵 어디에도 없으면**(액면병합·재상장 등으로 CUSIP이 바뀜) 새 행으로
 * 기록한다 — `created_at`이 지금이라 새 CUSIP은 직전 분기 제출을 파싱한 유니버스 스냅샷보다 늦게 매핑된 것이 되어 그 분기에 baseline이
 * 없다(변화 열 NULL, `aggregateSql.ts`). 옛 행은 그대로 둔다(옛 제출은 옛 CUSIP으로 들어 있다). 이미 쌓인 포지션을
 * 다시 처리하지 않는다. 프로필을 못 읽거나 CUSIP이 없으면 건드리지 않고 `checked_at`만 갱신한다.
 *
 * 같은 실행이 방금 profile로 만든 매핑(`mappedFromProfile`)은 `checked_at`이 비어 있어 맨 앞에 오지만, 그 profile을 막 읽었으므로
 * 다시 받지 않고 대조한 것으로 기록만 한다(FMP 호출이 두 번 나가던 것을 막는다).
 */
async function recheckExistingMappings(
    deps: SyncCusipMapDeps,
    result: SyncCusipMapResult,
    mappedFromProfile: ReadonlySet<string>
): Promise<void> {
    const listed = await deps.repo.listRecheckCandidates(
        INVESTOR_FLOWS_CUSIP_RECHECK_BATCH
    );
    const justMapped = listed.filter(c => mappedFromProfile.has(mappingKey(c)));
    const candidates = listed.filter(
        c => !mappedFromProfile.has(mappingKey(c))
    );
    const checkedIds: number[] = justMapped.map(c => c.id);
    for (let i = 0; i < candidates.length; i += PROFILE_CONCURRENCY) {
        if (deps.isDeadlineReached()) break;
        const chunk = candidates.slice(i, i + PROFILE_CONCURRENCY);
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const settled = await Promise.allSettled(
            chunk.map(c => deps.fetchProfile(c.symbol))
        );
        const proposed: CusipMapRow[] = [];
        let stop = false;
        settled.forEach((outcome, index) => {
            const candidate = chunk[index] as RecheckCandidate;
            if (outcome.status === 'rejected') {
                if (deps.isRateLimitError(outcome.reason)) stop = true;
                else result.errors += 1;
                return; // 대조 못 함 — checked_at을 올리지 않아 다음에 다시 본다
            }
            checkedIds.push(candidate.id);
            result.rechecked += 1;
            const current = parseProfileCusip(outcome.value?.cusip);
            if (current === null || current === candidate.cusip) return;
            proposed.push({
                cusip: current,
                symbol: candidate.symbol,
                source: 'fmp',
            });
        });
        const existing = await deps.repo.findExistingCusips(
            proposed.map(p => p.cusip)
        );
        const created = proposed.filter(p => !existing.has(p.cusip));
        if (created.length > 0) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await deps.repo.upsertCusipMap(created);
            result.cusipChanged += created.length;
            deps.log(
                '[cusip-map] CUSIP changed, recorded as new mapping:',
                created
            );
        }
        if (stop) break;
    }
    await deps.repo.markChecked(checkedIds);
}

/** 표식이 아직 없고 맵이 충분히 찼으면 세운다. 새로 세웠으면 true. */
async function markUniverseComplete(deps: SyncCusipMapDeps): Promise<boolean> {
    const key = INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE;
    if ((await deps.repo.getState(key)) !== null) return false;
    const mapped = await deps.repo.countMapped();
    if (mapped < INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED) {
        deps.log(
            `[cusip-map] no candidates left but only ${mapped} CUSIPs mapped (< ${INVESTOR_FLOWS_UNIVERSE_MIN_MAPPED}) — universe not marked complete`
        );
        return false;
    }
    await deps.repo.setStateIfAbsent(key, deps.now().toISOString());
    deps.log(
        `[cusip-map] full pass complete (${mapped} CUSIPs mapped) — sec-13f ingestion unlocked`
    );
    return true;
}

/** 시도가 충분히 많고(`MIN_ATTEMPTS`) 그 거의 전부가 실패했다 — 심볼 고유 문제가 아니라 전면 장애다. */
function isBlanketOutage(attempts: number, failures: number): boolean {
    return (
        attempts >= INVESTOR_FLOWS_CUSIP_BLANKET_MIN_ATTEMPTS &&
        failures / attempts >= INVESTOR_FLOWS_CUSIP_BLANKET_FAILURE_RATIO
    );
}
