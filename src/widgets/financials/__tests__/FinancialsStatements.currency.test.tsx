// @vitest-environment jsdom

/**
 * 뮤테이션 감사 생존자 회귀 가드: `FinancialsStatements`의
 * `statementCurrencyOf(symbol)` → `'USD'` 하드코딩 뮤테이션이 181/181
 * 그린으로 살아남았다. 기존 `FinancialsStatements.test.tsx`는
 * IncomeStatementSection 등 4개 섹션을 전부 mock해 rows 개수만 확인하므로
 * currency prop이 실제 DOM 셀까지 배선되는지는 아무도 검증하지 않았다 — 이
 * PR이 고친 정확한 버그(한국 종목이 원화 대신 달러로 렌더)가 그대로 재발해도
 * 그린이 유지됐다는 뜻이다.
 *
 * 이 파일은 섹션을 mock하지 않고 실제 IncomeStatementSection/StatementTable을
 * 렌더해 손익계산서 매출 셀의 통화 기호로 배선을 pin한다.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import { FinancialsStatements } from '../FinancialsStatements';

// useFinancialsPeriod → financialsPeriodUtils → actions.ts('use server')는 DB에
// 닿으므로, 클릭하지 않아도(quarter 토글 미사용) 모듈 로드 시점 크래시를 막기
// 위해 mock한다(FinancialsStatements.test.tsx와 동일 패턴).
vi.mock('@/entities/financials-statements/actions', () => ({
    getFinancialsQuarterAction: vi.fn(),
}));

const SNAPSHOT: FinancialsSnapshot = {
    income: [
        {
            fiscalYear: '2024',
            period: 'FY',
            date: '2024-12-31',
            revenue: 1_000_000,
            grossProfit: 600_000,
            operatingIncome: 300_000,
            netIncome: 200_000,
            ebitda: 350_000,
            eps: 1.0,
            epsDiluted: 0.98,
            grossMargin: 60,
            operatingMargin: 30,
            netMargin: 20,
        },
    ],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
};

describe('FinancialsStatements — currency wiring (mutation audit)', () => {
    it('한국 종목(.KS)은 손익계산서 매출 셀을 원화(₩)로 렌더한다', () => {
        render(
            <FinancialsStatements
                symbol="005930.KS"
                annualSnapshot={SNAPSHOT}
            />
        );
        expect(screen.getByText('₩100만')).toBeInTheDocument();
        expect(screen.queryByText('$1M')).not.toBeInTheDocument();
    });

    it('미국 종목은 기존대로 손익계산서 매출 셀을 달러($)로 렌더한다', () => {
        render(
            <FinancialsStatements symbol="AAPL" annualSnapshot={SNAPSHOT} />
        );
        expect(screen.getByText('$1M')).toBeInTheDocument();
        expect(screen.queryByText('₩100만')).not.toBeInTheDocument();
    });
});
