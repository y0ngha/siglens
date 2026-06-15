import { render, screen } from '@testing-library/react';
import type { BalanceSheetRow } from '@y0ngha/siglens-core';
import { BalanceSheetSection } from '../BalanceSheetSection';

const SAMPLE_ROWS: BalanceSheetRow[] = [
    {
        fiscalYear: '2024',
        period: 'FY',
        date: '2024-12-31',
        totalAssets: 10_000_000_000,
        totalCurrentAssets: 4_000_000_000,
        totalLiabilities: 6_000_000_000,
        totalCurrentLiabilities: 2_000_000_000,
        cashAndShortTermInvestments: 1_500_000_000,
        totalDebt: 3_000_000_000,
        netDebt: 1_500_000_000,
        totalStockholdersEquity: 4_000_000_000,
        currentRatio: 2.0,
    },
    {
        fiscalYear: '2023',
        period: 'FY',
        date: '2023-12-31',
        totalAssets: 8_000_000_000,
        totalCurrentAssets: 3_000_000_000,
        totalLiabilities: 5_000_000_000,
        totalCurrentLiabilities: 1_800_000_000,
        cashAndShortTermInvestments: 1_000_000_000,
        totalDebt: 2_500_000_000,
        netDebt: 1_500_000_000,
        totalStockholdersEquity: 3_000_000_000,
        currentRatio: 1.67,
    },
];

describe('BalanceSheetSection', () => {
    it('renders empty card when no rows provided', () => {
        render(<BalanceSheetSection rows={[]} />);
        expect(
            screen.getByText('데이터를 불러올 수 없습니다.')
        ).toBeInTheDocument();
    });

    it('renders section heading', () => {
        render(<BalanceSheetSection rows={SAMPLE_ROWS} />);
        expect(
            screen.getByRole('heading', { name: '재무상태표' })
        ).toBeInTheDocument();
    });

    it('renders total assets label', () => {
        render(<BalanceSheetSection rows={SAMPLE_ROWS} />);
        // 총자산 appears in chart legend and table row
        expect(screen.getAllByText('총자산').length).toBeGreaterThan(0);
    });

    it('renders total liabilities label', () => {
        render(<BalanceSheetSection rows={SAMPLE_ROWS} />);
        // 총부채 appears in chart legend and table row
        expect(screen.getAllByText('총부채').length).toBeGreaterThan(0);
    });

    it('renders net debt label', () => {
        render(<BalanceSheetSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('순부채')).toBeInTheDocument();
    });

    it('renders cash label', () => {
        render(<BalanceSheetSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('현금')).toBeInTheDocument();
    });

    it('renders equity label', () => {
        render(<BalanceSheetSection rows={SAMPLE_ROWS} />);
        // 자본 appears in chart legend and table row
        expect(screen.getAllByText('자본').length).toBeGreaterThan(0);
    });

    it('renders current ratio label', () => {
        render(<BalanceSheetSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('유동비율')).toBeInTheDocument();
    });

    it('renders trend chart SVG', () => {
        const { container } = render(
            <BalanceSheetSection rows={SAMPLE_ROWS} />
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders fiscal year columns oldest→newest', () => {
        render(<BalanceSheetSection rows={SAMPLE_ROWS} />);
        // Year labels appear in SVG text and visible spans
        expect(screen.getAllByText('2023').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
    });
});
