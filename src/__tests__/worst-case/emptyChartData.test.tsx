import { INACTIVE_PANE_INDEX } from '@/widgets/chart/constants';

const { mockCreateChart } = vi.hoisted(() => {
    const mockCreateChart = vi.fn(() => ({
        addSeries: vi.fn(() => ({
            setData: vi.fn(),
            applyOptions: vi.fn(),
            setMarkers: vi.fn(),
        })),
        applyOptions: vi.fn(),
        resize: vi.fn(),
        remove: vi.fn(),
        removeSeries: vi.fn(),
        timeScale: vi.fn(() => ({
            fitContent: vi.fn(),
            scrollToRealTime: vi.fn(),
        })),
        subscribeCrosshairMove: vi.fn(),
        priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
    }));
    return { mockCreateChart };
});

vi.mock('lightweight-charts', () => ({
    createChart: mockCreateChart,
    CandlestickSeries: 'CandlestickSeries',
    LineSeries: 'LineSeries',
    HistogramSeries: 'HistogramSeries',
    CrosshairMode: { Normal: 0, Magnet: 1 },
    ColorType: { Solid: 'solid' },
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
    PriceScaleMode: { Normal: 0, Logarithmic: 1 },
}));

vi.mock('@/shared/lib/chartColors', () => ({
    CHART_COLORS: {
        background: '#131722',
        text: '#d1d4dc',
        grid: '#1e222d',
        bullish: '#26a69a',
        bearish: '#ef5350',
    },
    getPeriodColor: (period: number) => `#color-${period}`,
}));

vi.mock('@/shared/lib/timeFormat', () => ({
    getTimeFormatter: () => (time: number) => String(time),
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/widgets/chart/hooks/useMAOverlay', () => ({
    useMAOverlay: () => ({ visiblePeriods: [], togglePeriod: vi.fn() }),
}));
vi.mock('@/widgets/chart/hooks/useEMAOverlay', () => ({
    useEMAOverlay: () => ({ visiblePeriods: [], togglePeriod: vi.fn() }),
}));
vi.mock('@/widgets/chart/hooks/useBollingerOverlay', () => ({
    useBollingerOverlay: () => ({ isVisible: false, toggle: vi.fn() }),
}));
vi.mock('@/widgets/chart/hooks/useMACDChart', () => ({
    useMACDChart: vi.fn(),
}));
vi.mock('@/widgets/chart/hooks/useRSIChart', () => ({ useRSIChart: vi.fn() }));
vi.mock('@/widgets/chart/hooks/useDMIChart', () => ({ useDMIChart: vi.fn() }));
vi.mock('@/widgets/chart/hooks/useStochasticChart', () => ({
    useStochasticChart: vi.fn(),
}));
vi.mock('@/widgets/chart/hooks/useStochRSIChart', () => ({
    useStochRSIChart: vi.fn(),
}));
vi.mock('@/widgets/chart/hooks/useCCIChart', () => ({ useCCIChart: vi.fn() }));
vi.mock('@/widgets/chart/hooks/useVolumeProfileOverlay', () => ({
    useVolumeProfileOverlay: () => ({ isVisible: false, toggle: vi.fn() }),
}));
vi.mock('@/widgets/chart/hooks/useIchimokuOverlay', () => ({
    useIchimokuOverlay: () => ({ isVisible: false, toggle: vi.fn() }),
}));
vi.mock('@/widgets/chart/hooks/useCandlePatternMarkers', () => ({
    useCandlePatternMarkers: vi.fn(),
}));
vi.mock('@/widgets/chart/hooks/useActionRecommendationOverlay', () => ({
    useActionRecommendationOverlay: vi.fn(),
}));
vi.mock('@/widgets/chart/hooks/usePaneLabels', () => ({
    usePaneLabels: vi.fn(),
}));
vi.mock('@/widgets/chart/hooks/useOverlayLegend', () => ({
    useOverlayLegend: () => [],
}));
vi.mock('@/widgets/chart/hooks/useIndicatorVisibility', () => ({
    useIndicatorVisibility: () => ({
        rsiVisible: false,
        macdVisible: false,
        dmiVisible: false,
        stochasticVisible: false,
        stochRsiVisible: false,
        cciVisible: false,
        toggleRSI: vi.fn(),
        toggleMACD: vi.fn(),
        toggleDMI: vi.fn(),
        toggleStochastic: vi.fn(),
        toggleStochRSI: vi.fn(),
        toggleCCI: vi.fn(),
        paneIndices: {
            rsi: INACTIVE_PANE_INDEX,
            macd: INACTIVE_PANE_INDEX,
            dmi: INACTIVE_PANE_INDEX,
            stochastic: INACTIVE_PANE_INDEX,
            stochRsi: INACTIVE_PANE_INDEX,
            cci: INACTIVE_PANE_INDEX,
        },
    }),
}));
vi.mock('@/widgets/chart/ui/IndicatorSettingsModal', () => ({
    IndicatorSettingsModal: () => null,
}));
vi.mock('@/widgets/chart/utils/paneLabelUtils', () => ({
    buildPaneLabels: () => [],
}));
vi.mock('@/widgets/chart/utils/overlayLabelUtils', () => ({
    buildOverlayLabelConfigs: () => [],
}));

vi.mock('@y0ngha/siglens-core', () => ({
    EMPTY_INDICATOR_RESULT: { ma: {}, ema: {} },
    MA_DEFAULT_PERIODS: [5, 10, 20, 50, 100, 200],
    EMA_DEFAULT_PERIODS: [9, 12, 21, 26, 50, 200],
}));

import { render, screen } from '@testing-library/react';
import { StockChart } from '@/widgets/chart/StockChart';

describe('StockChart with empty/zero data', () => {
    it('renders empty state message when bars array is empty', () => {
        render(<StockChart bars={[]} timeframe="1Day" />);
        expect(screen.getByText('차트 데이터가 없습니다')).toBeInTheDocument();
    });

    it('renders chart when bars have data', () => {
        const bars = [
            {
                time: 1700000000,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: 1000,
            },
        ];
        const { container } = render(
            <StockChart bars={bars} timeframe="1Day" />
        );
        expect(container.querySelector('[role="img"]')).toBeInTheDocument();
    });

    it('renders with all-zero OHLC bars without crashing', () => {
        const zeroBars = [
            { time: 1700000000, open: 0, high: 0, low: 0, close: 0, volume: 0 },
            { time: 1700086400, open: 0, high: 0, low: 0, close: 0, volume: 0 },
        ];
        const { container } = render(
            <StockChart bars={zeroBars} timeframe="1Day" />
        );
        expect(container.querySelector('[role="img"]')).toBeInTheDocument();
    });

    it('applies correct aria-label with ticker', () => {
        const bars = [
            {
                time: 1700000000,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: 1000,
            },
        ];
        render(<StockChart bars={bars} timeframe="1Day" ticker="AAPL" />);
        expect(
            screen.getByRole('img', { name: 'AAPL 1Day 캔들 차트' })
        ).toBeInTheDocument();
    });

    it('applies generic aria-label without ticker', () => {
        const bars = [
            {
                time: 1700000000,
                open: 100,
                high: 110,
                low: 90,
                close: 105,
                volume: 1000,
            },
        ];
        render(<StockChart bars={bars} timeframe="1Day" />);
        expect(
            screen.getByRole('img', { name: '가격 차트' })
        ).toBeInTheDocument();
    });
});
