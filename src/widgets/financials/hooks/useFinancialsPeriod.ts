'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';
import { fetchAndApplyQuarterSnapshot } from '../utils/financialsPeriodUtils';

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

    /**
     * Ref holding the latest `quarterSnapshot` value so that `setPeriod`'s
     * `useCallback` can read it without listing it as a dependency. This keeps
     * `setPeriod` stable across quarter-state changes — components receiving it
     * as a prop (e.g. PeriodToggle) won't re-render solely because a snapshot
     * arrived.
     *
     * Updated via `useEffect` (not inline during render) to satisfy the
     * react-hooks/refs lint rule that forbids ref mutation during render.
     */
    const quarterSnapshotRef = useRef<FinancialsSnapshot | null>(null);

    const setPeriod = useCallback(
        (next: StatementPeriod) => {
            if (next === 'annual') {
                setPeriodState('annual');
                return;
            }

            if (quarterSnapshotRef.current !== null) {
                setPeriodState('quarter');
                return;
            }

            setPeriodState('quarter');
            setIsLoading(true);
            void fetchAndApplyQuarterSnapshot(symbol, {
                setPeriodState,
                setQuarterSnapshot,
                setIsLoading,
            });
        },
        [symbol]
    );

    const snapshot =
        period === 'quarter' && quarterSnapshot !== null
            ? quarterSnapshot
            : initialAnnualSnapshot;

    useEffect(() => {
        quarterSnapshotRef.current = quarterSnapshot;
    }, [quarterSnapshot]);

    return { period, setPeriod, snapshot, isLoading };
}
