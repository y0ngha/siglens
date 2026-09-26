import { render, screen } from '@testing-library/react';
import type { Bar } from '@y0ngha/siglens-core';
import { ShareCandlestickChart } from '@/widgets/chart/ShareCandlestickChart';

// lightweight-charts uses canvas internally — jsdom can't run it, so we mock.
const {
    mockSetData,
    mockFitContent,
    mockAddSeries,
    mockRemove,
    mockApplyOptions,
    mockChart,
} = vi.hoisted(() => {
    const mockSetData = vi.fn();
    const mockFitContent = vi.fn();
    const mockAddSeries = vi.fn(() => ({ setData: mockSetData }));
    const mockRemove = vi.fn();
    const mockApplyOptions = vi.fn();
    const mockChart = {
        addSeries: mockAddSeries,
        timeScale: () => ({ fitContent: mockFitContent }),
        remove: mockRemove,
        applyOptions: mockApplyOptions,
    };
    return {
        mockSetData,
        mockFitContent,
        mockAddSeries,
        mockRemove,
        mockApplyOptions,
        mockChart,
    };
});

vi.mock('lightweight-charts', () => ({
    createChart: vi.fn(() => mockChart),
    CandlestickSeries: 'CandlestickSeries',
    CrosshairMode: { Hidden: 2 },
}));

vi.mock('@/shared/lib/chartColors', () => ({
    CHART_COLORS: {
        bullish: '#26a69a',
        bearish: '#ef5350',
    },
    getChartChrome: () => ({
        background: '#1a1a2e',
        grid: '#2a2a3e',
        text: '#a0a0b0',
    }),
}));

const mockBars: Bar[] = [
    { time: 100, open: 10, high: 15, low: 9, close: 12, volume: 1000 },
    { time: 200, open: 12, high: 18, low: 11, close: 15, volume: 1200 },
];

describe('ShareCandlestickChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state message when bars is empty', () => {
        render(<ShareCandlestickChart bars={[]} />);

        expect(screen.getByText('차트 데이터가 없습니다')).toBeInTheDocument();
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates a candlestick series with bull/bear colors', () => {
        render(<ShareCandlestickChart bars={mockBars} />);

        expect(mockAddSeries).toHaveBeenCalledWith(
            'CandlestickSeries',
            expect.objectContaining({
                upColor: '#26a69a',
                downColor: '#ef5350',
            })
        );
    });

    it('sets candlestick data derived from the bars once on mount', () => {
        render(<ShareCandlestickChart bars={mockBars} />);

        expect(mockSetData).toHaveBeenCalledTimes(1);
        const data = mockSetData.mock.calls[0]?.[0];
        expect(data).toHaveLength(2);
        expect(data[0]).toMatchObject({ time: 100, open: 10, close: 12 });
    });

    it('fits the time scale after setting data', () => {
        render(<ShareCandlestickChart bars={mockBars} />);

        expect(mockFitContent).toHaveBeenCalled();
    });

    it('renders chart container with role="img" and generic aria-label by default', () => {
        render(<ShareCandlestickChart bars={mockBars} />);

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            '스냅샷 가격 차트'
        );
    });

    it('renders ticker-specific aria-label when ticker is provided', () => {
        render(<ShareCandlestickChart bars={mockBars} ticker="AAPL" />);

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            'AAPL 스냅샷 캔들 차트'
        );
    });

    it('uses generic aria-label when ticker is empty string', () => {
        render(<ShareCandlestickChart bars={mockBars} ticker="" />);

        expect(screen.getByRole('img')).toHaveAttribute(
            'aria-label',
            '스냅샷 가격 차트'
        );
    });

    it('does not react to bar changes after mount — snapshot stays immutable', () => {
        const { rerender } = render(<ShareCandlestickChart bars={mockBars} />);
        expect(mockSetData).toHaveBeenCalledTimes(1);

        const newBars: Bar[] = [
            ...mockBars,
            { time: 300, open: 15, high: 20, low: 14, close: 18, volume: 900 },
        ];
        rerender(<ShareCandlestickChart bars={newBars} />);

        // 마운트 시점 스냅샷을 그대로 쓴다 — 새 bars가 들어와도 다시 그리지 않는다.
        expect(mockSetData).toHaveBeenCalledTimes(1);
    });

    it('removes the chart and clears refs on unmount', () => {
        const { unmount } = render(<ShareCandlestickChart bars={mockBars} />);

        unmount();

        expect(mockApplyOptions).toHaveBeenCalledWith({ autoSize: false });
        expect(mockRemove).toHaveBeenCalled();
    });
});
