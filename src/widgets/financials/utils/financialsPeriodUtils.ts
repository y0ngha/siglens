import type { FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';
import { getFinancialsQuarterAction } from '@/entities/financials-statements/actions';

/**
 * True when the snapshot carries no statement data in any section.
 *
 * `getFinancialsQuarterAction` → `CachedFinancialStatementsProvider` swallows
 * FMP throws and returns `[]`, so a failed fetch RESOLVES with an all-empty
 * normalized snapshot rather than rejecting. We treat that as a soft failure
 * (same as a rejection) so the toggle can revert to annual instead of showing
 * a page full of EmptySectionCard placeholders.
 */
export function isEmptySnapshot(snapshot: FinancialsSnapshot): boolean {
    return (
        snapshot.income.length === 0 &&
        snapshot.balance.length === 0 &&
        snapshot.cashFlow.length === 0
    );
}

export interface FetchQuarterContext {
    setPeriodState: (p: StatementPeriod) => void;
    setQuarterSnapshot: (s: FinancialsSnapshot) => void;
    setIsLoading: (v: boolean) => void;
}

/**
 * Module-level async state machine for the lazy quarter fetch.
 *
 * Extracted from the hook so it can be tested independently and does not
 * capture setState setters via closure — callers pass an explicit context
 * object instead, keeping the dependency contract visible at the call site.
 *
 * Failure handling (both shapes):
 * - **Rejection**: action promise rejects → setPeriodState('annual').
 * - **All-empty resolution**: provider swallows FMP throw and resolves with an
 *   all-empty snapshot → detected by isEmptySnapshot, setPeriodState('annual').
 * In both cases setIsLoading(false) is guaranteed via finally.
 */
export async function fetchAndApplyQuarterSnapshot(
    symbol: string,
    ctx: FetchQuarterContext
): Promise<void> {
    try {
        const data = await getFinancialsQuarterAction(symbol);
        if (isEmptySnapshot(data)) {
            ctx.setPeriodState('annual');
            return;
        }
        ctx.setQuarterSnapshot(data);
    } catch (error) {
        console.warn(
            '[fetchAndApplyQuarterSnapshot] quarter fetch failed, falling back to annual:',
            error
        );
        ctx.setPeriodState('annual');
    } finally {
        ctx.setIsLoading(false);
    }
}
