import type { ScanCursor, ScanFailureOutcome } from '../types';
import { isSymbolSettled } from './scanMode';

/** 한 종목을 한 번 시도한 결과. */
export type ScanAttemptOutcome = 'recorded' | ScanFailureOutcome;

export interface ScanAttempt {
    readonly symbol: string;
    readonly outcome: ScanAttemptOutcome;
    /**
     * 이 시도가 DB에 실제로 써졌는가(기본 true). `false`인 실패 시도는 DB의 시도 횟수에 없으므로 접지 않는다 —
     * 접으면 써지지 않은 시도로 세션이 "완료"로 찍힌다.
     */
    readonly persisted?: boolean;
}

/**
 * 이번 실행의 시도를 진행 표식에 접는다 — DB가 하는 일(`applySymbolScan`·`recordScanFailure`)을 메모리에서
 * 똑같이 한다. 실행 끝의 세션 집계(`summarizeSession`)가 DB를 다시 읽지 않게 하려는 것이다.
 */
export function applyScanAttempts(
    cursors: ReadonlyMap<string, ScanCursor>,
    session: string,
    attempts: readonly ScanAttempt[]
): ReadonlyMap<string, ScanCursor> {
    return new Map([
        ...cursors,
        ...attempts
            .filter(attempt => attempt.persisted !== false)
            .map(({ symbol, outcome }) => {
                const previous = cursors.get(symbol);
                const next: ScanCursor =
                    outcome === 'recorded'
                        ? {
                              lastSession: session,
                              attemptSession: null,
                              attempts: 0,
                              lastOutcome: 'recorded',
                          }
                        : {
                              lastSession: previous?.lastSession ?? null,
                              attemptSession: session,
                              attempts:
                                  previous?.attemptSession === session
                                      ? previous.attempts + 1
                                      : 1,
                              lastOutcome: outcome,
                          };
                return [symbol, next] as const;
            }),
    ]);
}

/** 한 세션의 대상 전체 집계 — `signal_scan_sessions` 한 줄의 내용. */
export interface SessionSummary {
    readonly recorded: number;
    readonly failed: number;
    readonly stale: number;
    /** 기록되지 않았지만 이 세션의 시도를 다 써서 정리된 종목 수. */
    readonly settledFailed: number;
    /** 모든 대상이 기록됐거나 정리됐다. */
    readonly allSettled: boolean;
}

function isRecordedFor(
    cursor: ScanCursor | undefined,
    session: string
): boolean {
    return (
        cursor !== undefined &&
        cursor.lastSession !== null &&
        cursor.lastSession >= session
    );
}

function failureCountsFor(
    cursor: ScanCursor | undefined,
    session: string,
    outcome: ScanFailureOutcome
): boolean {
    return (
        !isRecordedFor(cursor, session) &&
        cursor?.attemptSession === session &&
        cursor.lastOutcome === outcome
    );
}

export function summarizeSession(
    symbols: readonly string[],
    cursors: ReadonlyMap<string, ScanCursor>,
    session: string,
    maxAttempts: number
): SessionSummary {
    const count = (predicate: (cursor: ScanCursor | undefined) => boolean) =>
        symbols.filter(symbol => predicate(cursors.get(symbol))).length;
    const settled = count(cursor =>
        isSymbolSettled(cursor, session, maxAttempts)
    );
    const recorded = count(cursor => isRecordedFor(cursor, session));
    return {
        recorded,
        failed: count(cursor => failureCountsFor(cursor, session, 'failed')),
        stale: count(cursor => failureCountsFor(cursor, session, 'stale')),
        settledFailed: settled - recorded,
        allSettled: settled === symbols.length,
    };
}
