import type { Bar, Timeframe } from '@y0ngha/siglens-core';
import {
    MAX_TRADING_DAY_SEARCH_DAYS,
    PRE_MARKET_OPEN_MINUTE,
    etDayWallMs,
    etWallClock,
    isTradingEtDay,
    usSessionDayAt,
    type UsSessionDay,
} from '@/shared/api/market/usSessionClock';
import {
    MS_PER_SECOND,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';

/**
 * 미국 주식 인트라데이 **확장 세션 봉**(프리마켓·애프터마켓)의 순수 규칙.
 *
 * FMP `historical-chart`의 `extended=true` 응답은 04:00~19:55 ET를 한 줄로 준다. 정규장 봉(분석·
 * 지표의 입력)은 이미 다른 경로(`bars:*`)가 들고 있으므로, 여기서는 **정규장 밖의 봉만** 추린다.
 *
 * ## 왜 "겹치면 정규장이 이긴다"인가
 *
 * 5·15·30분봉은 확장 응답의 정규장 구간 봉이 정규 응답과 같은 시각·같은 버킷이라 시각으로 중복을
 * 지우면 된다. 1시간·4시간봉은 확장 버킷이 **시계 정각**(04:00, 05:00…; 4h는 04/08/12/16)에 정렬돼
 * 09:30 개장·16:00 마감을 가로지른다 — 09:00 1시간 봉은 프리마켓 30분 + 정규장 30분이 섞여 있고,
 * 정규 응답의 09:30 봉과 시각이 다르다. 둘 다 그리면 같은 정규장 구간이 두 번(서로 다른 OHLC로)
 * 그려지고 지표 점(정규 봉 시각)과도 어긋난다. 그래서 확장 봉은 **버킷 전체가 정규장 밖일 때만**
 * 남긴다 — 정규장 봉은 한 개도 바뀌지 않는다.
 *
 * - 프리마켓: 버킷 끝(`start + interval`)이 개장(09:30) 이하. 1h는 04:00~08:00 시작, 4h는 04:00만.
 * - 애프터마켓: 버킷 시작이 마감(16:00, 반장일 13:00) 이상.
 */

/** 확장 세션 봉을 지원하는 인트라데이 타임프레임(1Day는 `extended`를 무시한다). */
export const EXTENDED_BAR_TIMEFRAMES = [
    '5Min',
    '15Min',
    '30Min',
    '1Hour',
    '4Hour',
] as const satisfies readonly Timeframe[];

export type ExtendedBarTimeframe = (typeof EXTENDED_BAR_TIMEFRAMES)[number];

export function isExtendedBarTimeframe(
    value: unknown
): value is ExtendedBarTimeframe {
    return (
        typeof value === 'string' &&
        // 리터럴 튜플을 string 배열로 넓혀 임의 문자열을 `includes`로 비교한다(읽기만 한다)
        (EXTENDED_BAR_TIMEFRAMES as readonly string[]).includes(value)
    );
}

/** 타임프레임별 봉 길이(초). core 상수(`TIMEFRAME_MINUTES`)는 공개 export가 아니라 여기서 둔다. */
export const EXTENDED_BAR_INTERVAL_SECONDS: Record<
    ExtendedBarTimeframe,
    number
> = {
    '5Min': 5 * SECONDS_PER_MINUTE,
    '15Min': 15 * SECONDS_PER_MINUTE,
    '30Min': 30 * SECONDS_PER_MINUTE,
    '1Hour': SECONDS_PER_HOUR,
    '4Hour': 4 * SECONDS_PER_HOUR,
};

/** 프리마켓 시작 04:00 ET(초). 경계 분은 `usSessionClock`이 정한다. */
const PRE_MARKET_START_SECOND = PRE_MARKET_OPEN_MINUTE * SECONDS_PER_MINUTE;

export type ExtendedBarSession = 'pre' | 'after';

interface EtClock {
    /** ET 달력일 번호(1970-01-01 = 0). */
    day: number;
    /** ET 자정으로부터 경과한 초. */
    secondOfDay: number;
    session: UsSessionDay;
}

/**
 * 세션 경계는 ET 날짜마다 고정이라 날짜별로 한 번만 묻는다(봉 수백 개가 같은 날을 공유하고, 경계 질의는
 * core 달력 세 곳을 부른다). 달력은 불변이라 무효화가 필요 없고, 크기만 제한한다.
 */
const SESSION_DAY_CACHE_MAX = 512;
const sessionDayCache = new Map<number, UsSessionDay>();

function sessionDayFor(etDay: number, at: Date): UsSessionDay {
    const hit = sessionDayCache.get(etDay);
    if (hit !== undefined) return hit;
    if (sessionDayCache.size >= SESSION_DAY_CACHE_MAX) sessionDayCache.clear();
    const day = usSessionDayAt(at);
    sessionDayCache.set(etDay, day);
    return day;
}

function etClockOf(timeSec: number): EtClock {
    const ms = timeSec * MS_PER_SECOND;
    const { day, minuteOfDay } = etWallClock(ms);
    return {
        day,
        // 오프셋은 정시 단위라 초 단위 나머지는 UTC와 같다.
        secondOfDay:
            minuteOfDay * SECONDS_PER_MINUTE + (timeSec % SECONDS_PER_MINUTE),
        session: sessionDayFor(day, new Date(ms)),
    };
}

/** 그 ET 달력일 번호(1970-01-01 = 0). 두 봉이 같은 거래일인지 비교할 때 쓴다. */
export function etDayOfBar(timeSec: number): number {
    return etWallClock(timeSec * MS_PER_SECOND).day;
}

/**
 * 시작 시각 `timeSec`·길이 `intervalSec`인 봉이 **버킷 전체가 정규장 밖**이면 어느 확장 세션인지,
 * 정규장과 겹치거나 확장 세션 밖(마감 후 종료 시각 이후·04:00 이전)이면 `null`.
 */
export function classifyExtendedBar(
    timeSec: number,
    intervalSec: number
): ExtendedBarSession | null {
    const { secondOfDay, session } = etClockOf(timeSec);
    const openSecond = session.openMinute * SECONDS_PER_MINUTE;
    const closeSecond = session.closeMinute * SECONDS_PER_MINUTE;
    const afterEndSecond = session.afterHoursEndMinute * SECONDS_PER_MINUTE;
    if (
        secondOfDay >= PRE_MARKET_START_SECOND &&
        secondOfDay + intervalSec <= openSecond
    ) {
        return 'pre';
    }
    if (secondOfDay >= closeSecond && secondOfDay < afterEndSecond) {
        return 'after';
    }
    return null;
}

/** 정규장 밖 봉만 남긴다(서버가 Redis에 넣기 전·클라이언트가 합치기 전 모두 같은 규칙). */
export function filterOutOfSessionBars(
    bars: readonly Bar[],
    timeframe: ExtendedBarTimeframe
): Bar[] {
    const interval = EXTENDED_BAR_INTERVAL_SECONDS[timeframe];
    return bars.filter(bar => classifyExtendedBar(bar.time, interval) !== null);
}

/**
 * 확장 봉이 없을 때 모든 호출이 돌려주는 **같은 빈 배열**(동결). 호출마다 새 `[]`을 만들면 참조가 매번 달라져
 * `useMemo`·effect 의존성(`extendedBars`)이 렌더마다 깨진다 — 음영 primitive가 다시 붙고 시간축이 다시 맞춰진다.
 */
// 동결 배열을 `Bar[]`로 본다 — 소비자는 이 배열을 변경하지 않는다(읽기·참조 비교만).
export const NO_EXTENDED_BARS: Bar[] = Object.freeze([]) as unknown as Bar[];

export interface MergedExtendedBars {
    /** 차트에 그릴 봉 — 정규장 봉 전부(그대로) + 정규장 밖 확장 봉, 시각 오름차순·유일. */
    displayBars: Bar[];
    /** `displayBars` 중 확장 세션 봉만(시각 오름차순). 음영·흐린 캔들의 근거다. */
    extendedBars: Bar[];
}

/**
 * 정규장 봉을 **진실의 원천**으로 삼아 확장 봉을 얹는다.
 *
 * - 정규장 봉과 같은 시각의 확장 봉은 버린다(정규장 우선).
 * - 정규장과 겹치는 버킷(1h 09:00, 4h 08:00/12:00 등)은 버린다(`classifyExtendedBar`).
 * - 정규 봉이 가장 일찍 시작한 거래일보다 앞선 날의 확장 봉은 버린다 — 정규 창과 날짜가 어긋난
 *   (`from` 경계) 확장 봉이 홀로 떠 있지 않게 한다. 그날 프리마켓(첫 정규 봉보다 이른 시각)은 남는다.
 * - 정규 봉이 없으면 아무것도 얹지 않는다.
 *
 * 확장 봉이 하나도 남지 않으면 `displayBars`는 **`regular` 자신**이다(참조 동일 — 메모·effect가 불필요하게
 * 다시 돌지 않는다).
 */
export function mergeExtendedBars(
    regular: Bar[],
    extended: readonly Bar[] | null | undefined,
    timeframe: ExtendedBarTimeframe
): MergedExtendedBars {
    const first = regular[0];
    if (first === undefined || extended == null || extended.length === 0) {
        return { displayBars: regular, extendedBars: NO_EXTENDED_BARS };
    }
    const interval = EXTENDED_BAR_INTERVAL_SECONDS[timeframe];
    const regularTimes = new Set(regular.map(bar => bar.time));
    const firstDay = etDayOfBar(first.time);
    const seen = new Set<number>();
    const kept = extended
        .filter(bar => {
            if (regularTimes.has(bar.time) || seen.has(bar.time)) return false;
            if (classifyExtendedBar(bar.time, interval) === null) return false;
            if (etDayOfBar(bar.time) < firstDay) return false;
            seen.add(bar.time);
            return true;
        })
        .toSorted((a, b) => a.time - b.time);
    if (kept.length === 0) {
        return { displayBars: regular, extendedBars: NO_EXTENDED_BARS };
    }
    return {
        displayBars: [...regular, ...kept].toSorted((a, b) => a.time - b.time),
        extendedBars: kept,
    };
}

/** 구간이 없을 때 모든 호출이 쓰는 같은 빈 배열(동결) — `NO_EXTENDED_BARS`와 같은 이유로 참조를 고정한다. */
export const NO_SESSION_RANGES: readonly ExtendedSessionRange[] = Object.freeze(
    []
);

export interface ExtendedSessionRange {
    session: ExtendedBarSession;
    /** 구간의 첫 확장 봉 시각(epoch 초). */
    startTime: number;
    /** 구간의 마지막 확장 봉 시각(epoch 초). */
    endTime: number;
}

/**
 * 확장 봉을 (ET 거래일, 프리/애프터) 단위의 연속 구간으로 묶는다. 음영 밴드가 그릴 단위다.
 * 구간 경계는 세션 창(04:00~개장, 마감~20:00)에서 나오므로 반장일(13:00 마감)·서머타임 전환도
 * 봉 자체의 ET 시각으로 처리된다.
 */
export function buildExtendedSessionRanges(
    extendedBars: readonly Bar[],
    timeframe: ExtendedBarTimeframe
): ExtendedSessionRange[] {
    const interval = EXTENDED_BAR_INTERVAL_SECONDS[timeframe];
    // 구간은 많아야 거래일 수 × 2개(5분봉 10일 ≈ 14, 4시간봉 200일 ≈ 400)라 매 봉마다 구간 배열을 새로
    // 만들어도 비용이 작다 — 불변 reduce로 쓴다(CP-6).
    return extendedBars.reduce<{
        ranges: ExtendedSessionRange[];
        key: string | null;
    }>(
        (acc, bar) => {
            const session = classifyExtendedBar(bar.time, interval);
            if (session === null) return acc;
            const key = `${etDayOfBar(bar.time)}:${session}`;
            const last = acc.ranges.at(-1);
            if (key === acc.key && last !== undefined) {
                return {
                    key,
                    ranges: [
                        ...acc.ranges.slice(0, -1),
                        { ...last, endTime: bar.time },
                    ],
                };
            }
            return {
                key,
                ranges: [
                    ...acc.ranges,
                    { session, startTime: bar.time, endTime: bar.time },
                ],
            };
        },
        { ranges: [], key: null }
    ).ranges;
}

/**
 * 확장 봉 **tail**(오늘 봉)의 Redis TTL.
 *
 * 정규장 봉의 TTL(`computeBarsEffectiveTtl`)을 그대로 쓰면 안 된다 — 정규장 밖에서는 "다음 개장
 * (09:30)까지"가 나오는데, 확장 봉은 04:00~09:30과 마감~애프터 종료에도 계속 생긴다. 03:59에 만든
 * 항목이 09:30까지 살면 프리마켓 봉이 다섯 시간 넘게 안 보인다.
 *
 * - 거래일 04:00 ET ~ 그 날 애프터마켓 종료(정규 마감일 20:00, 반장일 17:00): `liveTtlSeconds`
 * - 그 밖(야간·주말·휴장일·반장일 17:00 이후): 다음 거래일 04:00 ET까지, 최대 24시간. 최소는 `liveTtlSeconds`.
 */
export function extendedTailTtlSeconds(
    now: Date,
    liveTtlSeconds: number
): number {
    const nowMs = now.getTime();
    const { day, minuteOfDay } = etWallClock(nowMs);
    const session = usSessionDayAt(now);
    if (
        session.tradingDay &&
        minuteOfDay >= PRE_MARKET_OPEN_MINUTE &&
        minuteOfDay < session.afterHoursEndMinute
    ) {
        return liveTtlSeconds;
    }
    for (let ahead = 0; ahead <= MAX_TRADING_DAY_SEARCH_DAYS; ahead += 1) {
        const candidate = day + ahead;
        const preMarketStartMs = etDayWallMs(candidate, PRE_MARKET_OPEN_MINUTE);
        if (preMarketStartMs > nowMs && isTradingEtDay(candidate)) {
            return Math.min(
                SECONDS_PER_DAY,
                Math.max(
                    liveTtlSeconds,
                    Math.floor((preMarketStartMs - nowMs) / MS_PER_SECOND)
                )
            );
        }
    }
    return SECONDS_PER_DAY;
}
