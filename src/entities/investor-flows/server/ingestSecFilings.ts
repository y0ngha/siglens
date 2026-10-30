import { toUtcIsoDate } from '@/shared/lib/isoDate';
import { addDays, eachDate, isWeekend } from '../lib/investorFlowsDates';
import { deriveFilingsStatus } from '../lib/investorFlowsReadiness';
import {
    INVESTOR_FLOWS_FAILED_BACKLOG_ALERT,
    INVESTOR_FLOWS_REVALIDATE_CAP,
    INVESTOR_FLOWS_SEC_FILINGS_BACKFILL_DAYS,
    INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
    INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../lib/investorFlowsPolicy';
import { selectIndexTargets } from '../lib/offeringIndex';
import { parseSecFormIndex } from '../lib/secFormIndex';
import {
    INDEX_FORMS,
    filingsPruneCutoffs,
    planDay,
    planRetries,
    secFilingsStartDate,
} from '../lib/secFilingsPlan';
import type { FilingsPruneResult } from '../api/investorFlowsFilingsRepository';
import {
    DeadlineSignal,
    SecBlockedSignal,
    persist,
    runDocumentJobs,
} from './secDocumentJobs';
import type {
    IngestSecFilingsDeps,
    IngestSecFilingsResult,
    RunState,
} from './ingestSecFilingsTypes';

/** 한 실행에서 날짜 순회와 별개로 다시 시도하는 실패 문서 수. */
const SEC_FILINGS_RETRY_BATCH_SIZE = 50;
const STATE_PRUNE_DAY = 'sec_filings_prune_day';

const emptyPruned = (): FilingsPruneResult => ({
    form144: 0,
    offerings: 0,
    failures: 0,
});

/** 하루치 index를 처리한다 — 문서 없는 증자 공시는 바로 저장하고, 문서가 필요한 것(Form 144·424B5)만 받는다. */
async function processDay(
    deps: IngestSecFilingsDeps,
    text: string,
    cikSymbols: ReadonlyMap<number, readonly string[]>,
    state: RunState
): Promise<void> {
    const targets = selectIndexTargets(
        parseSecFormIndex(text, INDEX_FORMS),
        cikSymbols
    );
    if (targets.length === 0) return;
    const accessions = targets.map(t => t.accession);
    const [storedForm144, storedOfferings, failures] = await Promise.all([
        deps.repo.findStoredForm144(accessions),
        deps.repo.findStoredOfferings(accessions),
        deps.repo.findFailureAttempts(accessions),
    ]);
    const plan = planDay(targets, storedForm144, storedOfferings, failures);
    await persist(deps, state, [], plan.formOnly);
    await runDocumentJobs(deps, plan.documents, cikSymbols, state);
}

/** 날짜 순회 밖에 남은 실패 문서를 다시 시도한다. */
async function processRetries(
    deps: IngestSecFilingsDeps,
    cikSymbols: ReadonlyMap<number, readonly string[]>,
    state: RunState
): Promise<void> {
    const pending = (
        await deps.repo.listRetries(
            INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
            SEC_FILINGS_RETRY_BATCH_SIZE
        )
    ).filter(retry => !state.attempted.has(retry.accession));
    state.result.retried = pending.length;
    await runDocumentJobs(
        deps,
        planRetries(pending, cikSymbols),
        cikSymbols,
        state
    );
}

/**
 * Form 144(매도 예정 신고)·증자/희석 공시 증분 수집 — `sec-13f` cron 실행 **안에서** 13F 다음에 자기 몫의 시간으로 돈다
 * (`runSecIndexIngest` — 13F 백필 중에도 매 실행). 같은 daily form index(`form.YYYYMMDD.idx`)를 읽고 같은 SEC 게이트·공유 락 아래라 cron 합계 SEC 속도가
 * 늘지 않는다(`shared/config/investorFlows.ts`의 불변식).
 *
 * ── 커서는 13F와 따로다 ─────────────────────────────────────────────────────────────────────────────
 * `investor_flows_state.sec_filings_cursor` = 끝까지 처리한 마지막 날짜. 다음 실행은 `커서 − SEC_FILINGS_CURSOR_OVERLAP_DAYS`부터(비어
 * 있으면 오늘 − 180일) 오늘까지 평일 index를 읽는다. 13F 백필과 독립이라 어느 쪽이 먼저 끝나도 된다.
 *
 * ── 문서 요청은 유니버스 발행사에만 ──────────────────────────────────────────────────────────────────
 * index 줄의 CIK가 `sec_cik_symbol_map`에 있는 accession만 대상이다(`selectIndexTargets`). Form 144는 `primary_doc.xml`(≈5KB) 하나,
 * `424B5`는 제출 `.txt`의 앞 256KB만(판매 방식 분류), 그 밖의 증자 양식은 **문서 없이** 양식으로 종류가 정해진다.
 * 이미 저장된 accession·시도를 소진한 실패·음성 표식(읽었지만 유니버스 밖 발행사라 저장하지 않은 Form 144)은 다시 받지 않는다.
 * 문서 실패는 `sec_filings_failures`에 남아 최대 3번 재시도된다.
 *
 * 의존(SEC·DB·시계)은 전부 주입된다(EN-1: I/O 구성은 `app/api/cron/sec-13f/createDeps.ts`). 문서 받기·저장은 `secDocumentJobs`,
 * 무엇을 받을지의 판정은 `lib/secFilingsPlan`이 맡는다.
 */
export async function runSecFilingsIngest(
    deps: IngestSecFilingsDeps
): Promise<IngestSecFilingsResult> {
    const today = toUtcIsoDate(deps.now());
    const backfillStart = addDays(
        today,
        -INVESTOR_FLOWS_SEC_FILINGS_BACKFILL_DAYS
    );
    const cursor = await deps.repo.getState(
        INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR
    );
    const startDate = secFilingsStartDate(cursor, backfillStart);
    const state: RunState = {
        symbols: new Set(),
        attempted: new Set(),
        result: {
            stoppedBy: 'complete',
            startDate,
            datesScanned: 0,
            cursor,
            form144Stored: 0,
            offeringsStored: 0,
            documentsFetched: 0,
            documentsFailed: 0,
            documentsSkipped: 0,
            retried: 0,
            invalidated: 0,
            pruned: emptyPruned(),
            caughtUp: false,
        },
    };

    // 13F와 같은 배포 순서 게이트(유니버스가 덜 찬 채로 수집하지 않는다).
    if (
        (await deps.repo.getState(INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE)) ===
        null
    ) {
        state.result.stoppedBy = 'universe_incomplete';
        return state.result;
    }
    const cikSymbols = await deps.repo.loadCikSymbols();
    if (cikSymbols.size === 0) {
        deps.log(
            '[sec-filings] cik_map_empty — sec_cik_symbol_map is empty (cusip-map syncs company_tickers.json weekly); nothing ingested'
        );
        state.result.stoppedBy = 'cik_map_empty';
        return state.result;
    }

    try {
        for (const date of eachDate(startDate, today)) {
            if (isWeekend(date)) continue;
            if (deps.isDeadlineReached()) throw new DeadlineSignal();
            let text: string | null;
            try {
                // 날짜는 순서대로 하나씩 — 커서가 앞으로만 간다.
                // react-doctor-disable-next-line react-doctor/async-await-in-loop
                text = await deps.sec.fetchDailyFormIndex(date);
            } catch (error) {
                if (deps.isSecBlockedError(error)) throw new SecBlockedSignal();
                throw error;
            }
            state.result.datesScanned += 1;
            // 없는 날(휴일·아직 미공개)은 커서를 움직이지 않는다 — 다음 실행이 겹침 구간에서 다시 본다.
            if (text === null) continue;
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await processDay(deps, text, cikSymbols, state);
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await deps.repo.setState(
                INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR,
                date
            );
            state.result.cursor = date;
        }
        await processRetries(deps, cikSymbols, state);
    } catch (error) {
        if (error instanceof DeadlineSignal)
            state.result.stoppedBy = 'deadline';
        else if (error instanceof SecBlockedSignal) {
            state.result.stoppedBy = 'sec_blocked';
            // 메트릭 필터 접두(`[sec-filings] sec_blocked`, infra/aws/19-*).
            deps.log(
                '[sec-filings] sec_blocked — SEC refused the request, stopping'
            );
        } else throw error;
    }

    if (state.result.stoppedBy !== 'sec_blocked') {
        state.result.pruned = await pruneDaily(deps, today);
        const exhausted = await deps.repo.countExhaustedFailures(
            INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS
        );
        if (exhausted >= INVESTOR_FLOWS_FAILED_BACKLOG_ALERT) {
            deps.log(
                `[sec-filings] backlog of permanently failed documents: ${exhausted}`
            );
        }
    }
    const toInvalidate = [...state.symbols]
        .toSorted()
        .slice(0, INVESTOR_FLOWS_REVALIDATE_CAP);
    if (toInvalidate.length > 0) {
        await deps.invalidateSymbols(toInvalidate);
        state.result.invalidated = toInvalidate.length;
    }
    state.result.caughtUp =
        deriveFilingsStatus(cursor, today) === 'collecting' &&
        deriveFilingsStatus(state.result.cursor, today) === 'ready';
    if (state.result.caughtUp) await deps.onCaughtUp?.();
    return state.result;
}

/** 보존 정리는 하루 한 번(`sec_filings_prune_day`). */
async function pruneDaily(
    deps: IngestSecFilingsDeps,
    today: string
): Promise<FilingsPruneResult> {
    if ((await deps.repo.getState(STATE_PRUNE_DAY)) === today)
        return emptyPruned();
    const pruned = await deps.repo.pruneBefore(filingsPruneCutoffs(today));
    await deps.repo.setState(STATE_PRUNE_DAY, today);
    return pruned;
}
