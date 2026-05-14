export type OptionsCacheLifeProfile =
    | 'options-market-open'
    | 'options-market-closed'
    | 'options-weekend';

const MARKET_OPEN_MIN = 9 * 60 + 30; // 09:30 ET
const MARKET_CLOSE_MIN = 16 * 60; // 16:00 ET

/**
 * Pick the cache life profile based on current ET time. Profiles are
 * registered in `next.config.ts`'s `cacheLife` map.
 *
 * - Saturday/Sunday → `options-weekend`
 * - Weekday 09:30~16:00 ET → `options-market-open`
 * - Weekday off-hours → `options-market-closed`
 *
 * DST is handled by `toLocaleString('en-US', { timeZone: 'America/New_York' })`,
 * which IANA-resolves the correct offset for the given calendar date.
 */
export function getOptionsCacheLifeProfile(
    now: Date = new Date()
): OptionsCacheLifeProfile {
    const etString = now.toLocaleString('en-US', {
        timeZone: 'America/New_York',
    });
    const et = new Date(etString);
    const day = et.getDay();
    if (day === 0 || day === 6) return 'options-weekend';

    const totalMin = et.getHours() * 60 + et.getMinutes();
    if (totalMin >= MARKET_OPEN_MIN && totalMin <= MARKET_CLOSE_MIN) {
        return 'options-market-open';
    }
    return 'options-market-closed';
}
