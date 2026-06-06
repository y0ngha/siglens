import { render, screen } from '@testing-library/react';
import type { Bar } from '@y0ngha/siglens-core';
import { StockChart } from '@/widgets/chart/StockChart';

const { mockCreateChart, mockAddSeries, mockSetData, mockFitContent } =
    vi.hoisted(() => {
        const mockSetData = vi.fn();
        const mockFitContent = vi.fn();
        const mockAddSeries = vi.fn(() => ({
            setData: mockSetData,
            applyOptions: vi.fn(),
            setMarkers: vi.fn(),
        }));
        const mockCreateChart = vi.fn(() => ({
            addSeries: mockAddSeries,
            addCandlestickSeries: vi.fn(() => ({
                setData: mockSetData,
                applyOptions: vi.fn(),
            })),
            addLineSeries: vi.fn(() => ({
                setData: vi.fn(),
                applyOptions: vi.fn(),
            })),
            addHistogramSeries: vi.fn(() => ({
                setData: vi.fn(),
                applyOptions: vi.fn(),
            })),
            applyOptions: vi.fn(),
            resize: vi.fn(),
            remove: vi.fn(),
            removeSeries: vi.fn(),
            timeScale: vi.fn(() => ({
                fitContent: mockFitContent,
                scrollToRealTime: vi.fn(),
            })),
            subscribeCrosshairMove: vi.fn(),
            priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
        }));
        return { mockCreateChart, mockAddSeries, mockSetData, mockFitContent };
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
        background: '#1a1a2e',
        text: '#a0a0b0',
        grid: '#2a2a3e',
        bullish: '#26a69a',
        bearish: '#ef5350',
        bollingerUpper: '#aaaaff',
        bollingerMiddle: '#8888cc',
        bollingerLower: '#6666aa',
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
    useMAOverlay: () => ({
        visiblePeriods: [],
        togglePeriod: vi.fn(),
    }),
}));

vi.mock('@/widgets/chart/hooks/useEMAOverlay', () => ({
    useEMAOverlay: () => ({
        visiblePeriods: [],
        togglePeriod: vi.fn(),
    }),
}));

vi.mock('@/widgets/chart/hooks/useBollingerOverlay', () => ({
    useBollingerOverlay: () => ({
        isVisible: false,
        toggle: vi.fn(),
    }),
}));

vi.mock('@/widgets/chart/hooks/useMACDChart', () => ({
    useMACDChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useRSIChart', () => ({
    useRSIChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useDMIChart', () => ({
    useDMIChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useStochasticChart', () => ({
    useStochasticChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useStochRSIChart', () => ({
    useStochRSIChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useCCIChart', () => ({
    useCCIChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useMfiChart', () => ({
    useMfiChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useWilliamsRChart', () => ({
    useWilliamsRChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useConnorsRsiChart', () => ({
    useConnorsRsiChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useCmfChart', () => ({
    useCmfChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useBollingerPercentBChart', () => ({
    useBollingerPercentBChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useHurstChart', () => ({
    useHurstChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useVarianceRatioChart', () => ({
    useVarianceRatioChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useVolumeProfileOverlay', () => ({
    useVolumeProfileOverlay: () => ({
        isVisible: false,
        toggle: vi.fn(),
    }),
}));

vi.mock('@/widgets/chart/hooks/useIchimokuOverlay', () => ({
    useIchimokuOverlay: () => ({
        isVisible: false,
        toggle: vi.fn(),
    }),
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
    IndicatorSettingsModal: ({
        bindings,
    }: {
        bindings: { meta: { key: string } }[];
    }) => (
        <div
            data-testid="indicator-settings-modal"
            data-count={bindings.length}
            data-keys={bindings.map(b => b.meta.key).join(',')}
        />
    ),
}));

vi.mock('@/widgets/chart/utils/paneLabelUtils', () => ({
    buildPaneLabels: () => [],
}));

vi.mock('@/widgets/chart/utils/overlayLabelUtils', () => ({
    buildOverlayLabelConfigs: () => [],
}));

vi.mock('@y0ngha/siglens-core', () => ({
    EMPTY_INDICATOR_RESULT: {
        ma: {},
        ema: {},
        macd: [],
        bollinger: [],
        rsi: [],
        cci: [],
        dmi: [],
        stochastic: [],
        stochRsi: [],
        vwap: [],
        volumeProfile: { poc: 0, vah: 0, val: 0, profile: [] },
        ichimoku: [],
        atr: [],
        obv: [],
        parabolicSar: [],
        williamsR: [],
        supertrend: [],
        mfi: [],
        keltnerChannel: [],
        cmf: [],
        donchianChannel: [],
        squeezeMomentum: [],
        buySellVolume: [],
        smc: {
            orderBlocks: [],
            fairValueGaps: [],
            breakOfStructure: [],
            changeOfCharacter: [],
        },
    },
    MA_DEFAULT_PERIODS: [5, 10, 20, 50, 100, 200],
    EMA_DEFAULT_PERIODS: [9, 12, 21, 26, 50, 200],
}));

const mockBars: Bar[] = [
    { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 1000 },
    { time: 200, open: 12, high: 18, low: 11, close: 15, volume: 1200 },
    { time: 300, open: 15, high: 20, low: 14, close: 18, volume: 1100 },
];

describe('StockChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state message when bars is empty', () => {
        render(<StockChart bars={[]} timeframe="1Day" />);

        expect(screen.getByText('차트 데이터가 없습니다')).toBeInTheDocument();
    });

    it('creates a chart when bars are provided', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);

        expect(mockCreateChart).toHaveBeenCalledTimes(1);
    });

    it('adds a candlestick series', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);

        expect(mockAddSeries).toHaveBeenCalledWith(
            'CandlestickSeries',
            expect.objectContaining({
                upColor: '#26a69a',
                downColor: '#ef5350',
            })
        );
    });

    it('sets bar data on the candlestick series', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);

        expect(mockSetData).toHaveBeenCalled();
    });

    it('fits content on the time scale', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);

        expect(mockFitContent).toHaveBeenCalled();
    });

    it('renders chart container with role="img" and default aria-label', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            '가격 차트'
        );
    });

    it('renders chart with ticker-specific aria-label when ticker is provided', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" ticker="AAPL" />);

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            'AAPL 1Day 캔들 차트'
        );
    });

    it('uses generic aria-label when ticker is empty string', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" ticker="" />);

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            '가격 차트'
        );
    });

    it('renders IndicatorSettingsModal with 18 indicator bindings', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);
        const modal = screen.getByTestId('indicator-settings-modal');
        expect(modal).toHaveAttribute('data-count', '18');
        expect(modal).toHaveAttribute(
            'data-keys',
            'ma,ema,ichimoku,rsi,macd,dmi,stochastic,stochRsi,cci,bollinger,volumeProfile,mfi,williamsR,connorsRsi,cmf,bollingerPercentB,hurst,varianceRatio'
        );
    });

    it('removes chart on unmount', () => {
        const { unmount } = render(
            <StockChart bars={mockBars} timeframe="1Day" />
        );

        unmount();

        const chart = mockCreateChart.mock.results[0].value;
        expect(chart.remove).toHaveBeenCalled();
    });
});
