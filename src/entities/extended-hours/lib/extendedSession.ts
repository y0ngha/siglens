import {
    PRE_MARKET_OPEN_MINUTE,
    etDayWallMs,
    etWallClock,
    usSessionDayAt,
} from '@/shared/api/market/usSessionClock';
import type { ExtendedSessionKind } from '../model';

export interface ExtendedSessionWindow {
    kind: ExtendedSessionKind;
    /** 세션 시작 UTC epoch ms — 이보다 이른 체결은 이전 세션 것이다. */
    startMs: number;
    /** 세션 종료 UTC epoch ms(미포함). */
    endMs: number;
    /** `now`가 속한 ET 달력일 번호(`etDayNumber`). */
    etDay: number;
}

/**
 * `now`가 미국 주식의 프리마켓/애프터마켓이면 그 세션 창을, 아니면 `null`.
 *
 * 세션 경계·달력은 `usSessionClock`(core 달력)이 단일 출처다 — 주말·NYSE 휴장일·예정 외 휴장은
 * 거래일이 아니라 `null`이고, 반장일(13:00 마감)은 애프터마켓이 13:00에 시작해 17:00에 끝난다.
 * 정규장(09:30~마감)은 `null`이다.
 *
 * 분 단위 경계: `[04:00, 09:30)` 프리, `[마감, 20:00)` 애프터.
 */
export function extendedSessionAt(now: Date): ExtendedSessionWindow | null {
    const day = usSessionDayAt(now);
    if (!day.tradingDay) return null;

    const { day: etDay, minuteOfDay } = etWallClock(now.getTime());
    const atMinute = (minute: number): number => etDayWallMs(etDay, minute);

    if (minuteOfDay >= PRE_MARKET_OPEN_MINUTE && minuteOfDay < day.openMinute) {
        return {
            kind: 'pre-market',
            startMs: atMinute(PRE_MARKET_OPEN_MINUTE),
            endMs: atMinute(day.openMinute),
            etDay,
        };
    }
    if (
        minuteOfDay >= day.closeMinute &&
        minuteOfDay < day.afterHoursEndMinute
    ) {
        return {
            kind: 'after-hours',
            startMs: atMinute(day.closeMinute),
            endMs: atMinute(day.afterHoursEndMinute),
            etDay,
        };
    }
    return null;
}
