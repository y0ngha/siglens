import { render, screen } from '@testing-library/react';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { NewsAiSummaryView } from '@/widgets/news/ui/ai-summary/NewsAiSummaryView';
import { SENTIMENT_CLASS } from '@/shared/lib/sentimentDisplay';

const BASE: NewsAnalysisResponse = {
    overallSentiment: 'neutral',
    currentDriverKo: '관망 구간입니다.',
    keyEventsKo: [],
    upcomingEventsKo: [],
};

describe('NewsAiSummaryView', () => {
    describe('감성 배지', () => {
        it('색은 공유 테이블(중립 -300)을 그대로 쓴다', () => {
            render(<NewsAiSummaryView result={BASE} />);

            const badge = screen.getByText('중립');
            expect(badge).toHaveClass('text-secondary-300');
            expect(badge).not.toHaveClass('text-secondary-400');
            expect(badge.className).toContain(SENTIMENT_CLASS.neutral);
        });
    });

    describe('AI가 같은 사건 문장을 반복할 때', () => {
        it('핵심·예정 사건을 모두 렌더하고 중복 키 경고가 없다', () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            render(
                <NewsAiSummaryView
                    result={{
                        ...BASE,
                        keyEventsKo: ['실적 발표', '실적 발표'],
                        upcomingEventsKo: ['FOMC', 'FOMC'],
                    }}
                />
            );

            expect(screen.getAllByText('실적 발표')).toHaveLength(2);
            expect(screen.getAllByText('FOMC')).toHaveLength(2);
            expect(
                errorSpy.mock.calls.filter(call =>
                    String(call[0]).includes('same key')
                )
            ).toHaveLength(0);
            errorSpy.mockRestore();
        });
    });
});
