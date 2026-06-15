import { render, screen } from '@testing-library/react';
import { AxisScoreCard } from '@/widgets/financials/AxisScoreCard';
import type { AxisScore } from '@y0ngha/siglens-core';

const SAMPLE_AXIS: AxisScore = {
    score: 72,
    grade: 'B',
    signals: [
        {
            type: 'revenue_accel',
            direction: 'positive',
            labelKo: '매출 가속화',
        },
        { type: 'growth_decline', direction: 'negative', labelKo: '성장 둔화' },
        {
            type: 'operating_leverage',
            direction: 'neutral',
            labelKo: '영업 레버리지',
        },
    ],
    metrics: [
        { labelKo: '매출 성장률', value: 12.5, unit: 'pct' },
        { labelKo: '매출총이익 배수', value: 2.1, unit: 'ratio' },
        { labelKo: '영업현금흐름', value: 5_000_000_000, unit: 'usd' },
        { labelKo: '재무 점수', value: 85, unit: 'score' },
        { labelKo: '데이터 없는 지표', value: null, unit: 'pct' },
    ],
};

describe('AxisScoreCard', () => {
    it('renders the card title', () => {
        render(<AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />);
        expect(
            screen.getByRole('heading', { name: '성장성' })
        ).toBeInTheDocument();
    });

    it('renders the grade badge', () => {
        render(<AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />);
        expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('renders all signal chips with labelKo', () => {
        render(<AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />);
        expect(screen.getByText('매출 가속화')).toBeInTheDocument();
        expect(screen.getByText('성장 둔화')).toBeInTheDocument();
        expect(screen.getByText('영업 레버리지')).toBeInTheDocument();
    });

    it('renders metric labels and formatted values', () => {
        render(<AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />);
        expect(screen.getByText('매출 성장률')).toBeInTheDocument();
        expect(screen.getByText('매출총이익 배수')).toBeInTheDocument();
        expect(screen.getByText('영업현금흐름')).toBeInTheDocument();
        expect(screen.getByText('재무 점수')).toBeInTheDocument();
    });

    it('formats pct values with percent sign', () => {
        render(<AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />);
        expect(screen.getByText('12.5%')).toBeInTheDocument();
    });

    it('formats ratio values with x suffix', () => {
        render(<AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />);
        expect(screen.getByText('2.1x')).toBeInTheDocument();
    });

    it('formats score values as raw number', () => {
        render(<AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />);
        expect(screen.getByText('85')).toBeInTheDocument();
    });

    it('renders null metric value as em-dash', () => {
        render(<AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />);
        expect(screen.getByText('데이터 없는 지표')).toBeInTheDocument();
        // Should render em-dash for null value
        const dashElements = screen.getAllByText('—');
        expect(dashElements.length).toBeGreaterThan(0);
    });

    it('renders no signal chips when signals array is empty', () => {
        const emptySignalsAxis: AxisScore = {
            ...SAMPLE_AXIS,
            signals: [],
        };
        render(<AxisScoreCard title="수익성·질" axis={emptySignalsAxis} />);
        // None of the signal labels should be present
        expect(screen.queryByText('매출 가속화')).not.toBeInTheDocument();
        expect(screen.queryByText('성장 둔화')).not.toBeInTheDocument();
    });

    it('renders the axis score value', () => {
        render(<AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />);
        expect(screen.getByText('72')).toBeInTheDocument();
    });

    it('drives the progress bar width via the --axis-score-pct CSS variable', () => {
        const { container } = render(
            <AxisScoreCard title="성장성" axis={SAMPLE_AXIS} />
        );
        const track = container.querySelector<HTMLElement>(
            '[style*="--axis-score-pct"]'
        );
        expect(track).not.toBeNull();
        expect(track?.style.getPropertyValue('--axis-score-pct')).toBe('72%');
    });
});
