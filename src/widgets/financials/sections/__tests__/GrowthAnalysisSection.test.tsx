import { render, screen } from '@testing-library/react';
import type { FinancialGrowthRow } from '@y0ngha/siglens-core';
import { GrowthAnalysisSection } from '../GrowthAnalysisSection';

const SAMPLE_ROWS: FinancialGrowthRow[] = [
    {
        fiscalYear: '2024',
        period: 'FY',
        revenueGrowth: 0.5,
        netIncomeGrowth: 0.4,
        epsGrowth: 0.35,
        freeCashFlowGrowth: 0.3,
        operatingCashFlowGrowth: 0.25,
        assetGrowth: 0.2,
        debtGrowth: 0.1,
        threeYRevenueGrowthPerShare: 0.45,
        fiveYRevenueGrowthPerShare: 0.38,
        tenYRevenueGrowthPerShare: null,
    },
    {
        fiscalYear: '2023',
        period: 'FY',
        revenueGrowth: 0.2,
        netIncomeGrowth: -0.1,
        epsGrowth: 0.15,
        freeCashFlowGrowth: null,
        operatingCashFlowGrowth: 0.18,
        assetGrowth: 0.12,
        debtGrowth: 0.08,
        threeYRevenueGrowthPerShare: null,
        fiveYRevenueGrowthPerShare: null,
        tenYRevenueGrowthPerShare: null,
    },
];

describe('GrowthAnalysisSection', () => {
    it('renders empty card when no rows provided', () => {
        render(<GrowthAnalysisSection rows={[]} />);
        expect(
            screen.getByText('데이터를 불러올 수 없습니다.')
        ).toBeInTheDocument();
    });

    it('renders section heading', () => {
        render(<GrowthAnalysisSection rows={SAMPLE_ROWS} />);
        expect(
            screen.getByRole('heading', { name: '성장 분석' })
        ).toBeInTheDocument();
    });

    it('renders revenue growth label', () => {
        render(<GrowthAnalysisSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('매출성장')).toBeInTheDocument();
    });

    it('renders net income growth label', () => {
        render(<GrowthAnalysisSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('순이익성장')).toBeInTheDocument();
    });

    it('renders EPS growth label', () => {
        render(<GrowthAnalysisSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('EPS성장')).toBeInTheDocument();
    });

    it('renders FCF growth label', () => {
        render(<GrowthAnalysisSection rows={SAMPLE_ROWS} />);
        expect(screen.getByText('FCF성장')).toBeInTheDocument();
    });

    it('renders per-share growth labels for 3Y/5Y/10Y', () => {
        render(<GrowthAnalysisSection rows={SAMPLE_ROWS} />);
        // Latest row (index 0 = 2024) per-share growth
        expect(screen.getByText('3Y 주당매출성장')).toBeInTheDocument();
        expect(screen.getByText('5Y 주당매출성장')).toBeInTheDocument();
        expect(screen.getByText('10Y 주당매출성장')).toBeInTheDocument();
    });

    it('formats growth fractions as percentages', () => {
        render(<GrowthAnalysisSection rows={SAMPLE_ROWS} />);
        // 0.5 → 50.0%
        const pctCells = screen.getAllByText(/%/);
        expect(pctCells.length).toBeGreaterThan(0);
    });

    it('renders em-dash for null growth values', () => {
        render(<GrowthAnalysisSection rows={SAMPLE_ROWS} />);
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThan(0);
    });

    it('renders fiscal year columns', () => {
        render(<GrowthAnalysisSection rows={SAMPLE_ROWS} />);
        // Year labels may appear multiple times (table headers)
        expect(screen.getAllByText('2023').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
    });
});
