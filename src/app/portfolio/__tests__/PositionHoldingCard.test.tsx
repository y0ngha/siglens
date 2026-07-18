/**
 * `PositionHoldingCard` tests — per-holding cell of the `/portfolio` grid.
 * Covers the lazy-visibility gate (no bars fetch until the card scrolls into
 * view via IntersectionObserver), the happy-path building render once bars
 * resolve, and per-card degrade (fetch rejects / computePosition null) —
 * never throwing so the surrounding grid stays intact.
 */

vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn(),
}));

import { act, render, screen, waitFor } from '@testing-library/react';
import { getBarsAction } from '@/entities/bars/actions';
import { PositionHoldingCard } from '@/app/portfolio/PositionHoldingCard';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';
import type { PortfolioHoldingView } from '@/entities/portfolio';

const mockGetBarsAction = vi.mocked(getBarsAction);

// bars 2개 이상 + prev.close != 0 → buildTechnicalFacts가 null을 반환하지 않는다.
// low52w=85, high52w=110, lastClose=100 ([symbol]/position page test와 동일 fixture).
const BARS_DATA = {
    bars: [
        { time: 1, open: 90, high: 95, low: 85, close: 90, volume: 1 },
        { time: 2, open: 100, high: 110, low: 95, close: 100, volume: 1 },
    ],
    indicators: { rsi: [null, null], macd: [{ histogram: null }] },
};

const HOLDING_AAPL: Pick<
    PortfolioHoldingView,
    'symbol' | 'companyName' | 'fmpSymbol' | 'averagePrice'
> = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    averagePrice: '90',
};

let ioCallback: IntersectionObserverCallback | null = null;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver implements IntersectionObserver {
    root: Element | Document | null = null;
    rootMargin = '';
    scrollMargin = '';
    thresholds: readonly number[] = [];
    constructor(callback: IntersectionObserverCallback) {
        ioCallback = callback;
    }
    observe = mockObserve;
    disconnect = mockDisconnect;
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
}

function fireIntersecting(isIntersecting: boolean) {
    act(() => {
        ioCallback?.(
            [{ isIntersecting } as IntersectionObserverEntry],
            new MockIntersectionObserver(() => {})
        );
    });
}

describe('PositionHoldingCard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ioCallback = null;
        vi.stubGlobal(
            'IntersectionObserver',
            MockIntersectionObserver as unknown as typeof IntersectionObserver
        );
    });

    it('does not fetch bars until the card scrolls into view (observer-gated)', async () => {
        mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
        const { wrapper } = createQueryClientWrapper();

        render(<PositionHoldingCard holding={HOLDING_AAPL} />, { wrapper });

        await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));
        expect(mockGetBarsAction).not.toHaveBeenCalled();
        expect(screen.getByTestId('holding-card-loading')).toBeInTheDocument();
    });

    it('fetches this symbol only and renders the building once visible', async () => {
        mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
        const { wrapper } = createQueryClientWrapper();

        render(<PositionHoldingCard holding={HOLDING_AAPL} />, { wrapper });
        await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));

        fireIntersecting(true);

        await waitFor(() =>
            expect(screen.getByTestId('position-building')).toBeInTheDocument()
        );
        expect(mockGetBarsAction).toHaveBeenCalledWith('AAPL', '1Day', 'AAPL');
        expect(mockGetBarsAction).toHaveBeenCalledTimes(1);
        expect(
            screen.queryByTestId('holding-card-degraded')
        ).not.toBeInTheDocument();
        expect(screen.getByText('평단')).toBeInTheDocument();
        expect(screen.getByText('현재가')).toBeInTheDocument();
        expect(screen.getByText('수익률')).toBeInTheDocument();
    });

    it('degrades to a muted note (never throws) when the bars fetch rejects', async () => {
        mockGetBarsAction.mockRejectedValue(new Error('FMP down'));
        const { wrapper } = createQueryClientWrapper();

        render(<PositionHoldingCard holding={HOLDING_AAPL} />, { wrapper });
        await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));

        fireIntersecting(true);

        await waitFor(() =>
            expect(
                screen.getByTestId('holding-card-degraded')
            ).toBeInTheDocument()
        );
        expect(
            screen.getByText('범위 데이터를 불러오지 못했어요')
        ).toBeInTheDocument();
        expect(screen.getByText('평단 $90')).toBeInTheDocument();
        expect(
            screen.queryByTestId('position-building')
        ).not.toBeInTheDocument();
    });

    it('formats a sub-$1 average price without misleading "$0" truncation in the degrade note', async () => {
        mockGetBarsAction.mockRejectedValue(new Error('FMP down'));
        const { wrapper } = createQueryClientWrapper();

        render(
            <PositionHoldingCard
                holding={{
                    ...HOLDING_AAPL,
                    symbol: 'SHIB',
                    averagePrice: '0.0006',
                }}
            />,
            { wrapper }
        );
        await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));

        fireIntersecting(true);

        await waitFor(() =>
            expect(
                screen.getByTestId('holding-card-degraded')
            ).toBeInTheDocument()
        );
        expect(screen.getByText(/평단 \$0\.0006/)).toBeInTheDocument();
    });

    it('degrades to a muted note when computePosition cannot resolve (e.g. invalid avg price)', async () => {
        mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
        const { wrapper } = createQueryClientWrapper();

        render(
            <PositionHoldingCard
                holding={{ ...HOLDING_AAPL, averagePrice: '0' }}
            />,
            { wrapper }
        );
        await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));

        fireIntersecting(true);

        await waitFor(() =>
            expect(
                screen.getByTestId('holding-card-degraded')
            ).toBeInTheDocument()
        );
        expect(screen.getByText('데이터 부족')).toBeInTheDocument();
        expect(
            screen.queryByTestId('position-building')
        ).not.toBeInTheDocument();
    });
});
