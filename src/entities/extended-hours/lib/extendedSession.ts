import {
    US_EQUITY_SESSION,
    isUsMarketEarlyClose,
    isUsTradingDay,
    usMarketCloseMinute,
} from '@y0ngha/siglens-core';
import { getEasternOffsetHours } from '@/shared/lib/eastern';
import {
    MINUTES_PER_HOUR,
    MS_PER_DAY,
    MS_PER_HOUR,
    MS_PER_MINUTE,
} from '@/shared/config/time';
import type { ExtendedSessionKind } from '../model';

/** 프리마켓 시작 04:00 ET. */
const PRE_MARKET_OPEN_MINUTE = 4 * MINUTES_PER_HOUR;
/** 애프터마켓 종료 20:00 ET (정규 마감일). */
const AFTER_HOURS_END_MINUTE = 20 * MINUTES_PER_HOUR;
/** 13:00 반장 마감일의 애프터마켓은 17:00 ET까지다. */
const EARLY_CLOSE_AFTER_HOURS_END_MINUTE = 17 * MINUTES_PER_HOUR;

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
 * epoch ms가 속한 ET 달력일의 일련번호(1970-01-01 = 0). 두 시각의 ET 날짜 비교용이다.
 * 오프셋은 그 시각 기준으로 잰다(`getEasternOffsetHours`) — DST 전환은 일요일 02:00이라
 * 거래일 하나 안에서 오프셋이 바뀌는 일은 없다.
 */
export function etDayNumber(ms: number): number {
    const offset = getEasternOffsetHours(new Date(ms));
    return Math.floor((ms + offset * MS_PER_HOUR) / MS_PER_DAY);
}

/** 직전 거래일을 찾는 탐색 상한(일). 최장 연휴(주말 + 인접 휴장일)도 나흘을 넘지 않는다. */
const MAX_PREVIOUS_TRADING_DAY_LOOKBACK = 10;

/**
 * `etDay`(ET 달력일 번호) **보다 앞선** 가장 가까운 거래일의 ET 달력일 번호. 주말·NYSE 휴장일을
 * 건너뛴다(core `isUsTradingDay`). 탐색 상한 안에 없으면 `null`.
 *
 * 날짜의 정오 부근 순간(17:00Z = 12:00 EST / 13:00 EDT)으로 판정한다 — 어느 오프셋에서도 그 ET
 * 날짜 안이다.
 */
export function previousTradingEtDay(etDay: number): number | null {
    for (let back = 1; back <= MAX_PREVIOUS_TRADING_DAY_LOOKBACK; back += 1) {
        const candidate = etDay - back;
        if (
            isUsTradingDay(new Date(candidate * MS_PER_DAY + 17 * MS_PER_HOUR))
        ) {
            return candidate;
        }
    }
    return null;
}

/**
 * `now`가 미국 주식의 프리마켓/애프터마켓이면 그 세션 창을, 아니면 `null`.
 *
 * 달력은 core(`isUsTradingDay`·`usMarketCloseMinute`·`isUsMarketEarlyClose`)를 그대로 쓴다 —
 * 주말·NYSE 휴장일·예정 외 휴장은 거래일이 아니라 `null`이고, 반장일(13:00 마감)은 애프터마켓이
 * 13:00에 시작해 17:00에 끝난다. 정규장(09:30~마감)은 `null`이다.
 *
 * 분 단위 경계: `[04:00, 09:30)` 프리, `[마감, 20:00)` 애프터.
 */
export function extendedSessionAt(now: Date): ExtendedSessionWindow | null {
    if (!isUsTradingDay(now)) return null;

    const offset = getEasternOffsetHours(now);
    const etMs = now.getTime() + offset * MS_PER_HOUR;
    const etDay = Math.floor(etMs / MS_PER_DAY);
    const minuteOfDay = Math.floor((etMs - etDay * MS_PER_DAY) / MS_PER_MINUTE);
    const dayStartMs = etDay * MS_PER_DAY - offset * MS_PER_HOUR;
    const atMinute = (minute: number): number =>
        dayStartMs + minute * MS_PER_MINUTE;

    const openMinute =
        US_EQUITY_SESSION.kind === 'scheduled'
            ? US_EQUITY_SESSION.openMinute
            : PRE_MARKET_OPEN_MINUTE;
    const closeMinute = usMarketCloseMinute(now);
    const afterEndMinute = isUsMarketEarlyClose(now)
        ? EARLY_CLOSE_AFTER_HOURS_END_MINUTE
        : AFTER_HOURS_END_MINUTE;

    if (minuteOfDay >= PRE_MARKET_OPEN_MINUTE && minuteOfDay < openMinute) {
        return {
            kind: 'pre-market',
            startMs: atMinute(PRE_MARKET_OPEN_MINUTE),
            endMs: atMinute(openMinute),
            etDay,
        };
    }
    if (minuteOfDay >= closeMinute && minuteOfDay < afterEndMinute) {
        return {
            kind: 'after-hours',
            startMs: atMinute(closeMinute),
            endMs: atMinute(afterEndMinute),
            etDay,
        };
    }
    return null;
}
