import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedPage } from '@/widgets/fear-greed/FearGreedPage';
import { FearGreedPageError } from '@/widgets/fear-greed/FearGreedPageError';

const { mockAction } = vi.hoisted(() => ({ mockAction: vi.fn() }));
vi.mock('@/entities/bars/actions/getSymbolFearGreedAction', () => ({
    getSymbolFearGreedAction: mockAction,
}));
vi.mock('@/widgets/fear-greed/FearGreedHistoricalChart', () => ({
    FearGreedHistoricalChart: () => null,
}));

const SNAPSHOT: FearGreedSnapshot = {
    score: 61,
    label: 'GREED',
    groups: [
        { name: 'Flow', score: 58, factors: [] },
        { name: 'Trend', score: 64, factors: [] },
    ],
    confidence: 'normal',
    sampleSize: 200,
    warning: null,
};

/**
 * 조회가 실패해 에러 경계가 안내를 그리는 상황에서 "다시 시도"를 누르는 흐름.
 * 경계만 리셋하면 `useSuspenseQuery`가 캐시에 남은 같은 에러를 다시 던지므로
 * 재조회가 실제로 나가야 내용이 돌아온다.
 */
describe('FearGreedPage 조회 실패 후 다시 시도', () => {
    beforeEach(() => {
        // React가 경계에서 잡은 에러를 console.error로 찍는다 — 테스트 출력만 조용히 한다.
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        mockAction.mockReset();
    });

    function renderWithBoundary() {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        return render(
            <QueryClientProvider client={client}>
                <ErrorBoundary FallbackComponent={FearGreedPageError}>
                    <FearGreedPage symbol="AAPL" hasSeed={false} />
                </ErrorBoundary>
            </QueryClientProvider>
        );
    }

    it('첫 조회가 실패하면 오류 안내를 보이고 조회는 한 번 나간다', async () => {
        mockAction.mockRejectedValue(new Error('boom'));
        renderWithBoundary();

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('다시 시도를 누르면 재조회가 나가고 성공하면 내용이 그려진다', async () => {
        mockAction
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ snapshot: SNAPSHOT, history: [] });
        renderWithBoundary();
        await screen.findByRole('alert');

        await userEvent
            .setup()
            .click(screen.getByRole('button', { name: '다시 시도' }));

        await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(2));
        expect(await screen.findByText('수급 그룹')).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
