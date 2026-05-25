import { render } from '@testing-library/react';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { FearGreedHistoricalChart } from '@/widgets/chart/FearGreedHistoricalChart';

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

// `virtual: true` is required because lightweight-charts is ESM-only
// (`"type": "module"`, no CJS export). Jest's CJS resolver can't find it
// from this test file, even though we never call the real module.
vi.mock('lightweight-charts', () => ({
    createChart: vi.fn(() => mockChart),
    LineSeries: 'LineSeries',
}));

const history: FearGreedHistoryPoint[] = [
    { date: '2026-01-01', score: null, label: null },
    { date: '2026-01-02', score: null, label: null },
    { date: '2026-01-03', score: 50, label: 'NEUTRAL' },
    { date: '2026-01-04', score: 60, label: 'GREED' },
];

describe('FearGreedHistoricalChart', () => {
    beforeEach(() => {
        mockSetData.mockClear();
        mockFitContent.mockClear();
        mockAddSeries.mockClear();
        mockRemove.mockClear();
        mockApplyOptions.mockClear();
    });

    it('creates a line series and sets data filtered to non-null scores', () => {
        render(<FearGreedHistoricalChart history={history} />);
        expect(mockAddSeries).toHaveBeenCalledTimes(1);
        // Warm-up entries (score === null) are filtered out — only 2 valid points sent
        expect(mockSetData).toHaveBeenCalledWith([
            { time: '2026-01-03', value: 50 },
            { time: '2026-01-04', value: 60 },
        ]);
    });

    it('fits the time scale after setting data', () => {
        render(<FearGreedHistoricalChart history={history} />);
        expect(mockFitContent).toHaveBeenCalled();
    });

    it('removes the chart on unmount', () => {
        const { unmount } = render(
            <FearGreedHistoricalChart history={history} />
        );
        unmount();
        expect(mockRemove).toHaveBeenCalled();
    });
});
