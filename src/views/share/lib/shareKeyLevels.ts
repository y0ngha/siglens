import type { ClusteredKeyLevels, KeyLevels } from '@y0ngha/siglens-core';
import { clusterKeyLevels, validateKeyLevels } from '@y0ngha/siglens-core';

/** Fallback for chart snapshots stored without `keyLevels`. */
export const EMPTY_SHARE_KEY_LEVELS: KeyLevels = {
    support: [],
    resistance: [],
};

/**
 * Current price handed to `clusterKeyLevels`. A share snapshot has no live bar,
 * so it is 0 — epsilon becomes 0 (no merging) while every valid level still
 * flows through.
 */
export const SHARE_CLUSTER_PRICE = 0;

/**
 * Derives the `ClusteredKeyLevels` the read-only `AnalysisPanel` needs from a
 * chart snapshot's raw `keyLevels`: invalid entries are dropped by
 * `validateKeyLevels`, then clustered without a live price. A snapshot without
 * `keyLevels` yields the empty clustered structure so the panel degrades
 * gracefully.
 */
export function toShareKeyLevels(
    keyLevels: KeyLevels | undefined
): ClusteredKeyLevels {
    return clusterKeyLevels(
        validateKeyLevels(keyLevels ?? EMPTY_SHARE_KEY_LEVELS),
        SHARE_CLUSTER_PRICE
    );
}
