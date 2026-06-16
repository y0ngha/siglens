/**
 * Component rendering tests for MarketNewsDigest.
 *
 * Mocks `useMarketNewsDigest` directly so we can drive loading / done / error
 * states without touching the real hook or server actions.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MockedFunction } from 'vitest';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { useMarketNewsDigest } from '@/widgets/market-news/hooks/useMarketNewsDigest';
import { MarketNewsDigest } from '@/widgets/market-news/MarketNewsDigest';
import { SENTIMENT_CLASS } from '@/widgets/market-news/utils/sentimentConstants';

vi.mock('@/widgets/market-news/hooks/useMarketNewsDigest', () => ({
    useMarketNewsDigest: vi.fn(),
}));

const mockUseMarketNewsDigest = useMarketNewsDigest as MockedFunction<
    typeof useMarketNewsDigest
>;

const DONE_RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish',
    currentDriverKo: '연준의 금리 동결 결정이 시장 심리를 지지하고 있습니다.',
    keyEventsKo: ['FOMC 회의 금리 동결 결정'],
    upcomingEventsKo: ['4분기 실적 시즌 본격 개막'],
};

describe('MarketNewsDigest', () => {
    beforeEach(() => {
        mockUseMarketNewsDigest.mockReset();
    });

    it('status: loading → role=status spinner + "AI 다이제스트 생성 중" copy + aria-live polite', () => {
        mockUseMarketNewsDigest.mockReturnValue({ status: 'loading' });

        render(<MarketNewsDigest category="general" hasEnrichedNews={true} />);

        // The spinner container has role="status".
        expect(screen.getByRole('status')).toBeInTheDocument();

        // The descriptive copy is visible.
        expect(
            screen.getByText(/AI 다이제스트 생성 중이에요/)
        ).toBeInTheDocument();

        // aria-live="polite" on the status div.
        const statusEl = screen.getByRole('status');
        expect(statusEl).toHaveAttribute('aria-live', 'polite');
    });

    it('status: done → renders currentDriverKo, keyEventsKo[0], upcomingEventsKo[0], sentiment badge', () => {
        mockUseMarketNewsDigest.mockReturnValue({
            status: 'done',
            result: DONE_RESULT,
        });

        render(<MarketNewsDigest category="general" hasEnrichedNews={true} />);

        // currentDriverKo paragraph.
        expect(
            screen.getByText(DONE_RESULT.currentDriverKo)
        ).toBeInTheDocument();

        // keyEventsKo first bullet.
        expect(
            screen.getByText(DONE_RESULT.keyEventsKo[0])
        ).toBeInTheDocument();

        // upcomingEventsKo first bullet.
        expect(
            screen.getByText(DONE_RESULT.upcomingEventsKo[0])
        ).toBeInTheDocument();

        // Sentiment badge: 'bullish' maps to SENTIMENT_LABEL['bullish'] = '긍정'.
        const badge = screen.getByText('긍정');
        expect(badge).toBeInTheDocument();
        // Must carry the bullish CSS class from SENTIMENT_CLASS.
        const expectedClass = SENTIMENT_CLASS['bullish'].split(' ')[0];
        expect(badge.className).toContain(expectedClass);
    });

    it('status: error → role=alert + "다시 시도" button calls retry()', async () => {
        const retrySpy = vi.fn();
        mockUseMarketNewsDigest.mockReturnValue({
            status: 'error',
            error: new Error('뉴스 다이제스트를 가져오지 못했어요.'),
            retry: retrySpy,
        });

        const user = userEvent.setup();

        render(<MarketNewsDigest category="general" hasEnrichedNews={false} />);

        // The error message has role="alert".
        expect(screen.getByRole('alert')).toBeInTheDocument();

        // "다시 시도" button is present.
        const retryButton = screen.getByRole('button', { name: '다시 시도' });
        expect(retryButton).toBeInTheDocument();

        await user.click(retryButton);
        expect(retrySpy).toHaveBeenCalledTimes(1);
    });
});
