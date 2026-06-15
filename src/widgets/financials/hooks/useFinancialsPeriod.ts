'use client';

import { useState, useCallback } from 'react';
import type { FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';
import { getFinancialsQuarterAction } from '@/entities/financials-statements/actions';

interface UseFinancialsPeriodResult {
    period: StatementPeriod;
    setPeriod: (period: StatementPeriod) => void;
    snapshot: FinancialsSnapshot;
    isLoading: boolean;
}

/**
 * True when the snapshot carries no statement data in any section.
 *
 * `getFinancialsQuarterAction` → `CachedFinancialStatementsProvider` swallows
 * FMP throws and returns `[]`, so a failed fetch RESOLVES with an all-empty
 * normalized snapshot rather than rejecting. We treat that as a soft failure
 * (same as a rejection) so the toggle can revert to annual instead of showing
 * a page full of EmptySectionCard placeholders.
 */
function isEmptySnapshot(snapshot: FinancialsSnapshot): boolean {
    return (
        snapshot.income.length === 0 &&
        snapshot.balance.length === 0 &&
        snapshot.cashFlow.length === 0
    );
}

/**
 * Manages the annual/quarter period toggle for the financials page.
 *
 * - 'annual': SSR-provided `initialAnnualSnapshot` is used immediately (no fetch).
 * - 'quarter': lazily calls `getFinancialsQuarterAction` on first switch.
 *   The fetched result is retained in state so subsequent toggles are instant.
 *
 * Failure handling reverts to 'annual' (and the initial annual snapshot) on
 * BOTH failure shapes, so the user always sees valid data:
 * - **Rejection**: the action promise rejects (e.g. network/transport error) →
 *   the `.catch` reverts `period` to 'annual'.
 * - **All-empty resolution**: the provider swallows an FMP throw and resolves
 *   with an all-empty snapshot (income/balance/cashFlow all length 0) → we detect
 *   it via `isEmptySnapshot` and revert `period` to 'annual' without caching it.
 *
 * Not using react-query here intentionally: the quarter fetch is a one-shot,
 * symbol-scoped request whose lifecycle is fully owned by this hook instance.
 * The session-level caching benefit of react-query is minimal compared to the
 * additional boilerplate (QueryClient, queryKey) for a non-repeated fetch.
 */
export function useFinancialsPeriod(
    symbol: string,
    initialAnnualSnapshot: FinancialsSnapshot
): UseFinancialsPeriodResult {
    const [period, setPeriodState] = useState<StatementPeriod>('annual');
    const [quarterSnapshot, setQuarterSnapshot] =
        useState<FinancialsSnapshot | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const setPeriod = useCallback(
        (next: StatementPeriod) => {
            if (next === 'annual') {
                setPeriodState('annual');
                return;
            }

            // If we already have quarter data cached in state, swap immediately.
            if (quarterSnapshot !== null) {
                setPeriodState('quarter');
                return;
            }

            // Lazy fetch — only on first switch to 'quarter'.
            setPeriodState('quarter');
            setIsLoading(true);

            getFinancialsQuarterAction(symbol)
                .then(data => {
                    // The action resolves even on an upstream FMP failure (the
                    // provider swallows the throw and returns []). Treat an
                    // all-empty snapshot as a failure and revert to annual.
                    if (isEmptySnapshot(data)) {
                        setPeriodState('annual');
                        return;
                    }
                    setQuarterSnapshot(data);
                })
                .catch(() => {
                    // Revert to annual on rejection so the user sees valid data.
                    setPeriodState('annual');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        },
        [symbol, quarterSnapshot]
    );

    const snapshot =
        period === 'quarter' && quarterSnapshot !== null
            ? quarterSnapshot
            : initialAnnualSnapshot;

    return { period, setPeriod, snapshot, isLoading };
}
