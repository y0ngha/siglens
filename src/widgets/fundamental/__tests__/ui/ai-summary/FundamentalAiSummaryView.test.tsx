import { render, screen, within } from '@testing-library/react';
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
import { FundamentalAiSummaryView } from '@/widgets/fundamental/ui/ai-summary/FundamentalAiSummaryView';

const BASE: FundamentalAnalysisResponse = {
    overallSentiment: 'bullish',
    overallConclusionKo: '강세 전망입니다',
    categoryAssessments: [],
    riskFactorsKo: [],
};

function sameKeyWarnings(spy: { mock: { calls: unknown[][] } }) {
    return spy.mock.calls.filter(args =>
        args.some(arg => String(arg).includes('same key'))
    );
}

describe('FundamentalAiSummaryView — 중복 항목 키', () => {
    it('같은 리스크 문장이 반복돼도 모두 그리고 키 경고가 없다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        render(
            <FundamentalAiSummaryView
                result={{
                    ...BASE,
                    riskFactorsKo: ['경쟁 심화', '경쟁 심화', '환율 변동'],
                }}
            />
        );

        expect(screen.getAllByText('경쟁 심화')).toHaveLength(2);
        expect(screen.getByText('환율 변동')).toBeInTheDocument();
        expect(sameKeyWarnings(errorSpy)).toHaveLength(0);
        errorSpy.mockRestore();
    });

    it('같은 카테고리 평가가 반복돼도 모두 그리고 키 경고가 없다', () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        render(
            <FundamentalAiSummaryView
                result={{
                    ...BASE,
                    categoryAssessments: [
                        {
                            category: 'valuation',
                            sentiment: 'bullish',
                            rationaleKo: '첫 번째 근거',
                        },
                        {
                            category: 'valuation',
                            sentiment: 'bearish',
                            rationaleKo: '두 번째 근거',
                        },
                    ],
                }}
            />
        );

        const list = screen.getByRole('list', { name: '카테고리별 평가' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByText('첫 번째 근거')).toBeInTheDocument();
        expect(screen.getByText('두 번째 근거')).toBeInTheDocument();
        expect(sameKeyWarnings(errorSpy)).toHaveLength(0);
        errorSpy.mockRestore();
    });
});
