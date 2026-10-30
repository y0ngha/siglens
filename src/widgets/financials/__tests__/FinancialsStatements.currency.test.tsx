// @vitest-environment jsdom

/**
 * `FinancialsStatements`가 통화를 실제 DOM 셀까지 배선하는지 확인한다. 섹션을 mock하지 않고
 * 실제 IncomeStatementSection/StatementTable을 렌더해, 손익계산서 매출·EPS 셀의 통화 표기로
 * 배선을 고정한다 — 섹션을 mock하는 `FinancialsStatements.test.tsx`는 rows 개수만 본다.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import { FinancialsStatements } from '../FinancialsStatements';

// useFinancialsPeriod → financialsPeriodUtils → actions.ts('use server')는 DB에
// 닿으므로, 클릭하지 않아도(quarter 토글 미사용) 모듈 로드 시점 크래시를 막기
// 위해 mock한다(FinancialsStatements.test.tsx와 동일 패턴).
vi.mock(
    '@/entities/financials-statements/actions/getFinancialsQuarterAction',
    () => ({
        getFinancialsQuarterAction: vi.fn(),
    })
);

function snapshotWith(
    reportedCurrency: (string | null | undefined)[]
): FinancialsSnapshot {
    return {
        ...SNAPSHOT,
        income: reportedCurrency.map((code, i) => ({
            ...SNAPSHOT.income[0],
            fiscalYear: String(2024 - i),
            reportedCurrency: code,
        })),
    };
}

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

describe('FinancialsStatements — 상장 통화 배선', () => {
    it('한국 종목(.KS)은 손익계산서 매출 셀을 원화(₩)로 렌더한다', () => {
        render(
            <FinancialsStatements
                symbol="005930.KS"
                annualSnapshot={SNAPSHOT}
            />
        );
        expect(screen.getByText('₩100만')).toBeInTheDocument();
        expect(screen.queryByText('US$100만')).not.toBeInTheDocument();
    });

    it('미국 종목은 기존대로 손익계산서 매출 셀을 달러($)로 렌더한다', () => {
        render(
            <FinancialsStatements symbol="AAPL" annualSnapshot={SNAPSHOT} />
        );
        expect(screen.getByText('US$100만')).toBeInTheDocument();
        expect(screen.queryByText('₩100만')).not.toBeInTheDocument();
    });
});

describe('FinancialsStatements — 보고 통화(ADR)', () => {
    it('행의 보고 통화가 TWD면 상장 통화(USD)가 아니라 TWD로 금액을 렌더한다', () => {
        render(
            <FinancialsStatements
                symbol="TSM"
                annualSnapshot={snapshotWith(['TWD', 'TWD'])}
            />
        );
        expect(screen.getAllByText(/TWD/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
    });

    it('보고 통화가 행마다 다르면 상장 통화로 둔다', () => {
        render(
            <FinancialsStatements
                symbol="TSM"
                annualSnapshot={snapshotWith(['TWD', 'USD'])}
            />
        );
        expect(screen.queryByText(/TWD/)).not.toBeInTheDocument();
        expect(screen.getAllByText(/US\$/).length).toBeGreaterThan(0);
    });

    it('보고 통화가 없거나 공백이면 기존 출력을 유지한다', () => {
        render(
            <FinancialsStatements
                symbol="AAPL"
                annualSnapshot={snapshotWith([null, '  '])}
            />
        );
        expect(screen.getAllByText(/US\$/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/TWD/)).not.toBeInTheDocument();
    });

    it('EPS도 보고 통화로 표기한다', () => {
        render(
            <FinancialsStatements
                symbol="TSM"
                annualSnapshot={snapshotWith(['TWD'])}
            />
        );
        expect(screen.getByText(/TWD.*1\.00/)).toBeInTheDocument();
    });

    it('한국 종목의 EPS는 원화 기호와 천 단위 구분자로 표기한다', () => {
        const snapshot = snapshotWith([null]);
        snapshot.income[0] = { ...snapshot.income[0], eps: 4950 };
        render(
            <FinancialsStatements
                symbol="005930.KS"
                annualSnapshot={snapshot}
            />
        );
        expect(screen.getByText('₩4,950')).toBeInTheDocument();
    });
});
