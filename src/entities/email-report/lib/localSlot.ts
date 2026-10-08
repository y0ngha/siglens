import type { Weekday } from '../model';

/** 어떤 순간을 회원 타임존으로 본 로컬 날짜·요일·시. */
export interface LocalSlot {
    /** `YYYY-MM-DD` */
    localDate: string;
    weekday: Weekday;
    hour: number;
}

const WEEKDAY_INDEX: Record<string, Weekday> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

/**
 * `now`를 `timezone`의 로컬 시각으로 환산한다. 타임존이 깨져 있으면 `null`.
 *
 * 저장 시점에 검증하지만, 런타임 ICU가 바뀌어 예전에 받은 이름을 모르게 되는 경우가 있어
 * 발송 루프 전체를 멈추지 않도록 던지지 않는다.
 */
export function toLocalSlot(now: Date, timezone: string): LocalSlot | null {
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
            hour: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(now);
    } catch {
        return null;
    }
    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find(part => part.type === type)?.value ?? '';
    const weekday = WEEKDAY_INDEX[get('weekday')];
    const hour = Number(get('hour'));
    if (weekday === undefined || !Number.isInteger(hour)) return null;
    return {
        localDate: `${get('year')}-${get('month')}-${get('day')}`,
        weekday,
        hour,
    };
}

/**
 * 이 시각 슬롯에 보낼 차례인지. 요일 비트마스크와 로컬 시가 모두 맞아야 한다.
 *
 * cron은 매시 돈다 — 시각이 정확히 같은 슬롯만 맞춘다. 한 슬롯을 놓치면(배포·장애)
 * 그날은 건너뛴다: 늦게 몰아 보내면 회원이 고른 시각의 의미가 사라진다.
 */
export function isDueAt(
    slot: LocalSlot,
    daysOfWeekMask: number,
    sendHour: number
): boolean {
    return (
        (daysOfWeekMask & (1 << slot.weekday)) !== 0 && slot.hour === sendHour
    );
}
