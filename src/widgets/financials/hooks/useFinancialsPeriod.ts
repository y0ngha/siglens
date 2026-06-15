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
 * Manages the annual/quarter period toggle for the financials page.
 *
 * - 'annual': SSR-provided `initialAnnualSnapshot` is used immediately (no fetch).
 * - 'quarter': lazily calls `getFinancialsQuarterAction` on first switch.
 *   The fetched result is retained in state so subsequent toggles are instant.
 *
 * On fetch failure the hook reverts to 'annual' and the initial annual snapshot,
 * ensuring the user always sees valid data.
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
                    setQuarterSnapshot(data);
                })
                .catch(() => {
                    // Revert to annual on failure so the user sees valid data.
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
