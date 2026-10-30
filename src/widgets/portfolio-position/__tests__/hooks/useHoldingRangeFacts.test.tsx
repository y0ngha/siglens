// @vitest-environment jsdom
vi.mock('@/entities/bars/actions/getBarsAction', () => ({
    getBarsAction: vi.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { getBarsAction } from '@/entities/bars/actions/getBarsAction';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';
import { useHoldingRangeFacts } from '@/widgets/portfolio-position/hooks/useHoldingRangeFacts';

const mockGetBarsAction = vi.mocked(getBarsAction);

// low52w=85, high52w=110, lastClose=100 (PositionHoldingCard.test.tsx와 같은 fixture).
const BARS_DATA = {
    bars: [
        { time: 1, open: 90, high: 95, low: 85, close: 90, volume: 1 },
        { time: 2, open: 100, high: 110, low: 95, close: 100, volume: 1 },
    ],
    indicators: { rsi: [null, null], macd: [{ histogram: null }] },
};

describe('useHoldingRangeFacts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('enabled=false', () => {
        it('봉을 받지 않고 facts는 null이다', () => {
            mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
            const { wrapper } = createQueryClientWrapper();

            const { result } = renderHook(
                () => useHoldingRangeFacts('AAPL', 'AAPL', false),
                { wrapper }
            );

            expect(mockGetBarsAction).not.toHaveBeenCalled();
            expect(result.current.facts).toBeNull();
            expect(result.current.isError).toBe(false);
        });
    });

    describe('enabled=true', () => {
        it('봉을 {low52w, high52w, lastClose}로 매핑한다', async () => {
            mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
            const { wrapper } = createQueryClientWrapper();

            const { result } = renderHook(
                () => useHoldingRangeFacts('AAPL', 'FMP_AAPL', true),
                { wrapper }
            );

            await waitFor(() => expect(result.current.facts).not.toBeNull());
            expect(result.current.facts).toEqual({
                low52w: 85,
                high52w: 110,
                lastClose: 100,
            });
            expect(result.current.isLoading).toBe(false);
            expect(mockGetBarsAction).toHaveBeenCalledWith(
                'AAPL',
                '1Day',
                'FMP_AAPL'
            );
        });

        it('봉이 없으면 facts는 null이다', async () => {
            mockGetBarsAction.mockResolvedValue({
                bars: [],
                indicators: { rsi: [], macd: [] },
            } as never);
            const { wrapper } = createQueryClientWrapper();

            const { result } = renderHook(
                () => useHoldingRangeFacts('AAPL', undefined, true),
                { wrapper }
            );

            await waitFor(() => expect(mockGetBarsAction).toHaveBeenCalled());
            await waitFor(() => expect(result.current.isLoading).toBe(false));
            expect(result.current.facts).toBeNull();
        });

        it('요청이 실패하면 isError이고 facts는 null이다', async () => {
            mockGetBarsAction.mockRejectedValue(new Error('FMP down'));
            const { wrapper } = createQueryClientWrapper();

            const { result } = renderHook(
                () => useHoldingRangeFacts('AAPL', 'AAPL', true),
                { wrapper }
            );

            await waitFor(() => expect(result.current.isError).toBe(true));
            expect(result.current.facts).toBeNull();
        });
    });
});
