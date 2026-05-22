/**
 * Client-safe helpers for asking whether the U.S. equity options market is
 * in regular session *right now*.
 *
 * The existing `infrastructure/options/optionsCacheLife.ts` already encodes
 * the same boundary (ET 09:30 ~ 16:00 weekdays) but returns a Next.js
 * `cacheLife` profile name and lives in the infrastructure layer — components
 * can't import it (architecture rule). This module re-uses the same calendar
 * math via `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' })`,
 * which automatically handles EDT/EST transitions, so the boundary stays in
 * lockstep with the market regardless of DST.
 */

const MINUTES_PER_HOUR = 60;

// US equity options regular session (ET): 09:30 open · 16:00 close.
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16;

const MARKET_OPEN_MIN =
    MARKET_OPEN_HOUR * MINUTES_PER_HOUR + MARKET_OPEN_MINUTE;
const MARKET_CLOSE_MIN = MARKET_CLOSE_HOUR * MINUTES_PER_HOUR;

const ET_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

interface EtParts {
    weekdayIndex: number; // 0 = Sunday … 6 = Saturday
    hour: number;
    minute: number;
}

const WEEKDAY_LOOKUP: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};

function etParts(now: Date): EtParts {
    return ET_PARTS_FORMATTER.formatToParts(now).reduce<EtParts>(
        (acc, part) => {
            if (part.type === 'weekday') {
                return {
                    ...acc,
                    weekdayIndex: WEEKDAY_LOOKUP[part.value] ?? 0,
                };
            }
            if (part.type === 'hour') {
                // `hour12: false`는 보통 '00'–'23'이지만 일부 ICU 로케일이
                // 자정에 '24'를 내놓는 방어 케이스를 그대로 0으로 정규화.
                const parsed = Number.parseInt(part.value, 10);
                return { ...acc, hour: parsed === 24 ? 0 : parsed };
            }
            if (part.type === 'minute') {
                return { ...acc, minute: Number.parseInt(part.value, 10) };
            }
            return acc;
        },
        { weekdayIndex: 0, hour: 0, minute: 0 }
    );
}

/**
 * `true` when `now` is inside U.S. equity options regular session
 * (ET Mon–Fri 09:30–16:00). DST-safe — the Intl formatter resolves EDT/EST
 * automatically based on the calendar position of `now`.
 *
 * Pure function — accepts an optional `now` so tests can freeze the clock.
 */
export function isUsOptionsRegularSession(now: Date = new Date()): boolean {
    const { weekdayIndex, hour, minute } = etParts(now);
    if (weekdayIndex === 0 || weekdayIndex === 6) return false;
    const totalMin = hour * MINUTES_PER_HOUR + minute;
    return totalMin >= MARKET_OPEN_MIN && totalMin <= MARKET_CLOSE_MIN;
}
