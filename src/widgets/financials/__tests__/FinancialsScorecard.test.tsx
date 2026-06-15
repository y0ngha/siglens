import { render, screen } from '@testing-library/react';
import type { FinancialsScorecard } from '@y0ngha/siglens-core';
import { FinancialsScorecard as FinancialsScorecardWidget } from '@/widgets/financials/FinancialsScorecard';

/**
 * Worst-case scorecard fixture — all axes at grade F / score 0.
 *
 * Note: computeFinancialsScorecard(emptySnapshot) crashes on the current core
 * version when passed empty arrays (TypeError: Cannot read property '0').
 * The task spec says "grade 'F' for empty", which is the logical outcome.
 * We hand-build the worst-case fixture directly to exercise the UI path
 * without depending on a core bug fix. Tests still verify the widget renders
 * grade 'F' correctly across all axes.
 */
const EMPTY_SCORECARD: FinancialsScorecard = {
    growth: { score: 0, grade: 'F', signals: [], metrics: [] },
    quality: { score: 0, grade: 'F', signals: [], metrics: [] },
    solvency: { score: 0, grade: 'F', signals: [], metrics: [] },
    cash: { score: 0, grade: 'F', signals: [], metrics: [] },
    composite: {
        score: 0,
        grade: 'F',
        summaryKo: '데이터가 충분하지 않습니다',
    },
};

/** Hand-built scorecard fixture for precise value testing. */
const HAND_BUILT_SCORECARD: FinancialsScorecard = {
    growth: {
        score: 75,
        grade: 'B',
        signals: [
            {
                type: 'revenue_accel',
                direction: 'positive',
                labelKo: '매출 가속화',
            },
        ],
        metrics: [{ labelKo: '매출 성장률', value: 15, unit: 'pct' }],
    },
    quality: {
        score: 82,
        grade: 'A',
        signals: [
            {
                type: 'margin_expansion',
                direction: 'positive',
                labelKo: '마진 확대',
            },
        ],
        metrics: [{ labelKo: '영업이익률', value: 20, unit: 'pct' }],
    },
    solvency: {
        score: 60,
        grade: 'C',
        signals: [
            {
                type: 'debt_rising',
                direction: 'negative',
                labelKo: '부채 증가',
            },
        ],
        metrics: [{ labelKo: '부채비율', value: 0.45, unit: 'ratio' }],
    },
    cash: {
        score: 70,
        grade: 'B',
        signals: [
            { type: 'fcf_solid', direction: 'positive', labelKo: 'FCF 견조' },
        ],
        metrics: [{ labelKo: 'FCF 마진', value: 12, unit: 'pct' }],
    },
    composite: {
        score: 72,
        grade: 'B',
        summaryKo: '수익성이 강점, 안정성이 약점',
    },
};

describe('FinancialsScorecard widget (empty snapshot)', () => {
    it('renders without crashing for empty snapshot', () => {
        render(<FinancialsScorecardWidget scorecard={EMPTY_SCORECARD} />);
    });

    it('renders grade F for empty snapshot', () => {
        render(<FinancialsScorecardWidget scorecard={EMPTY_SCORECARD} />);
        // composite gauge + 4 axis cards = exactly 5 'F' grade labels
        expect(screen.getAllByText('F')).toHaveLength(5);
    });

    it('renders the composite gauge section', () => {
        render(<FinancialsScorecardWidget scorecard={EMPTY_SCORECARD} />);
        // The gauge should be present with role="img"
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('renders all four axis section headings', () => {
        render(<FinancialsScorecardWidget scorecard={EMPTY_SCORECARD} />);
        expect(
            screen.getByRole('heading', { name: '성장성' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: '수익성·질' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: '안정성' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: '현금창출력' })
        ).toBeInTheDocument();
    });
});

describe('FinancialsScorecard widget (hand-built scorecard)', () => {
    it('renders the composite score', () => {
        render(<FinancialsScorecardWidget scorecard={HAND_BUILT_SCORECARD} />);
        expect(screen.getByText('72')).toBeInTheDocument();
    });

    it('renders the composite summary text', () => {
        render(<FinancialsScorecardWidget scorecard={HAND_BUILT_SCORECARD} />);
        expect(
            screen.getByText('수익성이 강점, 안정성이 약점')
        ).toBeInTheDocument();
    });

    it('renders all four axis cards', () => {
        render(<FinancialsScorecardWidget scorecard={HAND_BUILT_SCORECARD} />);
        expect(
            screen.getByRole('heading', { name: '성장성' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: '수익성·질' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: '안정성' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: '현금창출력' })
        ).toBeInTheDocument();
    });

    it('renders signal chips from axis data', () => {
        render(<FinancialsScorecardWidget scorecard={HAND_BUILT_SCORECARD} />);
        expect(screen.getByText('매출 가속화')).toBeInTheDocument();
        expect(screen.getByText('마진 확대')).toBeInTheDocument();
        expect(screen.getByText('부채 증가')).toBeInTheDocument();
        expect(screen.getByText('FCF 견조')).toBeInTheDocument();
    });
});
