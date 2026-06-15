'use server';

import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import {
    getFinancialsSnapshot,
    QUARTER_LIMIT,
} from '@/entities/financials-statements/lib/getFinancialsSnapshot';

/**
 * Server Action — lazily fetches the quarter-period financial snapshot on
 * demand. Called by `useFinancialsPeriod` when the user switches to the
 * quarterly view.
 *
 * Delegates to the entity lib `getFinancialsSnapshot` (the single 6-fetch+normalize
 * source) with `period='quarter'`, `limit=QUARTER_LIMIT`. Because the lib owns the
 * cache keys + tag, this action shares the exact same Next data cache entries as
 * the SSR annual path. Living in the `entities` layer lets the `widgets` layer
 * import it without violating the FSD dependency rule (widgets → app is forbidden).
 */
export async function getFinancialsQuarterAction(
    symbol: string
): Promise<FinancialsSnapshot> {
    return getFinancialsSnapshot(symbol, 'quarter', QUARTER_LIMIT);
}
