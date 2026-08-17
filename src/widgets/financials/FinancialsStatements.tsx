'use client';

import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import { PeriodToggle } from './PeriodToggle';
import { useFinancialsPeriod } from './hooks/useFinancialsPeriod';
import { IncomeStatementSection } from './sections/IncomeStatementSection';
import { BalanceSheetSection } from './sections/BalanceSheetSection';
import { CashFlowSection } from './sections/CashFlowSection';
import { GrowthAnalysisSection } from './sections/GrowthAnalysisSection';
import { statementCurrencyOf } from './utils/numberFormat';

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
    // 재무제표 금액의 통화는 심볼 형상만으로 결정된다 — 한국 종목은 원화라
    // `$333T`가 아니라 `₩333조`로 표기돼야 한다. 별도 조회나 prop이 필요 없다.
    const currency = statementCurrencyOf(symbol);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <PeriodToggle value={period} onChange={setPeriod} />
                {isLoading && (
                    <span
                        className="flex items-center gap-1.5 text-xs text-secondary-400"
                        role="status"
                        aria-live="polite"
                    >
                        <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-primary-500 border-t-transparent motion-reduce:animate-none"
                        />
                        불러오는 중…
                    </span>
                )}
            </div>
            <IncomeStatementSection
                rows={snapshot.income}
                currency={currency}
            />
            <BalanceSheetSection rows={snapshot.balance} currency={currency} />
            <CashFlowSection rows={snapshot.cashFlow} currency={currency} />
            {/* 성장 분석은 전부 %/배수라 통화가 없다 — currency를 넘기지 않는다. */}
            <GrowthAnalysisSection rows={snapshot.financialGrowth} />
        </div>
    );
}
