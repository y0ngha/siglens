import { render, screen } from '@testing-library/react';
import type { Bar, BuySellVolumeResult } from '@y0ngha/siglens-core';
import { VolumeChart } from '@/widgets/chart/VolumeChart';

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
}));

vi.mock('@/widgets/chart/hooks/usePaneLabels', () => ({
    usePaneLabels: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useVolumeChartData', () => ({
    useVolumeChartData: vi.fn(),
}));

vi.mock('@/widgets/chart/hooks/useVolumeChartLifecycle', () => ({
    useVolumeChartLifecycle: () => ({
        chartRef: { current: null },
        totalSeriesRef: { current: null },
        buySeriesRef: { current: null },
    }),
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
});
