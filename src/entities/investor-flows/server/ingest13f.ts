import { toUtcIsoDate } from '@/shared/lib/isoDate';
import {
    INVESTOR_FLOWS_13F_BACKFILL_DAYS,
    INVESTOR_FLOWS_13F_MAX_ATTEMPTS,
    INVESTOR_FLOWS_FAILED_BACKLOG_ALERT,
    INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS,
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../lib/investorFlowsPolicy';
import {
    addDays,
    eachDate,
    isWeekend,
    positionsRetentionFloor,
} from '../lib/investorFlowsDates';
import { parseSec13fFormIndex } from '../lib/sec13fIndex';
import { cursorStartDate, isFilingSettled } from '../lib/sec13fIngestPlan';
import type { InvestorFlowsUniverse } from '../api/investorFlowsUniverseRepository';
import { flushDirty, reconcilePeriodModes } from './ingest13fAggregates';
import { markBackfillDone, pruneRetention } from './ingest13fMaintenance';
import {
    createRunState,
    DeadlineSignal,
    emptyIngest13fResult,
    SecBlockedSignal,
} from './ingest13fRunState';
import { processTargets } from './ingest13fTargets';
import type {
    FilingTarget,
    Ingest13fDeps,
    Ingest13fResult,
    RunState,
} from './ingest13fTypes';

/** 한 실행에서 날짜 순회와 별개로 다시 시도하는 실패 제출 수. */
const RETRY_BATCH_SIZE = 100;

/**
 * 13F 증분 수집 — daily form index → 제출별 information table 스트리밍 → 유니버스 필터 → 업서트(+dirty 표시,
 * 같은 트랜잭션) → dirty 큐에서 집계 재계산 → 보존 정리 → 캐시 무효화.
 *
 * 의존(SEC·DB·시계)은 전부 주입된다 — 단위 테스트가 네트워크·DB 없이 흐름을 검증한다. 실제 의존은
 * `app/api/cron/sec-13f/createDeps.ts`가 구성한다(EN-1: I/O 구성은 app 레이어). 단계별 구현은 형제 모듈이 나눠 맡는다 —
 * 제출 하나의 처리(`ingest13fFiling`), 필러 그룹 병렬(`ingest13fTargets`), 집계 모드·flush(`ingest13fAggregates`),
 * 백필 표식·보존 정리(`ingest13fMaintenance`).
 *
 * ── 상태는 DB 하나다(Redis 커서 없음) ─────────────────────────────────────────────
 * 일일 커서 = `max(filing_date)`(원장) − `CURSOR_OVERLAP_DAYS`. 원장이 비어 있으면 오늘 − 200일(백필).
 * 같은 날짜 index를 다시 읽어도 accession이 이미 반영돼 있으면 건너뛰므로 겹침은 비용뿐이다.
 * 실패한 accession은 원장에 `attempts`와 함께 남아 `INVESTOR_FLOWS_13F_MAX_ATTEMPTS`번까지 재시도된다.
 *
 * ── 집계 재계산 의무는 durable하다 ─────────────────────────────────────────────────
 * 바뀐 (period, cusip)는 포지션과 **같은 트랜잭션**에서 `sec_13f_dirty_aggregates`에 기록되고, 재계산이 커밋된
 * 뒤에야 지워진다. 배포·OOM·예외로 실행이 죽어도 다음 실행이 맨 처음에 남은 dirty를 먼저 처리한다.
 *
 * ── 속도·메모리 ──────────────────────────────────────────────────────────────────
 * SEC 호출은 `secClient`의 전역 게이트가 초당 ~4.5건으로 묶는다(제출 1건 = index.json + primary_doc +
 * information table 3건 → 초당 ~1.5건). 제출 병렬도는 `FILING_CONCURRENCY`(같은 필러는 직렬).
 * information table은 청크로 흘려 파싱하고 유니버스 행만 `PositionAccumulator`에 쌓는다 — 제출당 메모리는
 * 고유 유니버스 CUSIP 수에 비례한다.
 */
export async function run13fIngest(
    deps: Ingest13fDeps
): Promise<Ingest13fResult> {
    const now = deps.now();
    const today = toUtcIsoDate(now);
    const backfillStart = addDays(today, -INVESTOR_FLOWS_13F_BACKFILL_DAYS);
    // 배포 순서 게이트: cusip-map이 전수 한 바퀴를 끝내기 전(= 유니버스가 덜 찼을 때)에 제출을 반영하면, 나중에 매핑된
    // CUSIP은 이미 "처리됨"인 제출에서 포지션을 영영 못 얻는다. 표식은 durable하고 한 번 서면 풀리지 않는다.
    if (
        (await deps.repo.getState(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE)) ===
        null
    ) {
        deps.log(
            '[sec-13f] universe_incomplete — cusip-map has not finished a full pass yet; nothing ingested'
        );
        return emptyIngest13fResult('universe_incomplete', backfillStart);
    }
    const startDate = cursorStartDate(
        await deps.repo.latestFilingDate(),
        backfillStart
    );
    const floor = positionsRetentionFloor(today);
    const state = createRunState(startDate);

    const universe = await deps.loadUniverse();
    if (universe.cusips.size === 0) {
        deps.log('[sec-13f] empty universe — run cusip-map first');
        state.result.stoppedBy = 'empty_universe';
        return state.result;
    }

    // 유지보수(집계 flush·정리)는 마감과 별개의 시간 상자 안에서 한다 — 남은 일은 durable이라 다음 실행이 잇는다.
    const maintenanceStop = (startedAt: number) => (): boolean =>
        Date.now() - startedAt > INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS;
    /** 날짜(또는 재시도) 단위로 집계를 확정한다. 이 flush가 못 끝나도 dirty가 남아 있다. */
    const settleAggregates = async (): Promise<void> => {
        // 필러 수가 임계를 넘어 baseline 판정이 바뀌었을 수 있어 flush 전에 모드를 다시 본다.
        await reconcilePeriodModes(deps, floor, today);
        await flushDirty(
            deps,
            state,
            floor,
            today,
            maintenanceStop(Date.now())
        );
    };

    try {
        // 분기 모드가 바뀌었다면(진행 중 → 완결 등) 그 분기를 다시 계산 대상으로 올린 뒤, 이전 실행이 flush 전에
        // 죽어 남긴 dirty까지 먼저 처리한다.
        await reconcilePeriodModes(deps, floor, today);
        await flushDirty(deps, state, floor, today, () =>
            deps.isDeadlineReached()
        );

        for (const date of eachDate(startDate, today)) {
            if (isWeekend(date)) continue;
            if (deps.isDeadlineReached()) throw new DeadlineSignal();
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await ingestDay(
                deps,
                date,
                universe,
                floor,
                state,
                settleAggregates
            );
        }

        // 날짜 범위 밖(커서보다 오래된 날짜)에 남은 실패 제출을 다시 시도한다.
        const pending = (
            await deps.repo.listPendingRetries(
                INVESTOR_FLOWS_13F_MAX_ATTEMPTS,
                RETRY_BATCH_SIZE
            )
        ).filter(p => !state.attempted.has(p.accession));
        state.result.retried = pending.length;
        try {
            await processTargets(
                deps,
                pending.map(p => ({
                    accession: p.accession,
                    cik: p.cik,
                    filingDate: p.filingDate,
                    formType: p.submissionType,
                    companyName: null,
                })),
                universe,
                floor,
                state
            );
        } finally {
            await settleAggregates();
        }
    } catch (error) {
        if (error instanceof DeadlineSignal)
            state.result.stoppedBy = 'deadline';
        else if (error instanceof SecBlockedSignal) {
            state.result.stoppedBy = 'sec_blocked';
            // 메트릭 필터 접두(`[sec-13f] sec_blocked`) — 반복되면 알람(infra/aws/18-*).
            deps.log(
                '[sec-13f] sec_blocked — SEC refused the request, stopping'
            );
        } else throw error;
    }

    if (state.result.stoppedBy !== 'sec_blocked') {
        state.result.pruned = await pruneRetention(
            deps,
            today,
            maintenanceStop(Date.now())
        );
        const exhausted = await deps.repo.countExhaustedFailures(
            INVESTOR_FLOWS_13F_MAX_ATTEMPTS
        );
        if (exhausted >= INVESTOR_FLOWS_FAILED_BACKLOG_ALERT) {
            deps.log(
                `[sec-13f] backlog of permanently failed accessions: ${exhausted}`
            );
        }
    }

    const toInvalidate = [...state.symbols].slice(
        0,
        INVESTOR_FLOWS_REVALIDATE_CAP
    );
    if (toInvalidate.length > 0) {
        await deps.invalidateSymbols(toInvalidate);
        state.result.invalidated = toInvalidate.length;
    }
    // 표식은 이번 실행이 **깔끔하게** 끝났을 때만 선다: 무효화 상한(500)에 잘려 낡은 심볼 캐시가 남지 않았고(`state.symbols`가
    // 상한 이하), dirty 큐가 비었다(집계가 모두 반영됨). 아니면 다음 실행이 다시 판정한다 — 표식이 서는 순간 "수집 중" 안내가
    // 걷히고 빈 구간은 "데이터 없음"이 되므로, 아직 안 채워진 종목이 있는 채로 서면 안 된다.
    if (
        state.result.stoppedBy === 'complete' &&
        state.symbols.size <= INVESTOR_FLOWS_REVALIDATE_CAP
    ) {
        state.result.backfillCompleted = await markBackfillDone(deps);
        if (state.result.backfillCompleted) await deps.onBackfillCompleted?.();
    }
    return state.result;
}

/**
 * 하루치 index를 읽어 아직 반영되지 않은 제출을 처리하고 집계를 확정한다. index가 없는 날(휴일·미공개)은 아무것도 하지
 * 않는다. 처리 도중 마감·차단·오류로 던져도 집계 확정(`settle`)은 `finally`에서 돈다.
 */
async function ingestDay(
    deps: Ingest13fDeps,
    date: string,
    universe: InvestorFlowsUniverse,
    floor: string,
    state: RunState,
    settle: () => Promise<void>
): Promise<void> {
    let text: string | null;
    try {
        text = await deps.sec.fetchDailyFormIndex(date);
    } catch (error) {
        if (deps.isSecBlockedError(error)) throw new SecBlockedSignal();
        throw error;
    }
    state.result.datesScanned += 1;
    if (text === null) return;
    const entries = parseSec13fFormIndex(text);
    state.result.filingsListed += entries.length;
    const known = await deps.repo.findFilings(entries.map(e => e.accession));
    const targets: FilingTarget[] = [];
    for (const entry of entries) {
        if (isFilingSettled(known.get(entry.accession))) {
            state.result.filingsAlreadyDone += 1;
            continue;
        }
        targets.push(entry);
    }
    try {
        await processTargets(deps, targets, universe, floor, state);
    } finally {
        await settle();
    }
}
