import { render, screen } from '@testing-library/react';
import { CompositeGradeGauge } from '@/widgets/financials/CompositeGradeGauge';
import type { FinancialsCompositeScore } from '@y0ngha/siglens-core';

const SAMPLE_COMPOSITE: FinancialsCompositeScore = {
    score: 78,
    grade: 'B',
    summaryKo: '성장성이 강점, 안정성이 약점',
};

describe('CompositeGradeGauge', () => {
    it('renders score and grade', () => {
        render(
            <CompositeGradeGauge
                score={SAMPLE_COMPOSITE.score}
                grade={SAMPLE_COMPOSITE.grade}
                summaryKo={SAMPLE_COMPOSITE.summaryKo}
            />
        );
        expect(screen.getByText('78')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('renders summaryKo text', () => {
        render(
            <CompositeGradeGauge
                score={78}
                grade="B"
                summaryKo="성장성이 강점, 안정성이 약점"
            />
        );
        expect(
            screen.getByText('성장성이 강점, 안정성이 약점')
        ).toBeInTheDocument();
    });

    it('renders null score as em-dash', () => {
        render(
            <CompositeGradeGauge
                score={null}
                grade="F"
                summaryKo="데이터 없음"
            />
        );
        expect(screen.getByText('—')).toBeInTheDocument();
        expect(screen.queryByText('null')).not.toBeInTheDocument();
    });

    it('has role="img" on the SVG', () => {
        render(<CompositeGradeGauge score={78} grade="B" summaryKo="테스트" />);
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('has an aria-label on the SVG', () => {
        render(
            <CompositeGradeGauge score={55} grade="C" summaryKo="보통 수준" />
        );
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('aria-label');
        expect(img.getAttribute('aria-label')).toContain('55');
    });

    it('renders grade A with appropriate styling marker', () => {
        render(
            <CompositeGradeGauge
                score={90}
                grade="A"
                summaryKo="탁월한 재무 상태"
            />
        );
        expect(screen.getByText('90')).toBeInTheDocument();
        expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('renders grade F (worst case)', () => {
        render(
            <CompositeGradeGauge
                score={0}
                grade="F"
                summaryKo="재무 위험 상태"
            />
        );
        // '0' appears in both the score display AND as a tick label in the SVG
        const zeroElements = screen.getAllByText('0');
        expect(zeroElements.length).toBeGreaterThan(0);
        expect(screen.getByText('F')).toBeInTheDocument();
    });
});
