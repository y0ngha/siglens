import type { AggregateRecord } from '../lib/snapshot/institutional';
import {
    isPeriodComplete,
    positionsRetentionFloor,
} from '../lib/investorFlowsDates';

/**
 * 13F quarter the holder list is read for: the newest COMPLETE quarter whose positions are still kept, and only
 * when none exists the newest quarter that has positions. The snapshot's `topHolders` and the agent's
 * named-holder lookup both call this, so "the holders" and "this institution's position" always mean the same
 * quarter (a lookup against another quarter than the list beside it would contradict it).
 *
 * `aggregates` is the CUSIP's aggregate rows (any order).
 */
export async function resolveHoldersPeriod(
    reads: {
        findLatestPositionPeriod(cusip: string): Promise<string | null>;
    },
    cusip: string,
    aggregates: readonly AggregateRecord[],
    today: string
): Promise<string | null> {
    const floor = positionsRetentionFloor(today);
    const latestComplete = aggregates
        .filter(a => isPeriodComplete(a.period, today) && a.period >= floor)
        .map(a => a.period)
        .toSorted()
        .at(-1);
    return latestComplete ?? (await reads.findLatestPositionPeriod(cusip));
}
