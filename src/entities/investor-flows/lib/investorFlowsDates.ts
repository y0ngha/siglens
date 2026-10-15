import { MS_PER_DAY, ISO_DATE_LENGTH } from '@/shared/config/time';
import {
    INVESTOR_FLOWS_13F_COMPLETE_GRACE_DAYS,
    INVESTOR_FLOWS_13F_FILING_DEADLINE_DAYS,
} from './investorFlowsPolicy';

/** ISO 날짜(`yyyy-mm-dd`) 문자열 오름차순 비교자 — 사전순이 곧 시간순이다. 내림차순은 인자를 바꿔 쓴다. */
export function compareIsoDate(a: string, b: string): number {
    if (a < b) return -1;
    return a > b ? 1 : 0;
}

/** `YYYY-MM-DD`(UTC 달력 날짜)에 `days`일을 더한다. 음수도 된다. */
export function addDays(isoDate: string, days: number): string {
    const ms = Date.parse(`${isoDate}T00:00:00Z`) + days * MS_PER_DAY;
    return new Date(ms).toISOString().slice(0, ISO_DATE_LENGTH);
}

/** `from`..`to`(양끝 포함)의 모든 날짜를 오름차순으로. `from > to`면 빈 배열. */
export function eachDate(from: string, to: string): string[] {
    const dates: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
    return dates;
}

/** 토·일 여부. EDGAR는 주말에 제출을 받지 않는다. */
export function isWeekend(isoDate: string): boolean {
    const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
    return day === 0 || day === 6;
}

const QUARTER_ENDS = ['03-31', '06-30', '09-30', '12-31'] as const;

/** 분기말(03-31·06-30·09-30·12-31)인지. 13F `periodOfReport`는 항상 분기말이어야 한다. */
export function isQuarterEnd(isoDate: string): boolean {
    return QUARTER_ENDS.some(end => isoDate.endsWith(`-${end}`));
}

/** 직전 분기말. */
export function previousQuarterEnd(period: string): string {
    const year = Number(period.slice(0, 4));
    const monthDay = period.slice(5);
    const index = QUARTER_ENDS.indexOf(
        monthDay as (typeof QUARTER_ENDS)[number]
    );
    if (index === -1) throw new Error(`not a quarter end: ${period}`);
    return index === 0
        ? `${year - 1}-12-31`
        : `${year}-${QUARTER_ENDS[index - 1]}`;
}

/** 다음 분기말. */
export function nextQuarterEnd(period: string): string {
    const year = Number(period.slice(0, 4));
    const monthDay = period.slice(5);
    const index = QUARTER_ENDS.indexOf(
        monthDay as (typeof QUARTER_ENDS)[number]
    );
    if (index === -1) throw new Error(`not a quarter end: ${period}`);
    return index === QUARTER_ENDS.length - 1
        ? `${year + 1}-03-31`
        : `${year}-${QUARTER_ENDS[index + 1]}`;
}

/** `date`(포함) 이전에 끝난 가장 최근 분기말. */
export function latestQuarterEndOnOrBefore(date: string): string {
    const year = Number(date.slice(0, 4));
    const candidates = [
        `${year - 1}-12-31`,
        ...QUARTER_ENDS.map(end => `${year}-${end}`),
    ];
    const past = candidates.filter(candidate => candidate <= date);
    return past[past.length - 1] as string;
}

/**
 * 분기가 "완결"인지 — 제출 마감(분기말 + 45일)에 주말·휴일 이월 여유를 더한 날이 `today`(UTC)보다
 * 앞이면 완결이다. 완결이 아니면 일부 기관이 아직 안 낸 "부분 집계"다.
 */
export function isPeriodComplete(period: string, today: string): boolean {
    return (
        addDays(
            period,
            INVESTOR_FLOWS_13F_FILING_DEADLINE_DAYS +
                INVESTOR_FLOWS_13F_COMPLETE_GRACE_DAYS
        ) < today
    );
}

/** 가장 최근 완결 분기말. 아직 완결된 분기가 없는 날짜는 없다(항상 직전 분기 이전은 완결). */
export function latestCompletePeriod(today: string): string {
    let period = latestQuarterEndOnOrBefore(today);
    while (!isPeriodComplete(period, today))
        period = previousQuarterEnd(period);
    return period;
}

/**
 * 포지션 보존 하한 — "최근 **2개** 완결 분기 + 진행 분기"의 가장 오래된 분기말. 이보다 이른 분기의 포지션은
 * 집계만 남기고 지운다. 가장 최근 완결 분기는 직전 분기(=하한)를 비교 기준으로 쓴다.
 */
export function positionsRetentionFloor(today: string): string {
    return previousQuarterEnd(latestCompletePeriod(today));
}
