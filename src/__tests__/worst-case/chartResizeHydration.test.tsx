const { mockCreateChart, mockResize } = vi.hoisted(() => {
    const mockResize = vi.fn();
    const mockCreateChart = vi.fn(() => ({
        addSeries: vi.fn(() => ({
            setData: vi.fn(),
            applyOptions: vi.fn(),
            setMarkers: vi.fn(),
        })),
        applyOptions: vi.fn(),
        resize: mockResize,
        remove: vi.fn(),
        removeSeries: vi.fn(),
        timeScale: vi.fn(() => ({
            fitContent: vi.fn(),
            scrollToRealTime: vi.fn(),
        })),
        subscribeCrosshairMove: vi.fn(),
        priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
    }));
    return { mockCreateChart, mockResize };
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
        visible: {
            ma: false,
            ema: false,
            ichimoku: false,
            rsi: false,
            macd: false,
            dmi: false,
            stochastic: false,
            stochRsi: false,
            cci: false,
            bollinger: false,
            volumeProfile: false,
            mfi: false,
            williamsR: false,
            connorsRsi: false,
            cmf: false,
            bollingerPercentB: false,
            hurst: false,
            varianceRatio: false,
        },
        toggle: vi.fn(),
        paneIndices: {
            ma: -1,
            ema: -1,
            ichimoku: -1,
            rsi: -1,
            macd: -1,
            dmi: -1,
            stochastic: -1,
            stochRsi: -1,
            cci: -1,
            bollinger: -1,
            volumeProfile: -1,
            mfi: -1,
            williamsR: -1,
            connorsRsi: -1,
            cmf: -1,
            bollingerPercentB: -1,
            hurst: -1,
            varianceRatio: -1,
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

import { render } from '@testing-library/react';
import { StockChart } from '@/widgets/chart/StockChart';

describe('StockChart resize hydration behavior', () => {
    const bars = [
        {
            time: 1700000000,
            open: 100,
            high: 110,
            low: 90,
            close: 105,
            volume: 1000,
        },
        {
            time: 1700086400,
            open: 105,
            high: 115,
            low: 95,
            close: 110,
            volume: 1200,
        },
    ];

    it('does not call resize on first mount (hydration guard)', () => {
        render(<StockChart bars={bars} timeframe="1Day" />);
        expect(mockResize).not.toHaveBeenCalled();
    });

    it('does not crash with empty bars on mount', () => {
        const { container } = render(<StockChart bars={[]} timeframe="1Day" />);
        expect(container.querySelector('p')).toHaveTextContent(
            '차트 데이터가 없습니다'
        );
    });
});
