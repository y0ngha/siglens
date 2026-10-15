import {
    REGULAR_CLOSE_MINUTE,
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

/**
 * 미국 주식 **확장 세션**(프리·애프터마켓)의 시계 — 세션 경계와 ET 날짜 산술의 **단일 출처**.
 *
 * 확장 시세 한 줄(`entities/extended-hours`)과 확장 봉(`extendedBarsSession`)이 각자 04:00·20:00·반장일
 * 17:00·거래일 판정·ET 날짜 계산을 들고 있었고, 반장일 TTL이 서로 갈렸다(봉 쪽만 17:00 이후에도 라이브로
 * 봤다). 이제 둘 다 여기서 가져온다. 달력(휴장·반장)은 core를 그대로 쓴다.
 *
 * 세션 판정이라 `shared/lib`가 아니라 세션 스펙이 사는 `shared/api/market`에 둔다(`sessionSpecFor`와 같은 자리).
 */

/** 프리마켓 시작 04:00 ET. */
export const PRE_MARKET_OPEN_MINUTE = 4 * MINUTES_PER_HOUR;
/** 애프터마켓 종료 20:00 ET (정규 마감일). */
export const AFTER_HOURS_END_MINUTE = 20 * MINUTES_PER_HOUR;
/** 13:00 반장 마감일의 애프터마켓은 17:00 ET까지다. */
export const EARLY_CLOSE_AFTER_HOURS_END_MINUTE = 17 * MINUTES_PER_HOUR;

/**
 * 그 ET 날짜의 거래일 여부를 물을 때 쓰는 UTC 시각(17시). EDT(UTC−4)에서는 13시, EST(UTC−5)에서는
 * 12시라 서머타임과 무관하게 같은 ET 날짜 한가운데를 가리킨다 — 자정 근처로 물으면 날짜가 어긋난다.
 */
const ET_MIDDAY_PROBE_UTC_HOUR = 17;

/** 직전·다음 거래일을 찾는 탐색 상한(일). 최장 연휴(주말 + 인접 휴장일)도 나흘을 넘지 않는다. */
export const MAX_TRADING_DAY_SEARCH_DAYS = 10;

/**
 * epoch ms가 속한 ET 달력일의 일련번호(1970-01-01 = 0). 두 시각의 ET 날짜 비교용이다.
 * 오프셋은 그 시각 기준으로 잰다(`getEasternOffsetHours`) — DST 전환은 일요일 02:00이라
 * 거래일 하나 안에서 오프셋이 바뀌는 일은 없다.
 */
export function etDayNumber(ms: number): number {
    const offset = getEasternOffsetHours(new Date(ms));
    return Math.floor((ms + offset * MS_PER_HOUR) / MS_PER_DAY);
}

/** epoch ms의 ET 벽시계: 날 번호와 그날 자정으로부터 경과한 분(소수 없음). */
export function etWallClock(ms: number): { day: number; minuteOfDay: number } {
    const offset = getEasternOffsetHours(new Date(ms));
    const etMs = ms + offset * MS_PER_HOUR;
    const day = Math.floor(etMs / MS_PER_DAY);
    return {
        day,
        minuteOfDay: Math.floor((etMs - day * MS_PER_DAY) / MS_PER_MINUTE),
    };
}

/** ET 날짜 `etDay`의 정오 부근 UTC 시각 — 그 날의 오프셋·거래일 여부를 물을 때 쓴다. */
function etMiddayProbeMs(etDay: number): number {
    return etDay * MS_PER_DAY + ET_MIDDAY_PROBE_UTC_HOUR * MS_PER_HOUR;
}

/** ET 날짜 `etDay`의 `minuteOfDay`(ET 벽시계)가 가리키는 UTC epoch ms. 그 날의 오프셋을 쓴다. */
export function etDayWallMs(etDay: number, minuteOfDay: number): number {
    const offset = getEasternOffsetHours(new Date(etMiddayProbeMs(etDay)));
    return (
        etDay * MS_PER_DAY + minuteOfDay * MS_PER_MINUTE - offset * MS_PER_HOUR
    );
}

/** ET 날짜 `etDay`가 거래일(주말·NYSE 휴장일 제외)인가. */
export function isTradingEtDay(etDay: number): boolean {
    return isUsTradingDay(new Date(etMiddayProbeMs(etDay)));
}

/**
 * `etDay` **보다 앞선** 가장 가까운 거래일의 ET 날 번호. 탐색 상한 안에 없으면 `null`.
 */
export function previousTradingEtDay(etDay: number): number | null {
    for (let back = 1; back <= MAX_TRADING_DAY_SEARCH_DAYS; back += 1) {
        if (isTradingEtDay(etDay - back)) return etDay - back;
    }
    return null;
}

export interface UsSessionDay {
    /** 그 ET 날짜가 거래일인가(주말·휴장일이면 `false`). */
    tradingDay: boolean;
    /** 정규장 개장(ET 분). */
    openMinute: number;
    /** 정규장 마감(ET 분) — 반장일 13:00. 휴장일은 core가 0을 주므로 정규 마감으로 폴백한다(휴장일엔 봉이 없다). */
    closeMinute: number;
    /** 애프터마켓 종료(ET 분) — 정규 마감일 20:00, 반장일 17:00. */
    afterHoursEndMinute: number;
}

/** `at`이 속한 ET 날짜의 세션 경계. */
export function usSessionDayAt(at: Date): UsSessionDay {
    return {
        tradingDay: isUsTradingDay(at),
        openMinute:
            US_EQUITY_SESSION.kind === 'scheduled'
                ? US_EQUITY_SESSION.openMinute
                : PRE_MARKET_OPEN_MINUTE,
        closeMinute: usMarketCloseMinute(at) || REGULAR_CLOSE_MINUTE,
        afterHoursEndMinute: isUsMarketEarlyClose(at)
            ? EARLY_CLOSE_AFTER_HOURS_END_MINUTE
            : AFTER_HOURS_END_MINUTE,
    };
}
