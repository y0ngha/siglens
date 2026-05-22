import { MINUTES_PER_HOUR } from '@/domain/constants/time';
import {
    etParts,
    MARKET_CLOSE_MIN,
    MARKET_OPEN_MIN,
} from '@/domain/market/session';

export type OptionsCacheLifeProfile =
    | 'options-market-open'
    | 'options-market-closed'
    | 'options-weekend';

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

    const totalMin = hour * MINUTES_PER_HOUR + minute;
    if (totalMin >= MARKET_OPEN_MIN && totalMin <= MARKET_CLOSE_MIN) {
        return 'options-market-open';
    }
    return 'options-market-closed';
}
