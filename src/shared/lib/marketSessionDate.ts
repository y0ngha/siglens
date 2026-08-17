import type { MarketSessionSpec } from '@y0ngha/siglens-core';
import {
    MINUTES_PER_HOUR,
    MS_PER_DAY,
    MS_PER_MINUTE,
} from '@/shared/config/time';

/**
 * 마감 후 EOD 발행까지의 안전 버퍼(시간). 이 시간 전에는 당일을 lastClosed로 롤하지
 * 않아, 발행 전 불완전 EOD가 당일 키에 캐시되는 것을 막는다. 버퍼 구간에도 당일 봉은
 * quote(최종 OHLCV)로 온전히 표시된다.
 */
export const EOD_PUBLISH_BUFFER_HOURS = 4;

const EOD_PUBLISH_BUFFER_MINUTES = EOD_PUBLISH_BUFFER_HOURS * MINUTES_PER_HOUR;

/**
 * 되감기 상한(일). 연속 휴장 최장 구간(크리스마스·신정 주간)이 4일을 넘지 않고,
 * 임시공휴일이 붙어도 10일이면 충분하다. 상한이 없으면 `closeMinuteFor`가 항상 0을
 * 반환하는 잘못된 스펙에서 무한 루프가 된다.
 */
const MAX_REWIND_DAYS = 10;

/** IANA 존별 formatter 캐시 — 요청마다 새로 만들면 Intl 생성 비용이 그대로 든다. */
const formatterByZone = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
    let fmt = formatterByZone.get(timeZone);
    if (fmt === undefined) {
        // en-CA는 year/month/day를 YYYY-MM-DD 순으로 내지만, 여기서는 formatToParts로
        // 타입별로 꺼내 쓰므로 로케일 표기 순서에 의존하지 않는다.
        fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
        formatterByZone.set(timeZone, fmt);
    }
    return fmt;
}

const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

interface ZonedParts {
    /** 현지 달력 날짜 `YYYY-MM-DD`. */
    date: string;
    /** 0=Sun … 6=Sat (현지 기준). */
    weekday: number;
    /** 현지 자정으로부터 경과 분. */
    minutesOfDay: number;
}

/**
 * 임의의 순간을 IANA 존의 현지 달력 성분으로 분해한다.
 *
 * core의 `localSessionParts`는 요일·분만 돌려주고 달력 날짜를 주지 않아 세션 **날짜**
 * 키를 만들 수 없다. 수동 오프셋 산술 대신 `Intl`에 맡기므로 DST 전환은 플랫폼 문제다.
 */
function zonedParts(now: Date, timeZone: string): ZonedParts {
    const parts = formatterFor(timeZone).formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes): string =>
        parts.find(p => p.type === type)?.value ?? '';
    const hour = Number(get('hour'));
    const minute = Number(get('minute'));
    return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
        minutesOfDay: hour * MINUTES_PER_HOUR + minute,
    };
}

/** `at` 시점의 존 오프셋(ms) — 현지 벽시계 − UTC 벽시계. */
function zoneOffsetMs(at: Date, timeZone: string): number {
    const { date, minutesOfDay } = zonedParts(at, timeZone);
    const localMs =
        Date.parse(`${date}T00:00:00Z`) + minutesOfDay * MS_PER_MINUTE;
    // zonedParts는 분 해상도라 UTC 쪽도 분으로 절사해 비교해야 초 단위 오차가 안 남는다.
    const utcMs = Math.floor(at.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE;
    return localMs - utcMs;
}

/**
 * 현지 달력 날짜 + 현지 분(minutes-of-day)을 UTC 순간으로 환산한다.
 *
 * 오프셋을 두 번 재는 이유: 첫 추정은 "현지 벽시계를 UTC로 읽은 값"이라 DST 전환일에는
 * 전환 전/후 중 어느 쪽 오프셋인지 알 수 없다. 1차 보정으로 얻은 순간에서 오프셋을 다시
 * 재면 전환의 올바른 쪽에 들어간다.
 */
function zonedWallClockToUtc(
    isoDate: string,
    minutesOfDay: number,
    timeZone: string
): Date {
    const wallMs =
        Date.parse(`${isoDate}T00:00:00Z`) + minutesOfDay * MS_PER_MINUTE;
    const firstPass = wallMs - zoneOffsetMs(new Date(wallMs), timeZone);
    return new Date(wallMs - zoneOffsetMs(new Date(firstPass), timeZone));
}

/** `YYYY-MM-DD`의 하루 전 날짜. */
function previousIsoDate(isoDate: string): string {
    return new Date(Date.parse(`${isoDate}T00:00:00Z`) - MS_PER_DAY)
        .toISOString()
        .slice(0, 10);
}

/** `YYYY-MM-DD`의 요일(0=Sun). ISO 날짜를 UTC 자정으로 읽으므로 존 무관하게 정확. */
function isoWeekday(isoDate: string): number {
    return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

type ScheduledSpec = Extract<MarketSessionSpec, { kind: 'scheduled' }>;

/**
 * 현지 달력 날짜 `isoDate`의 실제 마감 분. 거래소 캘린더가 있으면 그날의 마감이 스펙
 * 기본값을 이긴다(`0`=휴장).
 *
 * `closeMinuteFor`는 **순간**을 받으므로 그 날짜의 현지 정오를 넘긴다 — DST 전환은
 * 현지 02:00에 일어나므로 정오는 어느 전환일에도 안전하게 전환 이후 구간이다.
 */
function closeMinuteOn(spec: ScheduledSpec, isoDate: string): number {
    if (spec.closeMinuteFor === undefined) return spec.closeMinute;
    const localNoon = zonedWallClockToUtc(
        isoDate,
        12 * MINUTES_PER_HOUR,
        spec.timeZone
    );
    return spec.closeMinuteFor(localNoon);
}

/** 그 날짜에 거래가 있었는지 — 주말도 휴장도 아닌 날. */
function isTradingDate(spec: ScheduledSpec, isoDate: string): boolean {
    if (spec.weekendDays.includes(isoWeekday(isoDate))) return false;
    return closeMinuteOn(spec, isoDate) > 0;
}

/**
 * 마지막으로 **마감된** 정규 세션의 현지 날짜(YYYY-MM-DD)를 반환한다.
 *
 * 시장별로 다른 세 가지를 스펙 하나로 처리한다:
 * - 표준시/서머타임 — `spec.timeZone`을 `Intl`에 넘기므로 수동 오프셋 산술이 없다.
 * - 주말 — `spec.weekendDays`.
 * - 휴장일·반장 — `spec.closeMinuteFor`(NYSE는 core의 규칙 캘린더, KRX는 미보유).
 *
 * `bufferMinutes`는 마감 후 데이터 발행까지의 대기다. 마감 + 버퍼가 지나야 당일을
 * lastClosed로 롤한다. 버퍼 구간에는 직전 거래일이 유지되어, 불완전한 EOD가 당일 키에
 * 캐시되는 갭을 막는다.
 *
 * **`spec`을 반드시 시장에 맞게 넘길 것.** 이 함수의 전신(`lastClosedSessionDateEt`)은
 * ET 고정이라 한국 종목도 미국 달력으로 되감았다. NYSE 휴장일 인식이 들어온 지금 그
 * 혼용은 조용한 데이터 손실이다 — 추수감사절에 KRX는 정상 개장하는데 키가 전날로
 * 되감기면 `before=lastClosed`가 그날 봉을 히스토리에서 잘라낸다.
 *
 * `server-only` 없는 순수 함수로 분리해 둔 이유: bars EOD 캐시 키
 * (`CachedMarketDataProvider`), 시장 공포·탐욕 fetch 경계(`fetchDailyCloses`),
 * sitemap lastmod(`buildPopularEntries`, `buildStaticEntries`), SEO 스냅샷 신선도
 * (`seo-snapshot/lib/freshness`)가 **같은 "마지막 마감 세션" 정의를 공유해야** 하기
 * 때문이다. 여러 곳이 각자 주말·DST·휴장일 되감기를 다시 구현하면 조용히 어긋난다.
 */
export function lastClosedSessionDate(
    spec: MarketSessionSpec,
    now: Date,
    bufferMinutes: number = EOD_PUBLISH_BUFFER_MINUTES
): string {
    // 24/7 시장엔 "마감"이 없다 — 마지막으로 완결된 일봉은 어제(UTC)다.
    if (spec.kind === 'always-open') {
        return new Date(now.getTime() - MS_PER_DAY).toISOString().slice(0, 10);
    }

    const { date, weekday, minutesOfDay } = zonedParts(now, spec.timeZone);
    const todayClose = closeMinuteOn(spec, date);
    const closedToday =
        !spec.weekendDays.includes(weekday) &&
        todayClose > 0 &&
        minutesOfDay >= todayClose + bufferMinutes;

    let cursor = closedToday ? date : previousIsoDate(date);
    for (let i = 0; i < MAX_REWIND_DAYS; i++) {
        if (isTradingDate(spec, cursor)) return cursor;
        cursor = previousIsoDate(cursor);
    }
    // 스펙이 모든 날을 휴장으로 판정하는 경우에만 도달한다. 되감기를 무한히 돌리느니
    // 상한 지점의 날짜를 돌려주고 상위 캐시 계층이 "불완전"으로 처리하게 둔다.
    return cursor;
}

/**
 * 마지막으로 마감된 정규 세션의 **마감 순간**(UTC Date)을 반환한다.
 *
 * `lastClosedSessionDate`가 고른 세션 날짜에 그 날짜의 실제 마감 분을 적용하므로
 * DST(여름 20:00 UTC / 겨울 21:00 UTC)도 반장(13:00 ET)도 정확히 나온다.
 *
 * sitemap `lastmod`용 — "이 페이지 내용이 마지막으로 바뀐 시점"이 곧 직전 마감이다.
 * 요청 시각(now)을 그대로 쓰면 크롤러가 가져갈 때마다 값이 달라져, 실제로는 바뀌지
 * 않은 페이지에 매번 freshness 신호를 보내게 된다.
 *
 * `always-open` 스펙은 마감 순간이 정의되지 않으므로 어제 UTC 자정을 돌려준다
 * (크립토 sitemap은 `buildCryptoPopularEntries`가 별도 양자화로 처리한다).
 */
export function lastClosedSessionCloseUtc(
    spec: MarketSessionSpec,
    now: Date,
    bufferMinutes: number = EOD_PUBLISH_BUFFER_MINUTES
): Date {
    const date = lastClosedSessionDate(spec, now, bufferMinutes);
    if (spec.kind === 'always-open') return new Date(`${date}T00:00:00Z`);
    return zonedWallClockToUtc(date, closeMinuteOn(spec, date), spec.timeZone);
}
