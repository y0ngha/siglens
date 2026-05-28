import { getEtSessionStatus } from '@y0ngha/siglens-core';

export type OptionsCacheLifeProfile =
    | 'options-market-open'
    | 'options-market-closed'
    | 'options-weekend';

/**
 * Pick the cache life profile based on current ET time. Profiles are
 * registered in `next.config.ts`'s `cacheLife` map.
 *
 * - Saturday/Sunday → `options-weekend`
 * - Weekday 09:30–16:00 ET (16:00 close exclusive) → `options-market-open`
 * - Weekday off-hours (incl. 16:00 sharp) → `options-market-closed`
 */
export function getOptionsCacheLifeProfile(
    now: Date = new Date()
): OptionsCacheLifeProfile {
    const status = getEtSessionStatus(now);
    if (status === 'weekend') return 'options-weekend';
    return status === 'open' ? 'options-market-open' : 'options-market-closed';
}
