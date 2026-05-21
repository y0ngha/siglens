export type OptionsCacheLifeProfile =
    | 'options-market-open'
    | 'options-market-closed'
    | 'options-weekend';

const MARKET_OPEN_MIN = 9 * 60 + 30; // 09:30 ET
const MARKET_CLOSE_MIN = 16 * 60; // 16:00 ET

/**
 * Extract weekday/hour/minute as observed in America/New_York directly from
 * an `Intl.DateTimeFormat` parts list. Avoids the previous round-trip through
 * `toLocaleString` + `new Date(...)`, which depends on the host's locale
 * parser and breaks on non-`en-US` runtimes.
 */
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
 * Pick the cache life profile based on current ET time. Profiles are
 * registered in `next.config.ts`'s `cacheLife` map.
 *
 * - Saturday/Sunday → `options-weekend`
 * - Weekday 09:30~16:00 ET → `options-market-open`
 * - Weekday off-hours → `options-market-closed`
 */
export function getOptionsCacheLifeProfile(
    now: Date = new Date()
): OptionsCacheLifeProfile {
    const { weekdayIndex, hour, minute } = etParts(now);
    if (weekdayIndex === 0 || weekdayIndex === 6) return 'options-weekend';

    const totalMin = hour * 60 + minute;
    if (totalMin >= MARKET_OPEN_MIN && totalMin <= MARKET_CLOSE_MIN) {
        return 'options-market-open';
    }
    return 'options-market-closed';
}
