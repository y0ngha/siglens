'use server';

import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import {
    getFinancialsSnapshot,
    QUARTER_LIMIT,
} from '@/entities/financials-statements/lib/getFinancialsSnapshot';

/** Structurally complete empty snapshot returned on an unexpected fetch failure. */
const EMPTY_SNAPSHOT: FinancialsSnapshot = {
    income: [],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
};

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
 *
 * §0.7: Server Actions must never propagate exceptions to the client. On an
 * unexpected throw we log and return an EMPTY snapshot (all sections []) instead
 * of rejecting. `useFinancialsPeriod`'s all-empty detection then reverts the
 * toggle to annual, so the user keeps seeing valid SSR data rather than a 500.
 */
export async function getFinancialsQuarterAction(
    symbol: string
): Promise<FinancialsSnapshot> {
    try {
        return await getFinancialsSnapshot(symbol, 'quarter', QUARTER_LIMIT);
    } catch (error) {
        console.error(
            '[getFinancialsQuarterAction] quarter fetch failed:',
            symbol,
            error
        );
        return EMPTY_SNAPSHOT;
    }
}
