// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';

// ── Fixture ──────────────────────────────────────────────────────────────────

const EMPTY_SNAPSHOT: FinancialsSnapshot = {
    income: [],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
};

const QUARTER_SNAPSHOT: FinancialsSnapshot = {
    income: [
        {
            fiscalYear: 'Q4 2024',
            period: 'Q4',
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

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetFinancialsQuarterAction = vi.fn();

vi.mock('@/entities/financials-statements/actions', () => ({
    getFinancialsQuarterAction: (symbol: string) =>
        mockGetFinancialsQuarterAction(symbol),
}));

vi.mock('@/widgets/financials/sections/IncomeStatementSection', () => ({
    IncomeStatementSection: ({ rows }: { rows: unknown[] }) => (
        <div data-testid="income-section" data-rows={rows.length} />
    ),
}));
vi.mock('@/widgets/financials/sections/BalanceSheetSection', () => ({
    BalanceSheetSection: ({ rows }: { rows: unknown[] }) => (
        <div data-testid="balance-section" data-rows={rows.length} />
    ),
}));
vi.mock('@/widgets/financials/sections/CashFlowSection', () => ({
    CashFlowSection: ({ rows }: { rows: unknown[] }) => (
        <div data-testid="cashflow-section" data-rows={rows.length} />
    ),
}));
vi.mock('@/widgets/financials/sections/GrowthAnalysisSection', () => ({
    GrowthAnalysisSection: ({ rows }: { rows: unknown[] }) => (
        <div data-testid="growth-section" data-rows={rows.length} />
    ),
}));
vi.mock('@/widgets/financials/PeriodToggle', () => ({
    PeriodToggle: ({
        value,
        onChange,
    }: {
        value: string;
        onChange: (v: 'annual' | 'quarter') => void;
        children?: ReactNode;
    }) => (
        <div data-testid="period-toggle" data-value={value}>
            <button onClick={() => onChange('annual')} data-testid="btn-annual">
                연간
            </button>
            <button
                onClick={() => onChange('quarter')}
                data-testid="btn-quarter"
            >
                분기
            </button>
        </div>
    ),
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FinancialsStatements', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetFinancialsQuarterAction.mockResolvedValue(QUARTER_SNAPSHOT);
    });

    async function renderStatements(snapshot = EMPTY_SNAPSHOT) {
        const { FinancialsStatements } =
            await import('../FinancialsStatements');
        return render(
            <FinancialsStatements symbol="AAPL" annualSnapshot={snapshot} />
        );
    }

    it('renders the period toggle', async () => {
        await renderStatements();
        expect(screen.getByTestId('period-toggle')).toBeInTheDocument();
        expect(screen.getByTestId('period-toggle').dataset.value).toBe(
            'annual'
        );
    });

    it('renders all 4 statement sections', async () => {
        await renderStatements();
        expect(screen.getByTestId('income-section')).toBeInTheDocument();
        expect(screen.getByTestId('balance-section')).toBeInTheDocument();
        expect(screen.getByTestId('cashflow-section')).toBeInTheDocument();
        expect(screen.getByTestId('growth-section')).toBeInTheDocument();
    });

    it('fetches quarter data when toggle switches to quarter', async () => {
        await renderStatements();
        fireEvent.click(screen.getByTestId('btn-quarter'));

        await waitFor(() => {
            expect(screen.getByTestId('period-toggle').dataset.value).toBe(
                'quarter'
            );
        });

        expect(mockGetFinancialsQuarterAction).toHaveBeenCalledWith('AAPL');
    });
});
