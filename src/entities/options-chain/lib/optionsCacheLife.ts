import { getEtSessionStatus, isUsTradingDay } from '@y0ngha/siglens-core';

export type OptionsCacheLifeProfile =
    | 'options-market-open'
    | 'options-market-closed'
    | 'options-weekend';

/**
 * Pick the cache life profile based on current ET time. Profiles are
 * registered in `next.config.ts`'s `cacheLife` map.
 *
 * - Saturday/Sunday **and NYSE holidays** → `options-weekend`
 * - Trading day 09:30–16:00 ET (13:00 on a half day, close exclusive) → `options-market-open`
 * - Trading-day off-hours (incl. the close bell itself) → `options-market-closed`
 *
 * The profile name says "weekend" but the condition is "no session today at all".
 * A holiday is the same situation as a Saturday — Yahoo will not publish another
 * options snapshot until the next open — so the 30-minute `options-market-closed`
 * TTL would just re-fetch identical data ~48 times over the day, and that TTL is
 * also the Redis TTL (`optionsDataCache`). The name is kept because it is a
 * registered `cacheLife` profile key in `next.config.ts`.
 */
export function getOptionsCacheLifeProfile(
    now: Date = new Date()
): OptionsCacheLifeProfile {
    if (!isUsTradingDay(now)) return 'options-weekend';
    const status = getEtSessionStatus(now);
    return status === 'open' ? 'options-market-open' : 'options-market-closed';
}
