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

    it('wraps the card in a link to the symbol position page, with a focus-visible ring (audit finding #8)', async () => {
        mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
        const { wrapper } = createQueryClientWrapper();

        const { container } = render(
            <PositionHoldingCard holding={HOLDING_AAPL} />,
            { wrapper }
        );

        const link = container.querySelector('a');
        expect(link).not.toBeNull();
        expect(link?.getAttribute('href')).toBe('/AAPL/position');
        expect(link?.className).toContain('focus-visible:ring');
        // The card's own testid stays on the inner element (visual chrome +
        // the IntersectionObserver target), nested inside the link.
        expect(
            link?.querySelector('[data-testid="portfolio-holding-card"]')
        ).not.toBeNull();
    });

    it('gives the loading skeleton a min-h close to the resolved card height, to avoid a scroll-jumping CLS on lazy-resolve (audit finding #9)', async () => {
        mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
        const { wrapper } = createQueryClientWrapper();

        render(<PositionHoldingCard holding={HOLDING_AAPL} />, { wrapper });
        await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));

        const skeleton = screen.getByTestId('holding-card-loading');
        expect(skeleton.className).not.toContain('h-40');
        expect(skeleton.className).toMatch(/min-h-\[\d+px\]/);
    });

    it('gives the degraded note a min-h close to the resolved card height (audit finding #9)', async () => {
        mockGetBarsAction.mockRejectedValue(new Error('FMP down'));
        const { wrapper } = createQueryClientWrapper();

        render(<PositionHoldingCard holding={HOLDING_AAPL} />, { wrapper });
        await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));
        fireIntersecting(true);

        const degraded = await screen.findByTestId('holding-card-degraded');
        expect(degraded.className).not.toContain('h-40');
        expect(degraded.className).toMatch(/min-h-\[\d+px\]/);
    });

    it('fetches immediately (no observer wait) when IntersectionObserver is unavailable — legacy-browser degrade branch', async () => {
        vi.stubGlobal('IntersectionObserver', undefined);
        mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
        const { wrapper } = createQueryClientWrapper();

        render(<PositionHoldingCard holding={HOLDING_AAPL} />, { wrapper });

        await waitFor(() =>
            expect(screen.getByTestId('position-building')).toBeInTheDocument()
        );
        expect(mockObserve).not.toHaveBeenCalled();
        expect(mockGetBarsAction).toHaveBeenCalledWith('AAPL', '1Day', 'AAPL');
    });

    it('passes fmpSymbol=undefined to getBarsAction when the holding has no fmpSymbol (null)', async () => {
        mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
        const { wrapper } = createQueryClientWrapper();

        render(
            <PositionHoldingCard
                holding={{ ...HOLDING_AAPL, fmpSymbol: null }}
            />,
            { wrapper }
        );
        await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));
        fireIntersecting(true);

        await waitFor(() => expect(mockGetBarsAction).toHaveBeenCalled());
        expect(mockGetBarsAction).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            undefined
        );
    });

    it('colors the resolved dl readout return% as loss (ui-danger-text) when returnPct < 0', async () => {
        mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
        const { wrapper } = createQueryClientWrapper();

        // low52w=85 high52w=110 lastClose=100 (BARS_DATA) — avg=120 > lastClose → loss.
        render(
            <PositionHoldingCard
                holding={{ ...HOLDING_AAPL, averagePrice: '120' }}
            />,
            { wrapper }
        );
        await waitFor(() => expect(mockObserve).toHaveBeenCalledTimes(1));
        fireIntersecting(true);

        await waitFor(() =>
            expect(screen.getByTestId('position-building')).toBeInTheDocument()
        );
        const returnValue = screen.getByText('-16.7%');
        expect(returnValue.className).toContain('text-ui-danger-text');
        expect(returnValue.className).not.toContain('text-ui-success-text');
    });

    it('formats a sub-$1 average price without misleading "$0" truncation in the resolved dl readout (not just the degraded note)', async () => {
        mockGetBarsAction.mockResolvedValue(BARS_DATA as never);
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
            expect(screen.getByTestId('position-building')).toBeInTheDocument()
        );
        // 같은 값이 in-SVG 라벨(building)에도 렌더돼 매치가 여러 개일 수 있어(위젯이
        // 아니라 dl 리드아웃 자체를 검증하는 게 목적) dl의 <dd> 값으로 범위를 좁힌다.
        const readoutValue = screen.getByText('평단').nextElementSibling;
        expect(readoutValue?.textContent).toMatch(/^\$0\.0006/);
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
