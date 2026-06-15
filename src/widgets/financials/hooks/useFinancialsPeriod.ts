'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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
export function isEmptySnapshot(snapshot: FinancialsSnapshot): boolean {
    return (
        snapshot.income.length === 0 &&
        snapshot.balance.length === 0 &&
        snapshot.cashFlow.length === 0
    );
}

interface FetchQuarterContext {
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
    } catch {
        ctx.setPeriodState('annual');
    } finally {
        ctx.setIsLoading(false);
    }
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
