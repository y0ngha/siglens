import type { MarketSessionSpec } from '@y0ngha/siglens-core';
import { previousSessionDate } from '@/shared/lib/marketSessionDate';
import type { ScanCursor } from '../types';
import { SIGNAL_HISTORY_BOOTSTRAP_SESSIONS } from './signalScanConstants';

/**
 * 종목 하나를 어떻게 기록할지.
 * - `bootstrap`: 진행 표식이 없거나 한 번도 성공하지 못했다 — 최근 `SIGNAL_HISTORY_BOOTSTRAP_SESSIONS` 세션을 다시 계산한다.
 * - `catch_up`: 직전 세션까지 이어지지 못했다(놓친 실행·실패) — 마지막 기록 이후 세션을 채운다.
 * - `normal`: 직전 세션까지 기록돼 있다 — 이번 세션 하루만.
 */
export type ScanMode = 'bootstrap' | 'catch_up' | 'normal';

export function scanModeFor(
    cursor: ScanCursor | undefined,
    spec: MarketSessionSpec,
    session: string
): ScanMode {
    if (cursor === undefined || cursor.lastSession === null) return 'bootstrap';
    return cursor.lastSession < previousSessionDate(spec, session)
        ? 'catch_up'
        : 'normal';
}

/** 이 종목이 이번 세션에 이미 정리됐는가 — 기록됐거나, 이 세션의 시도를 다 썼다. */
export function isSymbolSettled(
    cursor: ScanCursor | undefined,
    session: string,
    maxAttempts: number
): boolean {
    if (cursor === undefined) return false;
    if (cursor.lastSession !== null && cursor.lastSession >= session) {
        return true;
    }
    return cursor.attemptSession === session && cursor.attempts >= maxAttempts;
}

/**
 * 모드별로 판정할 날 수 — 판정 구간은 봉의 **마지막 그만큼**이다. `barDates`는 오름차순 봉 날짜
 * (`YYYY-MM-DD`)이고 마지막이 `session`이다(신선도는 호출자가 확인한다).
 * - bootstrap: `SIGNAL_HISTORY_BOOTSTRAP_SESSIONS`일(봉이 모자라면 있는 만큼)
 * - catch_up: `lastSession` 이후 봉 수, 같은 상한까지
 * - normal: 하루
 */
export function scanDayCount(
    mode: ScanMode,
    barDates: readonly string[],
    lastSession: string | null
): number {
    if (mode === 'normal') return Math.min(1, barDates.length);
    const available =
        mode === 'bootstrap' || lastSession === null
            ? barDates.length
            : barDates.filter(date => date > lastSession).length;
    return Math.min(SIGNAL_HISTORY_BOOTSTRAP_SESSIONS, available);
}
