// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useThemeVersion } from '@/shared/hooks/useThemeVersion';
import { THEME_CHANGE_EVENT } from '@/shared/lib/theme';
import type { Bar, ChartOverlay } from '@y0ngha/siglens-core';
import { StockChart } from '@/widgets/chart/StockChart';
import {
    INACTIVE_PANE_INDEX,
    TRANSPARENT_COLOR,
} from '@/widgets/chart/constants';
import type { OverlayMenuItem } from '@/widgets/chart/utils/overlayItems';
import { useChartOverlays } from '@/widgets/chart/hooks/useChartOverlays';
import { useLinePaneChart } from '@/widgets/chart/hooks/useLinePaneChart';
import { LINE_PANE_SPECS } from '@/widgets/chart/model/linePaneSpecs';

const INACTIVE_PANES = Object.fromEntries(
    [
        'ma',
        'ema',
        'ichimoku',
        'rsi',
        'macd',
        'dmi',
        'stochastic',
        'stochRsi',
        'cci',
        'bollinger',
        'volumeProfile',
        'mfi',
        'williamsR',
        'connorsRsi',
        'cmf',
        'bollingerPercentB',
        'hurst',
        'varianceRatio',
        'macdV',
        'forceIndex',
        'obv',
        'atr',
        'yangZhang',
        'ewmaVolatility',
        'elderRay',
        'squeezeMomentum',
        'regression',
        'elderImpulse',
        'smc',
    ].map(k => [k, INACTIVE_PANE_INDEX])
);

const {
    mockCreateChart,
    mockAddSeries,
    mockSetData,
    mockFitContent,
    setPaneLayout,
    paneSpies,
    mockToggle,
    mockUseIndicatorVisibility,
    mockAttachPrimitive,
    mockDetachPrimitive,
    mockUseIchimokuOverlay,
    mockSetVisibleLogicalRange,
    viewMock,
} = vi.hoisted(() => {
    const mockSetVisibleLogicalRange = vi.fn();
    /*
     * 시간축이 "보던 자리"를 어떻게 답하는지 테스트가 바꾼다. `phase`는 캔들 `setData` 전/후를 가른다 —
     * 데이터가 바뀌면 같은 시각이 다른 논리 인덱스를 가리키는 것을 흉내 낸다.
     */
    const viewMock = {
        phase: 'before' as 'before' | 'after',
        visibleRange: null as { from: number; to: number } | null,
        logicalRange: null as { from: number; to: number } | null,
        indexBefore: {} as Record<number, number>,
        indexAfter: {} as Record<number, number>,
    };
    const mockToggle = vi.fn();
    const mockAttachPrimitive = vi.fn();
    const mockDetachPrimitive = vi.fn();
    const mockUseIchimokuOverlay = vi.fn(() => ({
        isVisible: false,
        toggle: vi.fn(),
    }));
    const mockUseIndicatorVisibility = vi.fn();
    interface PaneSpec {
        stretch: number;
        height: number;
    }

    interface PaneMock {
        getHeight: () => number;
        getStretchFactor: () => number;
        setStretchFactor: ReturnType<typeof vi.fn>;
    }

    /*
     * pane 목록은 테스트가 갈아끼운다. `chart.panes()`는 훅 여러 개가 각자
     * 부르므로 **같은 객체**를 계속 돌려줘야 spy 호출이 한곳에 모인다.
     */
    let panes: PaneMock[] = [];

    const setPaneLayout = (specs: PaneSpec[]): void => {
        panes = specs.map(spec => ({
            getHeight: () => spec.height,
            getStretchFactor: () => spec.stretch,
            setStretchFactor: vi.fn(),
        }));
    };

    // 기본은 가격 pane 하나 — 보조지표가 전부 꺼진 상태다.
    setPaneLayout([{ stretch: 2, height: 200 }]);

    const paneSpies = { at: (index: number): PaneMock => panes[index] };

    const mockSetData = vi.fn();
    const mockFitContent = vi.fn();
    const mockAddSeries = vi.fn(() => ({
        setData: mockSetData,
        applyOptions: vi.fn(),
        setMarkers: vi.fn(),
        attachPrimitive: mockAttachPrimitive,
        detachPrimitive: mockDetachPrimitive,
        seriesType: () => 'Line',
        options: () => ({ color: '#c', crosshairMarkerBackgroundColor: '' }),
    }));
    /* 인자 타입을 적어 둔다 — 없으면 호출 시그니처가 `() => …`로 추론돼
       `mock.calls[0][1]`(옵션) 접근이 타입 에러가 난다. 옵션은 이 테스트가
       확인하는 `timeScale`만 좁게 선언한다. */
    const mockCreateChart = vi.fn(
        (
            _container?: unknown,
            _options?: { timeScale?: { visible: boolean } }
        ) => ({
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
                setVisibleLogicalRange: mockSetVisibleLogicalRange,
                getVisibleRange: () => viewMock.visibleRange,
                getVisibleLogicalRange: () => viewMock.logicalRange,
                timeToIndex: (time: number) =>
                    (viewMock.phase === 'before'
                        ? viewMock.indexBefore
                        : viewMock.indexAfter)[time] ?? null,
            })),
            subscribeCrosshairMove: vi.fn(),
            priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
            panes: vi.fn(() => panes),
        })
    );
    return {
        mockCreateChart,
        mockAddSeries,
        mockSetData,
        mockFitContent,
        setPaneLayout,
        paneSpies,
        mockToggle,
        mockUseIndicatorVisibility,
        mockAttachPrimitive,
        mockDetachPrimitive,
        mockUseIchimokuOverlay,
        mockSetVisibleLogicalRange,
        viewMock,
    };
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
        extendedBullish: '#ext-bull',
        extendedBearish: '#ext-bear',
        extendedSessionBand: '#ext-band',
        bollingerUpper: '#aaaaff',
        bollingerMiddle: '#8888cc',
        bollingerLower: '#6666aa',
        overlayPattern1: '#pal-1',
        overlayPattern2: '#pal-2',
        overlayPattern3: '#pal-3',
        overlayPattern4: '#pal-4',
        overlayPattern5: '#pal-5',
        overlayPattern6: '#pal-6',
    },
    getPeriodColor: (period: number) => `#color-${period}`,
    /* 차트 크롬을 런타임 테마에서 읽는 리졸버. 테스트는 다크 고정이면 충분하다. */
    getChartChrome: () => ({
        background: '#1a1a2e',
        grid: '#2a2a3e',
        text: '#a0a0b0',
    }),
}));

// jsdom에는 캔버스 2D 컨텍스트가 없다 — 기본 측정기가 getContext를 부르지 않게 막는다.
vi.mock('@/widgets/chart/utils/levelLabelGutter', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/widgets/chart/utils/levelLabelGutter')
    >()),
    createCanvasTextMeasurer: () => (text: string) => text.length * 7,
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

vi.mock('@/widgets/chart/hooks/useLinePaneChart', () => ({
    useLinePaneChart: vi.fn(),
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

vi.mock('@/widgets/chart/hooks/useElderRayChart', () => ({
    useElderRayChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useSqueezeMomentumChart', () => ({
    useSqueezeMomentumChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useRegressionChart', () => ({
    useRegressionChart: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useVolumeProfileOverlay', () => ({
    useVolumeProfileOverlay: () => ({
        isVisible: false,
        toggle: vi.fn(),
    }),
}));

vi.mock('@/widgets/chart/hooks/useIchimokuOverlay', () => ({
    useIchimokuOverlay: mockUseIchimokuOverlay,
}));

vi.mock('@/widgets/chart/hooks/useKeltnerOverlay', () => ({
    useKeltnerOverlay: () => ({
        isVisible: false,
        toggle: vi.fn(),
    }),
}));

vi.mock('@/widgets/chart/hooks/useDonchianOverlay', () => ({
    useDonchianOverlay: () => ({
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

vi.mock('@/widgets/chart/hooks/useSmcZones', () => ({
    useSmcZones: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useChartOverlays', () => ({
    useChartOverlays: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/usePaneLabels', () => ({
    usePaneLabels: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useOverlayLegend', () => ({
    useOverlayLegend: () => [],
}));

const DEFAULT_VISIBLE = {
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
    macdV: false,
    forceIndex: false,
    obv: false,
    atr: false,
    yangZhang: false,
    ewmaVolatility: false,
    elderRay: false,
    squeezeMomentum: false,
    regression: false,
    elderImpulse: false,
    smc: false,
};

vi.mock('@/widgets/chart/hooks/useIndicatorVisibility', () => ({
    useIndicatorVisibility: () => mockUseIndicatorVisibility(),
}));

vi.mock('@/widgets/chart/ui/IndicatorSettingsPopover', () => ({
    IndicatorSettingsPopover: ({
        bindings,
    }: {
        bindings: { meta: { key: string }; onToggle: () => void }[];
    }) => (
        <div
            data-testid="indicator-settings-modal"
            data-count={bindings.length}
            data-keys={bindings.map(b => b.meta.key).join(',')}
        >
            {bindings.map(b => (
                <button
                    key={b.meta.key}
                    type="button"
                    aria-label={`toggle-${b.meta.key}`}
                    data-testid={`toggle-${b.meta.key}`}
                    onClick={b.onToggle}
                />
            ))}
        </div>
    ),
}));

/*
 * 범례가 **실측 크기를 받는지**만 본다. 배치 계산 자체는
 * `overlayLegendLayout.test.ts`가 따로 검증하므로 여기서는 prop만 노출한다.
 */
vi.mock('@/widgets/chart/OverlayLegend', () => ({
    OverlayLegend: ({
        pricePaneHeightPx,
        chartWidthPx,
    }: {
        pricePaneHeightPx?: number;
        chartWidthPx?: number;
    }) => (
        <div
            data-testid="overlay-legend"
            data-price-pane-height={pricePaneHeightPx}
            data-chart-width={chartWidthPx}
        />
    ),
}));

vi.mock('@/widgets/chart/utils/paneLabelUtils', () => ({
    buildPaneLabels: () => [],
}));

vi.mock('@/widgets/chart/utils/overlayLabelUtils', () => ({
    buildOverlayLabelConfigs: () => [],
}));

// 차트 스펙 테이블(`linePaneSpecs`)이 로드 시점에 core 기준선 상수를 읽으므로
// 실제 모듈 위에 필요한 것만 덮는다.
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<typeof import('@y0ngha/siglens-core')>()),
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    getModelAccess: (m: string) =>
        m === 'claude-opus-5' || m === 'gpt-5.6-sol' ? 'byok' : 'free',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
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
        elderImpulse: [],
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

/**
 * jsdom에는 레이아웃이 없어 `clientWidth`가 늘 0이다. 범례 폭 계산이 실제로
 * 흐르는지 보려면 폭을 하나 심어야 한다. vitest의 mock 생명주기를 건드리지
 * 않도록 디스크립터를 직접 저장·복원한다.
 */
function stubClientWidth(px: number): () => void {
    const original = Object.getOwnPropertyDescriptor(
        Element.prototype,
        'clientWidth'
    );
    Object.defineProperty(Element.prototype, 'clientWidth', {
        configurable: true,
        get: () => px,
    });
    return () => {
        if (original !== undefined) {
            Object.defineProperty(Element.prototype, 'clientWidth', original);
        }
    };
}

/**
 * paneIndices 변경 후 명시 resize effect는 wrapper의 clientWidth/clientHeight가
 * 둘 다 0이 아니어야 실행된다 (jsdom 레이아웃 부재로 기본값은 0). 두 값을 함께 심는다.
 */
function stubClientSize(width: number, height: number): () => void {
    const originalWidth = Object.getOwnPropertyDescriptor(
        Element.prototype,
        'clientWidth'
    );
    const originalHeight = Object.getOwnPropertyDescriptor(
        Element.prototype,
        'clientHeight'
    );
    Object.defineProperty(Element.prototype, 'clientWidth', {
        configurable: true,
        get: () => width,
    });
    Object.defineProperty(Element.prototype, 'clientHeight', {
        configurable: true,
        get: () => height,
    });
    return () => {
        if (originalWidth !== undefined) {
            Object.defineProperty(
                Element.prototype,
                'clientWidth',
                originalWidth
            );
        }
        if (originalHeight !== undefined) {
            Object.defineProperty(
                Element.prototype,
                'clientHeight',
                originalHeight
            );
        }
    };
}

async function flushFrame(): Promise<void> {
    await act(
        async () =>
            new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    );
}

describe('StockChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        viewMock.phase = 'before';
        viewMock.visibleRange = null;
        viewMock.logicalRange = null;
        viewMock.indexBefore = {};
        viewMock.indexAfter = {};
        // 캔들 데이터가 바뀐 뒤에는 시각→인덱스 답이 달라진다.
        mockSetData.mockImplementation(() => {
            viewMock.phase = 'after';
        });
        setPaneLayout([{ stretch: 2, height: 200 }]);
        mockUseIndicatorVisibility.mockReturnValue({
            visible: DEFAULT_VISIBLE,
            toggle: mockToggle,
            paneIndices: INACTIVE_PANES,
        });
    });

    it('renders empty state message when bars is empty', () => {
        render(<StockChart bars={[]} timeframe="1Day" />);

        expect(screen.getByText('차트 데이터가 없습니다')).toBeInTheDocument();
    });

    it('단일 선 패인 지표마다 자기 스펙·가시성·패인 인덱스로 useLinePaneChart를 부른다', () => {
        // 키마다 다른 값을 줘야 두 지표의 배선이 뒤바뀐 것도 잡힌다.
        const keys = Object.keys(LINE_PANE_SPECS) as Array<
            keyof typeof LINE_PANE_SPECS
        >;
        mockUseIndicatorVisibility.mockReturnValue({
            visible: {
                ...DEFAULT_VISIBLE,
                ...Object.fromEntries(keys.map((k, i) => [k, i % 2 === 0])),
            },
            toggle: mockToggle,
            paneIndices: {
                ...INACTIVE_PANES,
                ...Object.fromEntries(keys.map((k, i) => [k, i + 1])),
            },
        });
        render(<StockChart bars={mockBars} timeframe="1Day" />);

        const calls = vi
            .mocked(useLinePaneChart)
            .mock.calls.map(([params]) => params);
        keys.forEach((key, i) => {
            const call = calls.find(
                params => params.spec === LINE_PANE_SPECS[key]
            );
            expect(call, key).toMatchObject({
                isVisible: i % 2 === 0,
                paneIndex: i + 1,
            });
        });
    });

    it('creates a chart when bars are provided', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);

        expect(mockCreateChart).toHaveBeenCalledTimes(1);
    });

    /**
     * 이 차트 **바로 아래**에 거래량 차트가 붙고 그쪽이 자기 시간축을 그린다.
     * 여기까지 그리면 같은 날짜 라벨이 화면에 두 번 찍히고(각 28px), 세로 예산이
     * 빠듯한 모바일에서 그 28px이 그대로 캔들에서 빠진다.
     *
     * 값 하나짜리 옵션이라 지워져도 렌더는 멀쩡히 되고 기존 테스트도 전부
     * 통과한다 — 그래서 여기서 명시적으로 붙든다.
     */
    it('시간축을 그리지 않는다 (거래량 차트와 중복)', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);

        const options = mockCreateChart.mock.calls[0]?.[1];
        expect(options?.timeScale).toEqual({ visible: false });
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

    it('renders IndicatorSettingsPopover with 34 indicator bindings', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);
        const modal = screen.getByTestId('indicator-settings-modal');
        expect(modal).toHaveAttribute('data-count', '34');
        expect(modal).toHaveAttribute(
            'data-keys',
            'ma,ema,ichimoku,rsi,macd,dmi,stochastic,stochRsi,cci,bollinger,volumeProfile,mfi,williamsR,connorsRsi,cmf,bollingerPercentB,hurst,varianceRatio,macdV,forceIndex,obv,atr,yangZhang,ewmaVolatility,keltnerChannel,donchianChannel,supertrend,parabolicSar,chandelierExit,elderRay,squeezeMomentum,regression,elderImpulse,smc'
        );
    });

    it('renders the settings trigger in a header strip outside and above the chart canvas', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);
        const modal = screen.getByTestId('indicator-settings-modal');
        const canvas = screen.getByRole('img');

        expect(canvas.contains(modal)).toBe(false);
        expect(
            modal.compareDocumentPosition(canvas) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('removes chart on unmount', () => {
        const { unmount } = render(
            <StockChart bars={mockBars} timeframe="1Day" />
        );

        unmount();

        const chart = mockCreateChart.mock.results[0].value;
        expect(chart.remove).toHaveBeenCalled();
    });

    /**
     * **테마를 바꾸면 차트가 새 팔레트로 *데이터까지* 다시 그려져야 한다.**
     *
     * 처음엔 생성 효과의 deps에만 `themeVersion`을 넣었다. 그러면 차트는 다시
     * 만들어지지만 `setData`를 부르는 효과와 오버레이 훅 31개는 안정적인 ref에만
     * 의존해 재실행되지 않아, **토글 한 번에 차트가 백지가 됐다**(감사 실증:
     * createChart 2회 대 setData 1회). 그래서 마운트 지점에서 `key`로 갈아
     * 컴포넌트를 통째로 remount한다.
     *
     * 이 테스트는 `createChart`만 보지 않는다 — 그것만 보면 백지 상태도 통과한다.
     * `setData`가 함께 다시 불렸는지를 봐야 결함이 잡힌다.
     */
    it('테마가 바뀌면 차트를 데이터까지 다시 그린다', () => {
        function Harness() {
            const themeVersion = useThemeVersion();
            return (
                <StockChart
                    key={themeVersion}
                    bars={mockBars}
                    timeframe="1Day"
                />
            );
        }

        render(<Harness />);
        const createdBefore = mockCreateChart.mock.calls.length;
        const dataBefore = mockSetData.mock.calls.length;
        expect(createdBefore).toBeGreaterThan(0);
        expect(dataBefore).toBeGreaterThan(0);

        act(() => {
            window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
        });

        expect(mockCreateChart.mock.calls.length).toBeGreaterThan(
            createdBefore
        );
        expect(mockSetData.mock.calls.length).toBeGreaterThan(dataBefore);
    });

    /**
     * **훅이 있는 것과 붙어 있는 것은 다르다.**
     *
     * `usePricePaneStretch` / `usePricePaneSize`는 각자 단위 테스트가 있지만
     * 그건 훅을 직접 렌더한다. 감사가 `StockChart`에서 import 두 줄, 호출 두 줄,
     * prop 두 개를 통째로 지웠는데 typecheck·lint·전체 스위트가 바이트 단위로
     * 같았다 — 배선을 보는 단언이 하나도 없었기 때문이다. 아래 둘이 그 자리다.
     */
    it('가격 pane stretch를 실제 pane 구성에 맞춰 적용한다', async () => {
        // 246px 모바일: pane 예산 214px을 기본 stretch(2,1,1,1)로 나눈 상태.
        setPaneLayout([
            { stretch: 2, height: 85.6 },
            { stretch: 1, height: 42.8 },
            { stretch: 1, height: 42.8 },
            { stretch: 1, height: 42.8 },
        ]);

        render(<StockChart bars={mockBars} timeframe="1Day" />);
        await flushFrame();

        // 보조 합계 3, 픽셀 상한 4.13 → 가격 pane이 절반을 받는 3.
        expect(paneSpies.at(0).setStretchFactor).toHaveBeenCalledWith(3);
        // 보조 pane에는 손대지 않는다 — 드래그로 맞춰 둔 비율을 되돌리면 안 된다.
        expect(paneSpies.at(1).setStretchFactor).not.toHaveBeenCalled();
    });

    it('범례에 실측한 가격 pane 높이와 차트 폭을 넘긴다', async () => {
        const restoreClientWidth = stubClientWidth(246);
        setPaneLayout([
            { stretch: 2, height: 110 },
            { stretch: 1, height: 52 },
        ]);

        try {
            render(<StockChart bars={mockBars} timeframe="1Day" />);
            await flushFrame();

            const legend = screen.getByTestId('overlay-legend');
            expect(legend).toHaveAttribute('data-price-pane-height', '110');
            expect(legend).toHaveAttribute('data-chart-width', '246');
        } finally {
            restoreClientWidth();
        }
    });

    /**
     * `IndicatorSettingsPopover`에는 34개 지표 바인딩이 내려가는데, 각 바인딩의
     * `onToggle`이 실제로 `toggle(key)`를 부르는지는 이전 테스트가 보지 않았다
     * (바인딩 개수·키 목록만 확인). 배선이 끊겨도(`onToggle: () => {}`로 잘못
     * 바뀌어도) 감지가 안 됐을 것 — 클릭까지 흘려서 확인한다.
     */
    it('지표 바인딩의 onToggle을 누르면 해당 key로 toggle을 호출한다', () => {
        render(<StockChart bars={mockBars} timeframe="1Day" />);

        fireEvent.click(screen.getByTestId('toggle-rsi'));

        expect(mockToggle).toHaveBeenCalledWith('rsi');
    });

    /**
     * indicator 토글로 `paneIndices`가 바뀌면(오브젝트 참조 변경) LWC v5가 빈 pane
     * DOM을 정리하지 않는 문제를 우회하기 위해 명시적으로 resize를 두 번(축소 후
     * 원복) 호출해야 한다. 첫 mount에서는 이 resize가 건너뛰어져야 하고, 이후
     * paneIndices가 바뀔 때만 실행돼야 한다 — 둘 다 여기서 검증한다.
     */
    it('mount 시점에는 명시 resize를 건너뛰고, paneIndices가 바뀌면 그때 resize한다', async () => {
        const restore = stubClientSize(300, 400);
        try {
            const { rerender } = render(
                <StockChart bars={mockBars} timeframe="1Day" />
            );
            const chart = mockCreateChart.mock.results[0].value;
            await flushFrame();

            // 첫 mount: paneIndices effect의 초기 skip으로 명시 resize가 없어야 한다.
            expect(chart.resize).not.toHaveBeenCalled();

            // 참조가 다른 새 paneIndices 객체로 교체 — 지표 토글 시 발생하는 상황을 재현.
            mockUseIndicatorVisibility.mockReturnValue({
                visible: DEFAULT_VISIBLE,
                toggle: mockToggle,
                paneIndices: { ...INACTIVE_PANES },
            });
            rerender(<StockChart bars={mockBars} timeframe="1Day" />);
            await flushFrame();

            expect(chart.applyOptions).toHaveBeenCalledWith({
                autoSize: false,
            });
            expect(chart.resize).toHaveBeenCalledWith(299, 400);
            expect(chart.resize).toHaveBeenCalledWith(300, 400);
            expect(chart.applyOptions).toHaveBeenCalledWith({
                autoSize: true,
            });
        } finally {
            restore();
        }
    });

    describe('차트 작도(chartOverlays)', () => {
        const overlay = {
            id: 'pattern:double_bottom:100',
            kind: 'pattern' as const,
            skill: 'double_bottom',
            sourceRef: 'p1',
            variant: 'primary' as const,
            segments: [
                {
                    from: { time: 100, price: 10 },
                    to: { time: 300, price: 12 },
                    role: 'pattern',
                    style: 'solid' as const,
                    pane: 'price' as const,
                },
            ],
            levels: [],
            labels: [],
        };

        it('renders the 차트 작도 header button when overlayItems is non-empty', () => {
            const items: readonly OverlayMenuItem[] = [
                { key: 'p1', kind: 'pattern', label: 'Double Bottom' },
            ];
            render(
                <StockChart
                    bars={mockBars}
                    timeframe="1Day"
                    chartOverlays={[overlay]}
                    overlayItems={items}
                />
            );

            expect(
                screen.getByRole('button', { name: /차트 작도/ })
            ).toBeInTheDocument();
        });

        it('does not render the 차트 작도 button when overlayItems is empty (default)', () => {
            render(<StockChart bars={mockBars} timeframe="1Day" />);

            expect(
                screen.queryByRole('button', { name: /차트 작도/ })
            ).not.toBeInTheDocument();
        });

        /**
         * `useChartOverlays`에 실제로 넘어가는 specs를 검증한다. `mock.calls.at(-1)`로
         * 마지막 호출만 본다 — 인덱스 [0] 고정은 리렌더 순서가 바뀌면 조용히 다른
         * 렌더의 인자를 집는다.
         */
        describe('useChartOverlays로 넘어가는 specs', () => {
            function lastSpecs() {
                return vi.mocked(useChartOverlays).mock.calls.at(-1)?.[0].specs;
            }

            it('highlightedOverlayKey가 가리키는 오버레이는 hiddenOverlayKeys에 없으면(꺼지지 않았으면) specs에 남는다', () => {
                const divergenceOverlay: ChartOverlay = {
                    id: 'divergence:rsi_bearish:1',
                    kind: 'divergence',
                    skill: 'rsi_bearish_divergence',
                    sourceRef: 'd1',
                    variant: 'primary',
                    segments: [
                        {
                            from: { time: 100, price: 10 },
                            to: { time: 300, price: 12 },
                            role: 'price',
                            style: 'solid',
                            pane: 'price',
                        },
                    ],
                    levels: [],
                    labels: [],
                };

                render(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={[divergenceOverlay]}
                        highlightedOverlayKey="d1"
                    />
                );

                const specs = lastSpecs();
                expect(specs).toHaveLength(1);
                expect(specs?.[0].points).toEqual([
                    { time: 100, value: 10 },
                    { time: 300, value: 12 },
                ]);
            });

            it('hiddenOverlayKeys에 든 key의 오버레이는 specs에서 빠진다', () => {
                const divergenceOverlay: ChartOverlay = {
                    id: 'divergence:rsi_bearish:1',
                    kind: 'divergence',
                    skill: 'rsi_bearish_divergence',
                    sourceRef: 'd1',
                    variant: 'primary',
                    segments: [
                        {
                            from: { time: 100, price: 10 },
                            to: { time: 300, price: 12 },
                            role: 'price',
                            style: 'solid',
                            pane: 'price',
                        },
                    ],
                    levels: [],
                    labels: [],
                };

                render(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={[divergenceOverlay]}
                        hiddenOverlayKeys={new Set(['d1'])}
                    />
                );

                expect(lastSpecs()).toEqual([]);
            });

            it("레벨 라벨 'breakout'은 t()가 반환하는 번역 문구로 바뀐다", () => {
                const patternWithLevel: ChartOverlay = {
                    id: 'pattern:double_bottom:100',
                    kind: 'pattern',
                    skill: 'double_bottom',
                    sourceRef: 'p1',
                    variant: 'primary',
                    segments: [],
                    levels: [{ price: 11, fromTime: 100, label: 'breakout' }],
                    labels: [],
                };

                render(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={[patternWithLevel]}
                    />
                );

                const specs = lastSpecs();
                expect(specs?.[0].title).toBe('돌파 기준');
            });

            it('패턴 항목 라벨이 있으면 돌파선 라벨에 패턴명을 붙인다', () => {
                const patternWithLevel: ChartOverlay = {
                    id: 'pattern:rounding_bottom:100',
                    kind: 'pattern',
                    skill: 'rounding_bottom',
                    sourceRef: 'p1',
                    variant: 'primary',
                    segments: [],
                    levels: [{ price: 11, fromTime: 100, label: 'breakout' }],
                    labels: [],
                };

                render(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={[patternWithLevel]}
                        overlayItems={[
                            { key: 'p1', kind: 'pattern', label: '원형 바닥' },
                        ]}
                    />
                );

                expect(lastSpecs()?.[0].title).toBe('원형 바닥 돌파');
            });

            const outcomePattern = (sourceRef: string): ChartOverlay => ({
                id: `pattern:double_top:${sourceRef}`,
                kind: 'pattern',
                skill: 'double_top',
                sourceRef,
                variant: 'primary',
                segments: [
                    {
                        from: { time: 100, price: 10 },
                        to: { time: 300, price: 12 },
                        role: 'pattern',
                        style: 'solid',
                        pane: 'price',
                    },
                ],
                levels: [{ price: 14, fromTime: 100, label: 'invalidation' }],
                labels: [],
            });
            const patternItems = (refs: string[]) =>
                refs.map(ref => ({
                    key: ref,
                    kind: 'pattern' as const,
                    label: `패턴${ref}`,
                }));
            const outcomeTitles = () =>
                (lastSpecs() ?? [])
                    .filter(spec => spec.points[0].value === 14)
                    .map(spec => spec.title);
            const outcomePriorities = () =>
                (lastSpecs() ?? [])
                    .filter(spec => spec.points[0].value === 14)
                    .map(spec => spec.labelPriority);

            it('무효화 선 라벨에 패턴 이름을 붙인다', () => {
                render(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={[outcomePattern('p1')]}
                        overlayItems={patternItems(['p1'])}
                    />
                );
                expect(outcomeTitles()).toEqual(['패턴p1 무효화']);
            });

            it('결과선 작도가 셋 이상이어도 라벨을 숨기지 않고, 강조한 작도의 라벨이 겹침 우선순위를 갖는다', () => {
                const refs = ['p1', 'p2', 'p3'];
                const { rerender } = render(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={refs.map(outcomePattern)}
                        overlayItems={patternItems(refs)}
                    />
                );
                // 겹침은 그릴 때 화면 좌표로 판정한다(useChartOverlays) — 개수로 숨기지 않는다.
                expect(outcomeTitles()).toEqual([
                    '패턴p1 무효화',
                    '패턴p2 무효화',
                    '패턴p3 무효화',
                ]);
                expect(outcomePriorities()).toEqual([1, 1, 1]);
                rerender(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={refs.map(outcomePattern)}
                        overlayItems={patternItems(refs)}
                        highlightedOverlayKey="p2"
                    />
                );
                expect(outcomeTitles()).toEqual([
                    '패턴p1 무효화',
                    '패턴p2 무효화',
                    '패턴p3 무효화',
                ]);
                expect(outcomePriorities()).toEqual([1, 3, 1]);
            });

            it('패턴이 둘 이상이면 팔레트 색, 하나면 스킬 색을 쓴다', () => {
                const colorsOf = () =>
                    (lastSpecs() ?? [])
                        .filter(spec => spec.points[0].value === 10)
                        .map(spec => spec.color);
                const { rerender } = render(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={[outcomePattern('p1')]}
                        overlayItems={patternItems(['p1'])}
                        overlayColors={{ p1: '#ef5350' }}
                    />
                );
                expect(colorsOf()).toEqual(['#ef5350']);
                rerender(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={['p1', 'p2'].map(outcomePattern)}
                        overlayItems={patternItems(['p1', 'p2'])}
                        overlayColors={{ p1: '#ef5350', p2: '#ef5350' }}
                    />
                );
                expect(colorsOf()).toEqual(['#pal-1', '#pal-2']);
            });

            it('RSI pane이 꺼져 있으면(paneIndex=null) rsi 세그먼트가 specs에서 빠지고 price 세그먼트만 남는다', () => {
                const divergenceWithRsi: ChartOverlay = {
                    id: 'divergence:rsi_bearish:2',
                    kind: 'divergence',
                    skill: 'rsi_bearish_divergence',
                    sourceRef: 'd2',
                    variant: 'primary',
                    segments: [
                        {
                            from: { time: 100, price: 10 },
                            to: { time: 300, price: 12 },
                            role: 'price',
                            style: 'solid',
                            pane: 'price',
                        },
                        {
                            from: { time: 100, price: 30 },
                            to: { time: 300, price: 40 },
                            role: 'rsi',
                            style: 'solid',
                            pane: 'rsi',
                        },
                    ],
                    levels: [],
                    labels: [],
                };

                // mockUseIndicatorVisibility의 기본값(DEFAULT_VISIBLE)이 rsi:false다
                // — StockChart는 그 경우 rsiPaneIndex로 null을 넘긴다.
                render(
                    <StockChart
                        bars={mockBars}
                        timeframe="1Day"
                        chartOverlays={[divergenceWithRsi]}
                        highlightedOverlayKey="d2"
                    />
                );

                const specs = lastSpecs();
                expect(specs).toHaveLength(1);
                expect(specs?.[0].paneIndex).toBe(0);
            });
        });

        /**
         * 레벨선 제목이 마지막 캔들을 덮지 않도록 오른쪽 여백(px)을 소비처로 알린다.
         * 폭 측정은 캔버스 `measureText`라 jsdom에서 못 하므로 측정기를 주입한다
         * (글자당 10px). pane 폭은 wrapper `clientWidth`를 심어 만든다.
         */
        describe('오른쪽 여백(onRightGutterChange)', () => {
            const TEN_PX_PER_CHAR = (text: string): number => text.length * 10;

            const patternWithBreakout: ChartOverlay = {
                id: 'pattern:double_bottom:100',
                kind: 'pattern',
                skill: 'double_bottom',
                sourceRef: 'p1',
                variant: 'primary',
                segments: [],
                levels: [{ price: 11, fromTime: 100, label: 'breakout' }],
                labels: [],
            };

            async function renderWithWidth(
                width: number,
                props: Partial<Parameters<typeof StockChart>[0]> = {}
            ) {
                const restore = stubClientWidth(width);
                try {
                    const result = render(
                        <StockChart
                            bars={mockBars}
                            timeframe="1Day"
                            measureText={TEN_PX_PER_CHAR}
                            {...props}
                        />
                    );
                    await flushFrame();
                    return result;
                } finally {
                    restore();
                }
            }

            it('돌파선 제목이 있으면 가장 긴 제목 폭 + 12px 여백(양수)을 알린다', async () => {
                const onRightGutterChange = vi.fn();

                await renderWithWidth(1000, {
                    chartOverlays: [patternWithBreakout],
                    onRightGutterChange,
                });

                // '돌파 기준' = 5자 → 50px + 12px.
                expect(onRightGutterChange).toHaveBeenLastCalledWith(62);
            });

            it('제목이 없으면 0을 알린다', async () => {
                const onRightGutterChange = vi.fn();

                await renderWithWidth(1000, { onRightGutterChange });

                expect(onRightGutterChange).toHaveBeenLastCalledWith(0);
            });

            it('여백은 pane 폭의 30%를 넘지 않는다', async () => {
                const onRightGutterChange = vi.fn();

                await renderWithWidth(100, {
                    chartOverlays: [patternWithBreakout],
                    onRightGutterChange,
                });

                expect(onRightGutterChange).toHaveBeenLastCalledWith(30);
            });

            // 결과선(무효화)이 셋 이상이면 혼잡 — 강조되지 않은 제목은 `''`로 숨는다.
            // 그 상태로 여백을 재면 카드 hover마다 값이 0↔92로 흔들려 차트가 튄다.
            it('결과선 제목 전체의 최대 폭으로 잡고, 카드 hover(강조)로 흔들리지 않는다', async () => {
                const refs = ['p1', 'p2', 'p3'];
                const outcomePattern = (sourceRef: string): ChartOverlay => ({
                    id: `pattern:double_top:${sourceRef}`,
                    kind: 'pattern',
                    skill: 'double_top',
                    sourceRef,
                    variant: 'primary',
                    segments: [],
                    levels: [
                        { price: 14, fromTime: 100, label: 'invalidation' },
                    ],
                    labels: [],
                });
                const items = refs.map(ref => ({
                    key: ref,
                    kind: 'pattern' as const,
                    label: `패턴${ref}`,
                }));
                const onRightGutterChange = vi.fn();
                const restore = stubClientWidth(1000);
                try {
                    const { rerender } = render(
                        <StockChart
                            bars={mockBars}
                            timeframe="1Day"
                            measureText={TEN_PX_PER_CHAR}
                            chartOverlays={refs.map(outcomePattern)}
                            overlayItems={items}
                            onRightGutterChange={onRightGutterChange}
                        />
                    );
                    await flushFrame();
                    // 여백은 '패턴p1 무효화'(8자) 기준이다.
                    expect(onRightGutterChange).toHaveBeenLastCalledWith(92);
                    onRightGutterChange.mockClear();

                    rerender(
                        <StockChart
                            bars={mockBars}
                            timeframe="1Day"
                            measureText={TEN_PX_PER_CHAR}
                            chartOverlays={refs.map(outcomePattern)}
                            overlayItems={items}
                            highlightedOverlayKey="p2"
                            onRightGutterChange={onRightGutterChange}
                        />
                    );
                    await flushFrame();
                } finally {
                    restore();
                }

                expect(onRightGutterChange).not.toHaveBeenCalled();
            });

            it('꺼진 항목의 제목은 여백에 반영하지 않는다', async () => {
                const onRightGutterChange = vi.fn();

                await renderWithWidth(1000, {
                    chartOverlays: [patternWithBreakout],
                    hiddenOverlayKeys: new Set(['p1']),
                    onRightGutterChange,
                });

                expect(onRightGutterChange).toHaveBeenLastCalledWith(0);
            });
        });
    });
    describe('프리·애프터마켓(시간외) 봉', () => {
        // 정규장 봉(mockBars: 100·200·300)과 같은 ET 거래일(2026-10-14, EDT)의 확장 봉으로 쓰려고 시각을 맞춘다.
        const REGULAR_OPEN = Date.parse('2026-10-14T13:30:00Z') / 1000;
        const regular: Bar[] = [
            {
                time: REGULAR_OPEN,
                open: 100,
                high: 101,
                low: 99,
                close: 100,
                volume: 5,
            },
            {
                time: REGULAR_OPEN + 300,
                open: 100,
                high: 102,
                low: 99,
                close: 101,
                volume: 6,
            },
        ];
        const pre: Bar = {
            time: REGULAR_OPEN - 300, // 09:25 ET — 프리마켓
            open: 98,
            high: 99,
            low: 97,
            close: 98.5,
            volume: 1,
        };
        const bearishAfter: Bar = {
            time: Date.parse('2026-10-14T20:00:00Z') / 1000, // 16:00 ET — 애프터마켓
            open: 103,
            high: 104,
            low: 101,
            close: 102,
            volume: 2,
        };
        const extended = [pre, bearishAfter];
        const display = [pre, ...regular, bearishAfter];

        const lastCandleData = (): {
            time: number;
            color?: string;
            close: number;
        }[] => {
            // `mockSetData`는 모든 시리즈가 공유한다 — 캔들 호출은 `close`를 가진 점이고 봉 수가 display와 같다.
            const call = mockSetData.mock.calls
                .filter(
                    ([d]) =>
                        Array.isArray(d) &&
                        d.length === display.length &&
                        d.every(p => 'close' in p)
                )
                .at(-1);
            return call![0];
        };

        it('캔들 시리즈에 정규장 캔들과 속 빈 시간외 캔들을 시각순으로 그린다', () => {
            render(
                <StockChart
                    bars={regular}
                    displayBars={display}
                    extendedBars={extended}
                    timeframe="5Min"
                />
            );

            const data = lastCandleData();
            expect(data.map(c => c.time)).toEqual(display.map(b => b.time));
            // 정규장 캔들은 기본 색(색 필드 없음), 시간외 캔들만 방향별 흐린 색
            expect(data[1]).not.toHaveProperty('color');
            // 시간외 캔들은 속 빈 몸통 + 방향색 테두리·심지
            expect(data[0]).toMatchObject({
                color: TRANSPARENT_COLOR,
                borderColor: '#ext-bull', // 종가 ≥ 시가
                wickColor: '#ext-bull',
            });
            expect(data[3]).toMatchObject({
                color: TRANSPARENT_COLOR,
                borderColor: '#ext-bear', // 종가 < 시가
                wickColor: '#ext-bear',
            });
        });

        it('시간외 구간 음영 primitive를 캔들 시리즈에 붙이고, 언마운트하면 떼어 낸다', () => {
            const { unmount } = render(
                <StockChart
                    bars={regular}
                    displayBars={display}
                    extendedBars={extended}
                    timeframe="5Min"
                />
            );
            expect(mockAttachPrimitive).toHaveBeenCalledTimes(1);
            // 음영 primitive는 `setRanges`를 가진 것으로 가려낸다(호출 순서에 기대지 않는다)
            const primitive = mockAttachPrimitive.mock.calls.find(
                ([p]) => typeof p.setRanges === 'function'
            )![0];
            expect(primitive.paneViews()[0].zOrder()).toBe('bottom');

            unmount();
            expect(mockDetachPrimitive).toHaveBeenCalledWith(primitive);
        });

        it('시간외 봉이 없으면 primitive도 범례도 없다(기존 차트와 같다)', () => {
            render(<StockChart bars={regular} timeframe="5Min" />);
            expect(mockAttachPrimitive).not.toHaveBeenCalled();
            expect(
                screen.queryByText('음영: 시간외(프리·애프터마켓)')
            ).toBeNull();
        });

        it('시간외 봉이 있으면 음영이 시간외(프리·애프터마켓)임을 말하는 범례를 띄운다', () => {
            render(
                <StockChart
                    bars={regular}
                    displayBars={display}
                    extendedBars={extended}
                    timeframe="5Min"
                />
            );
            expect(
                screen.getByText('음영: 시간외(프리·애프터마켓)')
            ).toBeInTheDocument();
        });

        it('그려지는 봉이 바뀌면(시간외 봉 도착) 시간축을 다시 맞춘다', () => {
            const { rerender } = render(
                <StockChart bars={regular} timeframe="5Min" />
            );
            mockFitContent.mockClear();
            rerender(
                <StockChart
                    bars={regular}
                    displayBars={display}
                    extendedBars={extended}
                    timeframe="5Min"
                />
            );
            expect(mockFitContent).toHaveBeenCalled();
        });

        it('일목균형표 구름은 마지막 **그려진** 봉(애프터마켓)에서 이어진다', () => {
            render(
                <StockChart
                    bars={regular}
                    displayBars={display}
                    extendedBars={extended}
                    timeframe="5Min"
                />
            );
            expect(mockUseIchimokuOverlay).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    bars: regular,
                    futureAnchorTime: bearishAfter.time,
                })
            );
        });

        it('지표 훅에는 정규장 봉만 넘어간다(시간외 봉이 지표 정렬을 밀지 않는다)', () => {
            render(
                <StockChart
                    bars={regular}
                    displayBars={display}
                    extendedBars={extended}
                    timeframe="5Min"
                />
            );
            expect(mockUseIchimokuOverlay).toHaveBeenLastCalledWith(
                expect.objectContaining({ bars: regular })
            );
        });

        describe('지표 선은 시간외 구간에서 끊기고, 추세선·작도 레벨은 이어진다', () => {
            const renderExtended = () =>
                render(
                    <StockChart
                        bars={regular}
                        displayBars={display}
                        extendedBars={extended}
                        timeframe="5Min"
                    />
                );
            // 시간외 봉(pre·애프터)을 사이에 둔 두 정규장 시각의 점 — 밤새 구간을 가로지르는 선
            const overnight = [
                { time: pre.time - 600, value: 30 },
                { time: bearishAfter.time + 600, value: 60 },
            ];
            const seriesFrom = (hook: 'indicator' | 'overlay') => {
                const params =
                    hook === 'indicator'
                        ? vi.mocked(useLinePaneChart).mock.calls.at(-1)![0]
                        : vi.mocked(useChartOverlays).mock.calls.at(-1)![0];
                return params.chartRef.current!.addSeries(
                    'LineSeries' as never,
                    {} as never
                );
            };

            const HIDDEN = TRANSPARENT_COLOR;

            it('지표 훅이 만드는 선 시리즈는 한 시리즈로 남고, 시간외 구간 앞 점만 투명 색을 받는다(값은 그대로)', () => {
                renderExtended();
                mockAddSeries.mockClear();
                mockSetData.mockClear();

                seriesFrom('indicator').setData(overnight as never);

                expect(mockAddSeries).toHaveBeenCalledTimes(1);
                expect(mockSetData).toHaveBeenCalledWith([
                    { ...overnight[0], color: HIDDEN },
                    overnight[1],
                ]);
            });

            it('시간외 구간을 건너지 않는 선(정규장 안쪽)은 그대로다', () => {
                renderExtended();
                const inside = [
                    { time: regular[0]!.time, value: 1 },
                    { time: regular[1]!.time, value: 2 },
                ];
                seriesFrom('indicator').setData(inside as never);
                expect(mockSetData).toHaveBeenLastCalledWith(inside);
            });

            it('작도 레벨(useChartOverlays)의 시리즈는 이어진다(투명 색 없음)', () => {
                renderExtended();
                mockSetData.mockClear();

                seriesFrom('overlay').setData(overnight as never);

                expect(mockSetData).toHaveBeenCalledWith(overnight);
            });

            it('시간외 봉이 나중에 도착하면 이미 그려진 지표 선을 다시 채운다', () => {
                const { rerender } = render(
                    <StockChart bars={regular} timeframe="5Min" />
                );
                seriesFrom('indicator').setData(overnight as never);
                expect(mockSetData).toHaveBeenLastCalledWith(overnight);
                mockSetData.mockClear();

                rerender(
                    <StockChart
                        bars={regular}
                        displayBars={display}
                        extendedBars={extended}
                        timeframe="5Min"
                    />
                );

                expect(mockSetData).toHaveBeenCalledWith([
                    { ...overnight[0], color: HIDDEN },
                    overnight[1],
                ]);
            });
        });

        describe('시간외 봉이 나중에 도착할 때 보던 자리', () => {
            const T0 = regular[0]!.time;
            const T1 = regular[1]!.time;
            /** 사용자가 보던 자리: 첫·둘째 정규 봉, 양끝에 빈 공간 2봉씩. */
            const setUserView = (): void => {
                viewMock.visibleRange = { from: T0, to: T1 };
                viewMock.logicalRange = { from: -2, to: 3 };
                viewMock.indexBefore = { [T0]: 0, [T1]: 1 };
                // 시간외 봉이 끼어 같은 봉이 다른 인덱스를 가진다
                viewMock.indexAfter = { [T0]: 66, [T1]: 67 };
            };
            /**
             * `useChartSync`의 조정 기록을 흉내 낸다 — 입력 리스너는 그 훅 한 곳에만 있고(두 차트의 입력을
             * 모두 센다), `StockChart`는 조회·초기화 콜백만 받는다.
             */
            function syncStub() {
                const state = { adjusted: false };
                return {
                    state,
                    props: {
                        isViewAdjusted: () => state.adjusted,
                        onViewAdjustmentReset: vi.fn(() => {
                            state.adjusted = false;
                        }),
                    },
                };
            }
            const renderBare = (extra: Record<string, unknown> = {}) =>
                render(
                    <StockChart bars={regular} timeframe="5Min" {...extra} />
                );
            const arrive = (
                rerender: ReturnType<typeof render>['rerender'],
                extra: Record<string, unknown> = {}
            ): void => {
                // 첫 렌더의 setData가 단계를 넘겼다 — 사용자가 보던 시점으로 되돌린다.
                viewMock.phase = 'before';
                rerender(
                    <StockChart
                        bars={regular}
                        displayBars={display}
                        extendedBars={extended}
                        timeframe="5Min"
                        {...extra}
                    />
                );
            };

            it('사용자가 밀거나 확대했다면(어느 차트에서든) 맞추지 않고, 같은 봉이 화면에 남도록 새 인덱스로 옮겨 복원한다(여백 포함)', () => {
                setUserView();
                const { state, props } = syncStub();
                const { rerender } = renderBare(props);
                state.adjusted = true; // 첫 맞춤 뒤 사용자가 가격 또는 거래량 차트를 밀었다
                mockFitContent.mockClear();

                arrive(rerender, props);

                expect(mockFitContent).not.toHaveBeenCalled();
                // 첫 봉 66 − 왼쪽 여백 2, 둘째 봉 67 + 오른쪽 여백 2
                expect(mockSetVisibleLogicalRange).toHaveBeenLastCalledWith({
                    from: 64,
                    to: 69,
                });
            });

            it('사용자가 건드리지 않았다면 새 봉에 맞춘다', () => {
                setUserView();
                const { props } = syncStub();
                const { rerender } = renderBare(props);
                mockFitContent.mockClear();

                arrive(rerender, props);

                expect(mockFitContent).toHaveBeenCalled();
                expect(mockSetVisibleLogicalRange).not.toHaveBeenCalled();
            });

            it('조정 기록 콜백이 없으면(단독 사용) 항상 맞춘다', () => {
                setUserView();
                const { rerender } = renderBare();
                mockFitContent.mockClear();
                arrive(rerender);
                expect(mockFitContent).toHaveBeenCalled();
                expect(mockSetVisibleLogicalRange).not.toHaveBeenCalled();
            });

            it('차트에는 사용자 입력 리스너를 직접 걸지 않는다(입력은 useChartSync 한 곳에서 듣는다)', () => {
                const add = vi.spyOn(HTMLElement.prototype, 'addEventListener');
                const { unmount } = renderBare();
                const container = screen.getByRole('img');
                const inputTypes = ['pointerdown', 'wheel', 'touchstart'];
                const own = add.mock.calls.filter(
                    ([type], i) =>
                        add.mock.contexts[i] === container &&
                        inputTypes.includes(type)
                );
                expect(own).toEqual([]);
                unmount();
                add.mockRestore();
            });

            it('정규장 봉이 바뀌면(새 타임프레임·새로고침) 사용자가 밀었어도 기존처럼 맞춘다', () => {
                setUserView();
                const { state, props } = syncStub();
                const { rerender } = renderBare(props);
                state.adjusted = true;
                mockFitContent.mockClear();

                arrive(rerender, { ...props, bars: [...regular] });

                expect(mockFitContent).toHaveBeenCalled();
                expect(mockSetVisibleLogicalRange).not.toHaveBeenCalled();
            });

            it('정규장 봉이 바뀌어 맞추면 조정 기록 초기화를 요청하고, 그 뒤 새 입력 없이 도착한 시간외 봉에는 맞춘다', () => {
                setUserView();
                const { state, props } = syncStub();
                const { rerender } = renderBare(props);
                state.adjusted = true;
                // 정규장 봉이 바뀐다(맞춤 + 조정 기록 초기화 요청)
                const refreshed = [...regular];
                props.onViewAdjustmentReset.mockClear();
                rerender(
                    <StockChart bars={refreshed} timeframe="5Min" {...props} />
                );
                expect(props.onViewAdjustmentReset).toHaveBeenCalledTimes(1);
                expect(state.adjusted).toBe(false);

                setUserView();
                viewMock.phase = 'before';
                mockFitContent.mockClear();
                // 새 입력 없이 시간외 봉 도착
                rerender(
                    <StockChart
                        bars={refreshed}
                        displayBars={display}
                        extendedBars={extended}
                        timeframe="5Min"
                        {...props}
                    />
                );

                expect(mockFitContent).toHaveBeenCalled();
                expect(mockSetVisibleLogicalRange).not.toHaveBeenCalled();
            });

            it('시간외 봉만 도착해 복원할 때는 초기화하지 않는다(다음 도착도 보존)', () => {
                setUserView();
                const { state, props } = syncStub();
                const { rerender } = renderBare(props);
                state.adjusted = true;
                props.onViewAdjustmentReset.mockClear();
                arrive(rerender, props);
                expect(props.onViewAdjustmentReset).not.toHaveBeenCalled();
                expect(state.adjusted).toBe(true);
            });

            it('보던 자리를 아직 모르면(범위 없음) 맞춘다', () => {
                const { state, props } = syncStub();
                const { rerender } = renderBare(props);
                state.adjusted = true;
                mockFitContent.mockClear();
                arrive(rerender, props);
                expect(mockFitContent).toHaveBeenCalled();
            });

            it('복원할 봉의 새 인덱스를 못 찾으면 맞춘다', () => {
                setUserView();
                const { state, props } = syncStub();
                const { rerender } = renderBare(props);
                state.adjusted = true;
                viewMock.indexAfter = {};
                mockFitContent.mockClear();
                arrive(rerender, props);
                expect(mockFitContent).toHaveBeenCalled();
                expect(mockSetVisibleLogicalRange).not.toHaveBeenCalled();
            });
        });

        describe('시간외 표시 토글(차트 작도 메뉴)', () => {
            it('설정을 주면 메뉴가 뜨고 행을 누르면 반대 값으로 onChange를 부른다', () => {
                const onChange = vi.fn();
                render(
                    <StockChart
                        bars={regular}
                        timeframe="5Min"
                        extendedHours={{ checked: true, onChange }}
                    />
                );
                // 작도 항목이 없어도 설정 행 때문에 메뉴가 뜬다 — 트리거는 "차트 설정"
                fireEvent.click(
                    screen.getByRole('button', { name: /차트 설정/ })
                );
                const row = screen.getByRole('button', {
                    name: '시간외 거래(프리·애프터마켓) 표시',
                });
                expect(row).toHaveAttribute('aria-pressed', 'true');
                fireEvent.click(row);
                expect(onChange).toHaveBeenCalledWith(false);
            });

            it('설정을 주지 않으면(일봉·크립토·한국 주식) 행도 메뉴도 없다', () => {
                render(<StockChart bars={regular} timeframe="1Day" />);
                expect(
                    screen.queryByRole('button', { name: /차트 설정/ })
                ).toBeNull();
                expect(
                    screen.queryByText('시간외 거래(프리·애프터마켓) 표시')
                ).toBeNull();
            });
        });
    });
});
