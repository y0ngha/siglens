import { RETENTION_WINDOWS } from '@/entities/funnel/retentionWindows';
import { MS_PER_DAY } from '@/shared/config/time';
import {
    FIRST_VISIT_BUCKETS,
    LAST_VISIT_BUCKETS,
    RETURN_WINDOWS,
    VISIT_DAYS_BUCKETS,
    type FirstVisitBucket,
    type LastVisitBucket,
    type ReturnWindow,
    type VisitDaysBucket,
    type VisitSignals,
} from '../types';

/**
 * 비회원 브라우저의 재방문 이력(순수 계산부). 저장소·시계는 여기 없다 — 읽고 쓰는 쪽은
 * `features/visitor-ping/lib/visitHistoryStorage.ts`이고 `today`(KST `YYYY-MM-DD`)는 인자로 받는다.
 *
 * **왜 이 페이로드는 지속 식별자가 아닌가.** 서버로 가는 값은 닫힌 네 필드(`VisitSignals`)뿐이다.
 * 도달 가능한 모든 이력을 나열하면 서로 다른 페이로드는 97가지(`window` 없이 74가지)와 "없음"이고,
 * 같은 거친 이력을 가진 브라우저는 모두 같은 값을 보낸다. 브라우저에 대해 변하지 않는 유일한 사실은
 * 첫 방문 날짜인데, 그 날짜는 보내지 않으며 행에서는 범위로만 좁혀진다(`new`는 같은 날, `d1`은 전날,
 * 그 밖은 6~60일 폭, 90일 이후는 열린 범위). 값은 다음 방문에 바뀌므로 내일의 같은 브라우저를
 * 알아보는 데 쓸 수 없고, 무작위 값도 저장하지 않는다. 한계: 일간 방문자가 30~60명 규모라 어느 하루에는
 * 값이 유일할 수 있다. 그 행에는 이미 가명 해시와 User-Agent 원문이 있고 가명 정보로 고지돼 있으며,
 * 구간값이 더하는 정보는 최대 log2(97) ≈ 6.6비트다.
 *
 * **이 논증의 한계.** "식별자가 아니다"는 페이로드 하나가 브라우저를 가리키지 못한다는 뜻이지 행을
 * 이을 수 없다는 뜻이 아니다. (1) 하루에 도달 가능한 페이로드는 97가지뿐이라 같은 값을 보낸 브라우저가
 * 많지만, 일간 방문자가 적은 날에는 값이 유일할 수 있다. (2) IP가 바뀌지 않는 동안에는 기존 가명 해시
 * (`visitor_days.visitor_hash`)가 날짜를 가로질러 같은 브라우저의 행을 이미 잇는다. 그 위에서 구간값이
 * 하루마다 어떻게 변하는지(`d1_6` → `d7_13` …)를 따라가 행을 잇는 분석은 하지 않는다 — 리포트는 구간값을
 * 날짜별 합계로만 읽고, 행을 구간값의 변화로 연결하지 않는다.
 *
 * 측정 한계(버그가 아니다): 사파리 ITP는 사파리를 쓰되 방문하지 않은 7일 뒤 스크립트가 쓴 저장소를
 * 지우므로 그 브라우저는 다시 `new`로 보이고 D30은 하한이다. 시크릿 창은 늘 `new`, 사이트 데이터를
 * 지우면 이력이 초기화되고, 이력은 호스트(`siglens.io`·`ai.siglens.io`)별이다.
 *
 * 개인정보처리방침 v15 §2·§7이 이 구간값과 저장 키를 고지한다.
 */

export interface VisitHistory {
    /** 이 브라우저의 첫 방문일(KST `YYYY-MM-DD`). */
    readonly first: string;
    /** `last` 직전 방문일. 첫 방문이면 `null`. 같은 날 두 번째 비콘이 같은 구간값을 다시 계산하게 한다. */
    readonly prev: string | null;
    /** 마지막 방문일. */
    readonly last: string;
    /** 방문한 날 수. */
    readonly days: number;
}

/**
 * 비회원 재방문 창 — 첫 방문 뒤 `[startDay, endDay]`일. `d7`·`d30`은 회원 재방문 창과 같은 값이며
 * 개인정보처리방침 v15 §2가 이 숫자를 그대로 적는다(가드 `visitHistoryPrivacy`).
 */
export const GUEST_RETURN_WINDOWS = {
    d1: { startDay: 1, endDay: 1 },
    d7: RETENTION_WINDOWS.d7,
    d30: RETENTION_WINDOWS.d30,
} as const;

/** 방문한 날 수의 상한. 저장값이 부풀어도 구간값에는 영향이 없고 저장소 값만 막는다. */
export const VISIT_DAYS_CAP = 9999;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(value: unknown): value is string {
    if (typeof value !== 'string' || !DATE_KEY.test(value)) return false;
    return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

/** 날짜 키 `later`가 `earlier`보다 며칠 뒤인가. UTC 달력 산술이라 DST와 무관하다. */
function daysBetween(earlier: string, later: string): number {
    return Math.round(
        (Date.parse(`${later}T00:00:00Z`) -
            Date.parse(`${earlier}T00:00:00Z`)) /
            MS_PER_DAY
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
    record: Record<string, unknown>,
    keys: readonly string[]
): boolean {
    const actual = Object.keys(record);
    return actual.length === keys.length && keys.every(key => key in record);
}

/**
 * 저장된 문자열을 이력으로 읽는다. 모양·날짜 순서·횟수가 하나라도 맞지 않으면 `null`이라, 깨지거나
 * 손댄 값은 새 브라우저처럼 다룬다. 첫 방문(`prev === null`)이면 `first === last`다.
 */
export function parseVisitHistory(raw: string | null): VisitHistory | null {
    if (raw === null) return null;
    const parsed = parseJson(raw);
    if (
        !isRecord(parsed) ||
        !hasExactKeys(parsed, ['first', 'prev', 'last', 'days'])
    ) {
        return null;
    }
    const { first, prev, last, days } = parsed;
    if (!isDateKey(first) || !isDateKey(last) || first > last) return null;
    if (
        typeof days !== 'number' ||
        !Number.isInteger(days) ||
        days < 1 ||
        days > VISIT_DAYS_CAP
    ) {
        return null;
    }
    if (prev === null) {
        return days === 1 && first === last
            ? { first, prev: null, last, days }
            : null;
    }
    if (!isDateKey(prev) || prev < first || prev >= last || days < 2) {
        return null;
    }
    return { first, prev, last, days };
}

function parseJson(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * 오늘 방문을 이력에 반영한다. 날 수가 늘어나는 유일한 곳이라 KST 하루에 한 번만 늘어난다.
 * 같은 날 다시 부르거나 기기 시계가 과거로 갔으면(`last >= today`) 받은 객체를 그대로 돌려준다.
 */
export function advanceVisitHistory(
    stored: VisitHistory | null,
    today: string
): VisitHistory {
    if (stored === null) {
        return { first: today, prev: null, last: today, days: 1 };
    }
    if (stored.last >= today) return stored;
    return {
        first: stored.first,
        prev: stored.last,
        last: today,
        days: Math.min(stored.days + 1, VISIT_DAYS_CAP),
    };
}

/**
 * 오늘이 첫 방문일보다 뒤인가 — 앱 설치 안내를 띄워도 되는 "재방문일"인지 판정한다.
 *
 * `first < today`는 오늘 방문이 이력에 반영됐는지와 무관하다. 둘째 날 첫 입력 뒤 `advanceVisitHistory`가
 * `last`만 올리고 `first`는 그대로이므로 같은 값이 나온다. 이력이 없거나(첫 방문 전) 첫 방문 당일이거나
 * 기기 시계가 첫 방문일보다 과거로 갔으면 `false`다.
 */
export function isReturnVisitDay(
    history: VisitHistory | null,
    today: string
): boolean {
    return history !== null && history.first < today;
}

function firstBucket(k: number): FirstVisitBucket {
    if (k < 1) return 'new';
    if (k < 7) return 'd1_6';
    if (k < 14) return 'd7_13';
    if (k < 30) return 'd14_29';
    if (k < 90) return 'd30_89';
    return 'd90_plus';
}

function lastBucket(l: number | null): LastVisitBucket {
    if (l === null) return 'none';
    if (l < 2) return 'd1';
    if (l < 7) return 'd2_6';
    if (l < 14) return 'd7_13';
    if (l < 30) return 'd14_29';
    return 'd30_plus';
}

function daysBucket(days: number): VisitDaysBucket {
    if (days < 2) return 'n1';
    if (days < 3) return 'n2';
    if (days < 5) return 'n3_4';
    if (days < 10) return 'n5_9';
    if (days < 20) return 'n10_19';
    return 'n20_plus';
}

function inWindow(k: number, window: { startDay: number; endDay: number }) {
    return k >= window.startDay && k <= window.endDay;
}

/**
 * 첫 방문 뒤 `k`일 시점의 방문이 창 안의 **첫** 방문인가. `p`는 직전 방문이 첫 방문 뒤 며칠째였는가라
 * `p`가 창 시작 전이면 이번이 그 창의 첫 방문이다 — 한 브라우저가 창마다 최대 한 번만 센다.
 */
function returnWindowOf(k: number, p: number | null): ReturnWindow | null {
    const { d1, d7, d30 } = GUEST_RETURN_WINDOWS;
    if (k === d1.startDay && k === d1.endDay) return 'd1';
    if (p === null) return null;
    if (inWindow(k, d7) && p < d7.startDay) return 'd7';
    if (inWindow(k, d30) && p < d30.startDay) return 'd30';
    return null;
}

/**
 * 이력을 서버로 보낼 구간값으로 바꾼다. 정확한 날짜·횟수는 여기서 버려진다.
 *
 * 기기 시계가 과거로 가 `today < history.last`이면 `null`이다(구간값 없이 보낸다). 시계가 미래였다가
 * 돌아오면 `last`가 미래에 남아, 그 뒤 실제 날짜마다 같은 기준일로 다시 계산되어 `window` 적중이
 * 되풀이되고 D7·D30이 부풀기 때문이다. 이력은 다시 쓰지 않는다(`advanceVisitHistory`가 그대로 돌려준다).
 */
export function visitSignalsOf(
    history: VisitHistory,
    today: string
): VisitSignals | null {
    if (today < history.last) return null;
    const k = daysBetween(history.first, today);
    const l =
        history.prev === null
            ? null
            : Math.max(1, daysBetween(history.prev, today));
    const p =
        history.prev === null ? null : daysBetween(history.first, history.prev);
    return {
        first: firstBucket(k),
        last: lastBucket(l),
        days: daysBucket(history.days),
        window: returnWindowOf(k, p),
    };
}

function isOneOf<T extends string>(
    values: readonly T[],
    value: unknown
): value is T {
    return (
        typeof value === 'string' &&
        (values as readonly string[]).includes(value)
    );
}

/**
 * 비콘 본문의 `visit`을 검증한다(서버). 정확히 `first·last·days·window` 네 키, 값은 각 닫힌 목록
 * 안, 값끼리 모순이 없어야 하고 아니면 `null`이다(방문은 구간값 없이 기록된다). 숫자는 받지 않으므로
 * 자를 값이 없다.
 */
export function parseVisitSignals(value: unknown): VisitSignals | null {
    if (!isRecord(value)) return null;
    if (!hasExactKeys(value, ['first', 'last', 'days', 'window'])) return null;
    const { first, last, days, window } = value;
    if (
        !isOneOf(FIRST_VISIT_BUCKETS, first) ||
        !isOneOf(LAST_VISIT_BUCKETS, last) ||
        !isOneOf(VISIT_DAYS_BUCKETS, days)
    ) {
        return null;
    }
    if (window !== null && !isOneOf(RETURN_WINDOWS, window)) return null;
    const signals: VisitSignals = { first, last, days, window };
    return isConsistent(signals) ? signals : null;
}

function isConsistent({ first, last, days, window }: VisitSignals): boolean {
    const isNew = first === 'new';
    if (isNew !== (last === 'none') || isNew !== (days === 'n1')) return false;
    if (isNew) return window === null;
    switch (window) {
        case null:
            return true;
        case 'd1':
            return first === 'd1_6' && last === 'd1' && days === 'n2';
        case 'd7':
            return first === 'd7_13';
        case 'd30':
            return first === 'd30_89';
    }
}
