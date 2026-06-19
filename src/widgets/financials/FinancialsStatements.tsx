'use client';

import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import { PeriodToggle } from './PeriodToggle';
import { useFinancialsPeriod } from './hooks/useFinancialsPeriod';
import { IncomeStatementSection } from './sections/IncomeStatementSection';
import { BalanceSheetSection } from './sections/BalanceSheetSection';
import { CashFlowSection } from './sections/CashFlowSection';
import { GrowthAnalysisSection } from './sections/GrowthAnalysisSection';

interface FinancialsStatementsProps {
    /** Ticker symbol (already uppercased). */
    symbol: string;
    /** SSR-fetched annual snapshot — shown immediately without any client fetch. */
    annualSnapshot: FinancialsSnapshot;
}

/**
 * Client wrapper that combines the period toggle with the four statement
 * sections. The RSC page passes the SSR annual snapshot; switching to
 * 'quarter' lazily fetches via `useFinancialsPeriod`.
 *
 * The scorecard (hero) stays pure-SSR and is rendered by the page directly —
 * it is always computed from the annual snapshot and does not participate in
 * the toggle.
 */
export function FinancialsStatements({
    symbol,
    annualSnapshot,
}: FinancialsStatementsProps) {
    const { period, setPeriod, snapshot, isLoading } = useFinancialsPeriod(
        symbol,
        annualSnapshot
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <PeriodToggle value={period} onChange={setPeriod} />
                {isLoading && (
                    <span
                        className="text-secondary-400 flex items-center gap-1.5 text-xs"
                        role="status"
                        aria-live="polite"
                    >
                        <span
                            aria-hidden="true"
                            className="border-primary-500 h-3 w-3 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none"
                        />
                        불러오는 중…
                    </span>
                )}
            </div>
            <IncomeStatementSection rows={snapshot.income} />
            <BalanceSheetSection rows={snapshot.balance} />
            <CashFlowSection rows={snapshot.cashFlow} />
            <GrowthAnalysisSection rows={snapshot.financialGrowth} />
        </div>
    );
}
