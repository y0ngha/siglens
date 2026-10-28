'use client';

/**
 * 재무제표 클라이언트 래퍼 — 기간 토글과 네 재무제표 섹션을 잇는다.
 */
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import { PeriodToggle } from './PeriodToggle';
import { useFinancialsPeriod } from './hooks/useFinancialsPeriod';
import { IncomeStatementSection } from './sections/IncomeStatementSection';
import { BalanceSheetSection } from './sections/BalanceSheetSection';
import { CashFlowSection } from './sections/CashFlowSection';
import { GrowthAnalysisSection } from './sections/GrowthAnalysisSection';
import { PeriodStatus } from './ui/period-status/PeriodStatus';
import { deriveStatementCurrency } from './utils/statementCurrency';

interface FinancialsStatementsProps {
    /** 대문자로 정규화된 티커 심볼. */
    symbol: string;
    /** SSR이 가져온 연간 스냅샷 — 클라이언트 조회 없이 바로 보인다. */
    annualSnapshot: FinancialsSnapshot;
}

/**
 * RSC 페이지가 SSR 연간 스냅샷을 넘기고, 'quarter'로 전환하면 `useFinancialsPeriod`가 분기
 * 스냅샷을 지연 조회한다.
 *
 * 스코어카드(히어로)는 페이지가 직접 SSR로 그린다 — 항상 연간 스냅샷으로 계산되며 토글에
 * 참여하지 않는다.
 */
export function FinancialsStatements({
    symbol,
    annualSnapshot,
}: FinancialsStatementsProps) {
    const { period, setPeriod, snapshot, isLoading, quarterUnavailable } =
        useFinancialsPeriod(symbol, annualSnapshot);
    // 통화는 보여 주는 스냅샷마다 정한다 — 공시자의 보고 통화가 있으면 그것(ADR의 TWD 등),
    // 없으면 심볼 형상으로 정한 상장 통화다.
    const currency = deriveStatementCurrency(snapshot, symbol);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <PeriodToggle value={period} onChange={setPeriod} />
                <PeriodStatus
                    isLoading={isLoading}
                    quarterUnavailable={quarterUnavailable}
                />
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
