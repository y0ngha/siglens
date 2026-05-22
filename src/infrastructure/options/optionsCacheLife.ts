import { etParts, isUsOptionsRegularSession } from '@/domain/market/session';

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
    const { weekdayIndex } = etParts(now);
    if (weekdayIndex === 0 || weekdayIndex === 6) return 'options-weekend';
    return isUsOptionsRegularSession(now)
        ? 'options-market-open'
        : 'options-market-closed';
}
