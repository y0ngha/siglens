import type {
    Ingest13fResult,
    Ingest13fStop,
    RunState,
} from './ingest13fTypes';

/** 이 실행의 SEC 요청을 전부 멈추라는 신호 — `isSecBlockedError`가 참인 오류를 감싸 루프 밖으로 올린다. */
export class SecBlockedSignal extends Error {}

/** 마감 때문에 중단하라는 신호 — 실패가 아니라 원장에 기록하지 않는다. */
export class DeadlineSignal extends Error {}

/** 아무 일도 하지 않은 상태의 결과. */
export function emptyIngest13fResult(
    stoppedBy: Ingest13fStop,
    startDate: string
): Ingest13fResult {
    return {
        stoppedBy,
        startDate,
        datesScanned: 0,
        filingsListed: 0,
        filingsProcessed: 0,
        filingsAlreadyDone: 0,
        filingsFailed: 0,
        retried: 0,
        aggregateChunks: 0,
        invalidated: 0,
        pruned: { positions: 0, aggregates: 0, filings: 0 },
        backfillCompleted: false,
    };
}

/** 새 실행의 진행 상태. */
export function createRunState(startDate: string): RunState {
    return {
        attempted: new Set(),
        symbols: new Set(),
        stop: null,
        result: emptyIngest13fResult('complete', startDate),
    };
}
