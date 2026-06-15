import { render, screen } from '@testing-library/react';
import type { IncomeStatementRow } from '@y0ngha/siglens-core';
import { IncomeStatementSection } from '../IncomeStatementSection';

const SAMPLE_ROWS: IncomeStatementRow[] = [
    {
        fiscalYear: '2024',
        period: 'FY',
        date: '2024-12-31',
        revenue: 3_000_000_000,
        grossProfit: 1_800_000_000,
        operatingIncome: 900_000_000,
        netIncome: 750_000_000,
        ebitda: 1_000_000_000,
        eps: 3.5,
        epsDiluted: 3.4,
        grossMargin: 60,
        operatingMargin: 30,
        netMargin: 25,
    },
    {
        fiscalYear: '2023',
        period: 'FY',
        date: '2023-12-31',
        revenue: 2_000_000_000,
        grossProfit: 1_100_000_000,
        operatingIncome: 600_000_000,
        netIncome: 500_000_000,
        ebitda: 700_000_000,
        eps: 2.1,
        epsDiluted: 2.0,
        grossMargin: 55,
        operatingMargin: 30,
        netMargin: 25,
    },
    {
        fiscalYear: '2022',
        period: 'FY',
        date: '2022-12-31',
        revenue: 1_000_000_000,
        grossProfit: 500_000_000,
        operatingIncome: null,
        netIncome: 200_000_000,
        ebitda: 300_000_000,
        eps: 1.0,
        epsDiluted: 0.95,
        grossMargin: 50,
        operatingMargin: null,
        netMargin: 20,
    },
];

describe('IncomeStatementSection', () => {
    it('renders empty card when no rows provided', () => {
        render(<IncomeStatementSection rows={[]} />);
        expect(
            screen.getByText('데이터를 불러올 수 없습니다.')
        ).toBeInTheDocument();
    });

    it('renders section heading', () => {
        render(<IncomeStatementSection rows={SAMPLE_ROWS} />);
        expect(
            screen.getByRole('heading', { name: '손익계산서' })
        ).toBeInTheDocument();
    });

    it('renders metric labels', () => {
        render(<IncomeStatementSection rows={SAMPLE_ROWS} />);
        // 매출 appears in both chart legend and table — use getAllByText
        expect(screen.getAllByText('매출').length).toBeGreaterThan(0);
        expect(screen.getByText('매출총이익')).toBeInTheDocument();
        expect(screen.getByText('영업이익')).toBeInTheDocument();
        // 순이익 appears in both chart legend and table — use getAllByText
        expect(screen.getAllByText('순이익').length).toBeGreaterThan(0);
        expect(screen.getByText('EPS')).toBeInTheDocument();
    });

    it('renders margin labels', () => {
        render(<IncomeStatementSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('매출총이익률')).toBeInTheDocument();
        expect(screen.getByText('영업이익률')).toBeInTheDocument();
        expect(screen.getByText('순이익률')).toBeInTheDocument();
    });

    it('renders em-dash for null operating income', () => {
        render(<IncomeStatementSection rows={SAMPLE_ROWS} />);
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThan(0);
    });

    it('renders fiscal year labels as columns (oldest→newest)', () => {
        render(<IncomeStatementSection rows={SAMPLE_ROWS} />);
        // Year labels appear in both SVG text elements and visible spans
        expect(screen.getAllByText('2022').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
    });

    it('renders trend chart', () => {
        const { container } = render(
            <IncomeStatementSection rows={SAMPLE_ROWS} />
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });
});
