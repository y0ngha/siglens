import { render, screen } from '@testing-library/react';
import type { FinancialsAnalysisResponse } from '@y0ngha/siglens-core';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';
import { FinancialsAiSummaryView } from '@/widgets/financials/ui/ai-summary/FinancialsAiSummaryView';

const RESULT: FinancialsAnalysisResponse = {
    overallSentiment: 'bullish',
    overallConclusionKo: '재무가 전반적으로 양호합니다',
    axisAssessments: [
        { axis: 'growth', sentiment: 'bullish', rationaleKo: '성장 근거' },
        { axis: 'solvency', sentiment: 'bearish', rationaleKo: '안정성 근거' },
    ],
    riskFactorsKo: ['부채 증가', '부채 증가'],
};

describe('FinancialsAiSummaryView', () => {
    it('결론과 전체 감성 배지를 그린다', () => {
        render(<FinancialsAiSummaryView result={RESULT} />);
        expect(
            screen.getByText('재무가 전반적으로 양호합니다')
        ).toBeInTheDocument();
        expect(screen.getAllByText('긍정').length).toBeGreaterThan(0);
    });

    it('축별 평가를 축 이름·감성·근거와 함께 그린다', () => {
        render(<FinancialsAiSummaryView result={RESULT} />);
        expect(screen.getByText('성장성')).toBeInTheDocument();
        expect(screen.getByText('안정성')).toBeInTheDocument();
        expect(screen.getByText('성장 근거')).toBeInTheDocument();
        expect(screen.getByText('부정')).toBeInTheDocument();
    });

    it('축 이름과 감성을 현재 로케일로 보여 준다', () => {
        render(withLocale(<FinancialsAiSummaryView result={RESULT} />, 'en'));
        expect(screen.queryByText('성장성')).not.toBeInTheDocument();
        expect(screen.getByText('Growth')).toBeInTheDocument();
    });

    it('중복된 위험 요인도 모두 그린다', () => {
        render(<FinancialsAiSummaryView result={RESULT} />);
        expect(screen.getAllByText('부채 증가')).toHaveLength(2);
    });

    it('평가와 위험 요인이 없으면 해당 목록을 그리지 않는다', () => {
        render(
            <FinancialsAiSummaryView
                result={{
                    ...RESULT,
                    axisAssessments: [],
                    riskFactorsKo: [],
                }}
            />
        );
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });
});
