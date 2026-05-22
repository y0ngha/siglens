/**
 * U.S. equity options regular-session calendar math, shared between
 * client components (`OptionsPageClient`) and the infrastructure-layer
 * cache profile (`infrastructure/options/optionsCacheLife`).
 *
 * Originally lived in `lib/marketSession` (client-safe helpers only), but the
 * same constants + ET-parts extraction were duplicated in `optionsCacheLife`.
 * Promoted to `domain/market` so both call sites import a single source of
 * truth — `lib/` is reserved for thin UI utility wrappers, and this module
 * encodes a business rule (regular-session boundary) so it belongs in domain.
 *
 * The boundary is ET 09:30 ~ 16:00 weekdays. We resolve EDT/EST via
 * `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' })` so the
 * answer stays in lockstep with the market regardless of DST.
 */

export const MINUTES_PER_HOUR = 60;

// US equity options regular session (ET): 09:30 open · 16:00 close.
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16;

export const MARKET_OPEN_MIN =
    MARKET_OPEN_HOUR * MINUTES_PER_HOUR + MARKET_OPEN_MINUTE;
export const MARKET_CLOSE_MIN = MARKET_CLOSE_HOUR * MINUTES_PER_HOUR;

// Reads ET weekday/hour/minute from formatToParts directly. The previous
// implementation round-tripped through `toLocaleString` + `new Date(...)`,
// which depends on the host's locale parser and breaks on non-`en-US`
// runtimes — `formatToParts` avoids that fragility.
const ET_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

export interface EtParts {
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

export function etParts(now: Date): EtParts {
    // `formatToParts` returns ~5-8 items, so reduce+spread cost is negligible.
    // Declarative form preferred over let+for mutation. 'hour12: false' usually
    // emits '00'–'23', but some runtimes (e.g. locales with hourCycle 'h23' such
    // as de-DE on certain ICU versions) emit '24' at midnight as a defensive
    // edge case. We can't trigger this from a unit test without stubbing the
    // ICU formatter itself (V8's en-US always returns '00'–'23'), so the
    // `parsed === 24 ? 0` branch is intentionally untested — keeping it as a
    // belt-and-suspenders guard against host-locale drift.
    return ET_PARTS_FORMATTER.formatToParts(now).reduce<EtParts>(
        (acc, part) => {
            if (part.type === 'weekday') {
                return {
                    ...acc,
                    weekdayIndex: WEEKDAY_LOOKUP[part.value] ?? 0,
                };
            }
            if (part.type === 'hour') {
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
