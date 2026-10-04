import { render, screen } from '@testing-library/react';
import type { CashFlowRow } from '@y0ngha/siglens-core';
import { CashFlowSection } from '../CashFlowSection';

const SAMPLE_ROWS: CashFlowRow[] = [
    {
        fiscalYear: '2024',
        period: 'FY',
        date: '2024-12-31',
        operatingCashFlow: 1_200_000_000,
        capitalExpenditure: -300_000_000,
        freeCashFlow: 900_000_000,
        dividendsPaid: -150_000_000,
        fcfMargin: 30,
    },
    {
        fiscalYear: '2023',
        period: 'FY',
        date: '2023-12-31',
        operatingCashFlow: 900_000_000,
        capitalExpenditure: -250_000_000,
        freeCashFlow: 650_000_000,
        dividendsPaid: -120_000_000,
        fcfMargin: null,
    },
    {
        fiscalYear: '2022',
        period: 'FY',
        date: '2022-12-31',
        operatingCashFlow: 600_000_000,
        capitalExpenditure: -200_000_000,
        freeCashFlow: 400_000_000,
        dividendsPaid: null,
        fcfMargin: 22,
    },
];

describe('CashFlowSection', () => {
    it('renders empty card when no rows provided', () => {
        render(<CashFlowSection rows={[]} />);
        expect(
            screen.getByText('데이터를 불러올 수 없어요')
        ).toBeInTheDocument();
    });

    it('renders section heading', () => {
        render(<CashFlowSection rows={SAMPLE_ROWS} />);
        expect(
            screen.getByRole('heading', { name: '현금흐름표' })
        ).toBeInTheDocument();
    });

    it('renders operating cash flow label', () => {
        render(<CashFlowSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('영업현금흐름')).toBeInTheDocument();
    });

    it('renders capex label', () => {
        render(<CashFlowSection rows={SAMPLE_ROWS} />);
        // CapEx appears in chart legend (1) + table row (1)
        expect(screen.getAllByText('CapEx')).toHaveLength(2);
    });

    it('renders FCF label', () => {
        render(<CashFlowSection rows={SAMPLE_ROWS} />);
        // FCF appears in chart legend (1) + table row (1)
        expect(screen.getAllByText('FCF')).toHaveLength(2);
    });

    it('renders FCF margin label', () => {
        render(<CashFlowSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('FCF마진')).toBeInTheDocument();
    });

    it('renders dividends label', () => {
        render(<CashFlowSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('배당')).toBeInTheDocument();
    });

    it('renders em-dash for null dividendsPaid', () => {
        render(<CashFlowSection rows={SAMPLE_ROWS} />);
        // null dividendsPaid (2022) + null fcfMargin (2023) → 2 em-dashes
        expect(screen.getAllByText('—')).toHaveLength(2);
    });

    it('renders trend chart SVG', () => {
        const { container } = render(<CashFlowSection rows={SAMPLE_ROWS} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders fiscal year columns', () => {
        render(<CashFlowSection rows={SAMPLE_ROWS} />);
        // Year labels appear in chart axis (1) + table column header (1)
        expect(screen.getAllByText('2022')).toHaveLength(2);
        expect(screen.getAllByText('2023')).toHaveLength(2);
        expect(screen.getAllByText('2024')).toHaveLength(2);
    });
});
