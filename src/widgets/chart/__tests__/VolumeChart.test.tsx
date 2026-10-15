import { render, screen } from '@testing-library/react';
import type { Bar, BuySellVolumeResult } from '@y0ngha/siglens-core';
import { VolumeChart } from '@/widgets/chart/VolumeChart';
import { usePaneLabels } from '@/widgets/chart/hooks/usePaneLabels';
import { useExtendedSessionBand } from '@/widgets/chart/hooks/useExtendedSessionBand';
import { useVolumeChartData } from '@/widgets/chart/hooks/useVolumeChartData';

const { mockCreateChart } = vi.hoisted(() => {
    const mockCreateChart = vi.fn(() => ({
        addSeries: vi.fn(() => ({
            setData: vi.fn(),
            applyOptions: vi.fn(),
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
    HistogramSeries: 'HistogramSeries',
    LineSeries: 'LineSeries',
    ColorType: { Solid: 'solid' },
    LineStyle: { Solid: 0 },
}));

vi.mock('@/shared/lib/chartColors', () => ({
    CHART_COLORS: {
        background: '#1a1a2e',
        text: '#a0a0b0',
        grid: '#2a2a3e',
        bullish: '#26a69a',
        bearish: '#ef5350',
        volume: '#555577',
    },
    /* 차트 크롬을 런타임 테마에서 읽는 리졸버. 테스트는 다크 고정이면 충분하다. */
    getChartChrome: () => ({
        background: '#1a1a2e',
        grid: '#2a2a3e',
        text: '#a0a0b0',
    }),
}));

vi.mock('@/widgets/chart/hooks/usePaneLabels', () => ({
    usePaneLabels: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useVolumeChartData', () => ({
    useVolumeChartData: vi.fn(),
}));

const { lifecycleRefs } = vi.hoisted(() => ({
    lifecycleRefs: {
        chartRef: { current: null },
        totalSeriesRef: { current: null },
        buySeriesRef: { current: null },
    },
}));
vi.mock('@/widgets/chart/hooks/useVolumeChartLifecycle', () => ({
    useVolumeChartLifecycle: () => lifecycleRefs,
}));
vi.mock('@/widgets/chart/hooks/useExtendedSessionBand', () => ({
    useExtendedSessionBand: vi.fn(),
}));

const mockBars: Bar[] = [
    { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 1000 },
    { time: 200, open: 12, high: 18, low: 11, close: 15, volume: 1200 },
];

const mockBuySellVolume: BuySellVolumeResult[] = [
    { buyVolume: 600, sellVolume: 400 },
    { buyVolume: 700, sellVolume: 500 },
];

describe('VolumeChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the chart container', () => {
        render(
            <VolumeChart bars={mockBars} buySellVolume={mockBuySellVolume} />
        );

        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('renders with default aria-label when no ticker', () => {
        render(
            <VolumeChart bars={mockBars} buySellVolume={mockBuySellVolume} />
        );

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            '거래량 차트'
        );
    });

    it('renders with ticker-specific aria-label', () => {
        render(
            <VolumeChart
                bars={mockBars}
                buySellVolume={mockBuySellVolume}
                ticker="TSLA"
            />
        );

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            'TSLA 거래량 차트'
        );
    });

    it('renders with generic aria-label when ticker is empty', () => {
        render(
            <VolumeChart
                bars={mockBars}
                buySellVolume={mockBuySellVolume}
                ticker=""
            />
        );

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            '거래량 차트'
        );
    });

    it('패널 범례의 매수/매도 라벨을 한국어로 넘긴다', () => {
        render(
            <VolumeChart bars={mockBars} buySellVolume={mockBuySellVolume} />
        );

        const { labels } = vi.mocked(usePaneLabels).mock.calls.at(-1)![0];
        expect(labels[0].subLabels.map(l => l.name)).toEqual(['매수', '매도']);
    });

    describe('프리·애프터마켓', () => {
        // 2026-10-14(EDT): 프리 08:55 ET, 애프터 16:00 ET
        const pre: Bar = {
            time: Date.parse('2026-10-14T12:55:00Z') / 1000,
            open: 1,
            high: 2,
            low: 1,
            close: 1,
            volume: 5,
        };
        const after: Bar = {
            time: Date.parse('2026-10-14T20:00:00Z') / 1000,
            open: 1,
            high: 2,
            low: 1,
            close: 1,
            volume: 5,
        };
        const lastBandCall = () =>
            vi.mocked(useExtendedSessionBand).mock.calls.at(-1)!;

        it('총 거래량 시리즈에 음영 구간(프리·애프터 두 구간)을 붙인다', () => {
            render(
                <VolumeChart
                    bars={mockBars}
                    extendedBars={[pre, after]}
                    timeframe="5Min"
                    buySellVolume={mockBuySellVolume}
                />
            );
            const [seriesRef, ranges] = lastBandCall();
            expect(seriesRef).toBe(lifecycleRefs.totalSeriesRef);
            expect(ranges).toEqual([
                { session: 'pre', startTime: pre.time, endTime: pre.time },
                {
                    session: 'after',
                    startTime: after.time,
                    endTime: after.time,
                },
            ]);
        });

        it.each([
            [
                '시간외 봉이 없으면',
                { extendedBars: [] as Bar[], timeframe: '5Min' as const },
            ],
            [
                '타임프레임을 모르면',
                { extendedBars: [pre], timeframe: undefined },
            ],
            ['일봉이면', { extendedBars: [pre], timeframe: '1Day' as const }],
        ])('%s 구간이 비어 있다', (_label, props) => {
            render(
                <VolumeChart
                    bars={mockBars}
                    buySellVolume={mockBuySellVolume}
                    {...props}
                />
            );
            expect(lastBandCall()[1]).toEqual([]);
        });

        it('시간외 봉과 갱신 래퍼를 거래량 데이터 훅에 넘긴다', () => {
            const runDataUpdate = vi.fn();
            render(
                <VolumeChart
                    bars={mockBars}
                    extendedBars={[pre]}
                    timeframe="5Min"
                    runDataUpdate={runDataUpdate}
                    buySellVolume={mockBuySellVolume}
                />
            );
            expect(vi.mocked(useVolumeChartData)).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    bars: mockBars,
                    extendedBars: [pre],
                    runUpdate: runDataUpdate,
                })
            );
        });
    });
});
