import { INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN } from '../lib/investorFlowsPolicy';
import type {
    IngestDartFilingsResult,
    IngestDartFilingsStatus,
    RunContext,
} from './ingestDartFilingsTypes';

/** 아무 일도 하지 않은 상태의 결과. */
export const emptyResult = (
    status: IngestDartFilingsStatus
): IngestDartFilingsResult => ({
    status,
    calls: 0,
    listPages: 0,
    listComplete: false,
    changedCorps: 0,
    tradingPlansStored: 0,
    corpsRefetched: 0,
    backfillCorps: 0,
    backfillRemaining: 0,
    backfillDone: false,
    pendingRemaining: 0,
    failedCorps: 0,
    droppedCorps: 0,
    majorRowsStored: 0,
    insiderRowsStored: 0,
    skippedRows: 0,
    mismatchedRows: 0,
    unmappedSymbols: 0,
    invalidated: 0,
    pruned: 0,
});

/** 호출 `count`건을 시작해도 되는가 — 아니면 멈춘 이유를 기록한다. */
export function canCall(ctx: RunContext, count: number): boolean {
    if (ctx.stop !== null) return false;
    if (ctx.deps.isDeadlineReached()) {
        ctx.stop = 'deadline';
        return false;
    }
    if (ctx.calls + count > INVESTOR_FLOWS_DART_MAX_CALLS_PER_RUN) {
        ctx.stop = 'call_cap';
        return false;
    }
    return true;
}

/** DART 거절(할당량·IP·키·점검)이면 실행을 멈추고 true. 그 밖의 오류는 false(호출부가 그 요청만 실패로 센다). */
export function stopOnFatal(ctx: RunContext, error: unknown): boolean {
    const reason = ctx.deps.fatalReason(error);
    if (reason === null) return false;
    // `disabled`는 실행 시작에서 걸러지므로 여기 오지 않지만, 오면 키 문제와 같이 다룬다.
    ctx.stop = reason === 'disabled' ? 'auth_failed' : reason;
    ctx.deps.log(
        `[dart-filings] ${ctx.stop} — DART refused the request, stopping`
    );
    return true;
}

/** 로그·실패 기록에 싣는 오류 메시지(300자까지). */
export const errorMessage = (error: unknown): string =>
    (error instanceof Error ? error.message : String(error)).slice(0, 300);
