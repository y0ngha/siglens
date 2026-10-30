import { render } from '@testing-library/react';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { createChart, LineSeries } from 'lightweight-charts';
import { FEAR_GREED_CHART_HEIGHT } from '@/widgets/fear-greed/constants';
import { useFearGreedLineChart } from '@/widgets/fear-greed/hooks/useFearGreedLineChart';
import { toLineData } from '@/widgets/fear-greed/utils/toLineData';

// lightweight-charts는 canvas를 쓴다 — jsdom에서 돌지 않으므로 이 위젯의 차트 테스트처럼 목으로 바꾼다.
const { mockSetData, mockFitContent, mockAddSeries, mockRemove, mockChart } =
    vi.hoisted(() => {
        const mockSetData = vi.fn();
        const mockFitContent = vi.fn();
        const mockAddSeries = vi.fn(() => ({ setData: mockSetData }));
        const mockRemove = vi.fn();
        const mockChart = {
            addSeries: mockAddSeries,
            timeScale: () => ({ fitContent: mockFitContent }),
            remove: mockRemove,
            applyOptions: vi.fn(),
        };
        return {
            mockSetData,
            mockFitContent,
            mockAddSeries,
            mockRemove,
            mockChart,
        };
    });

vi.mock('@/shared/i18n/useResolvedLocale', () => ({
    useResolvedLocale: () => 'ko',
}));

vi.mock('lightweight-charts', () => ({
    createChart: vi.fn(() => mockChart),
    LineSeries: 'LineSeries',
    TickMarkType: {
        Year: 0,
        Month: 1,
        DayOfMonth: 2,
        Time: 3,
        TimeWithSeconds: 4,
    },
}));

/** 훅이 돌려준 ref를 실제 `div`에 붙인다 — 붙지 않으면 차트를 만들지 않는다. */
function Harness({ history }: { history: FearGreedHistoryPoint[] }) {
    const ref = useFearGreedLineChart(history);
    return <div ref={ref} />;
}

const FIRST: FearGreedHistoryPoint[] = [
    { date: '2026-01-02', score: null, label: null },
    { date: '2026-01-03', score: 50, label: 'NEUTRAL' },
];
const NEXT: FearGreedHistoryPoint[] = [
    ...FIRST,
    { date: '2026-01-04', score: 62, label: 'GREED' },
];

describe('useFearGreedLineChart', () => {
    beforeEach(() => {
        vi.mocked(createChart).mockClear();
        mockSetData.mockClear();
        mockFitContent.mockClear();
        mockAddSeries.mockClear();
        mockRemove.mockClear();
    });

    it('붙은 컨테이너에 공용 높이 상수로 차트를 한 번 만든다', () => {
        render(<Harness history={FIRST} />);
        expect(createChart).toHaveBeenCalledTimes(1);
        expect(createChart).toHaveBeenCalledWith(
            expect.any(HTMLDivElement),
            expect.objectContaining({
                height: FEAR_GREED_CHART_HEIGHT,
                autoSize: true,
            })
        );
        expect(mockAddSeries).toHaveBeenCalledWith(
            LineSeries,
            expect.objectContaining({ lineWidth: 1 })
        );
    });

    it('history를 선 데이터로 바꿔 그리고 화면에 맞춘다', () => {
        render(<Harness history={FIRST} />);
        expect(mockSetData).toHaveBeenCalledWith([
            { time: '2026-01-03', value: 50 },
        ]);
        expect(mockFitContent).toHaveBeenCalledTimes(1);
    });

    it('history가 바뀌면 차트를 다시 만들지 않고 데이터만 갈아 끼운다', () => {
        const { rerender } = render(<Harness history={FIRST} />);
        rerender(<Harness history={NEXT} />);
        expect(createChart).toHaveBeenCalledTimes(1);
        expect(mockSetData).toHaveBeenLastCalledWith(toLineData(NEXT));
        expect(mockSetData).toHaveBeenLastCalledWith([
            { time: '2026-01-03', value: 50 },
            { time: '2026-01-04', value: 62 },
        ]);
    });

    it('언마운트하면 차트를 제거한다', () => {
        const { unmount } = render(<Harness history={FIRST} />);
        unmount();
        expect(mockRemove).toHaveBeenCalledTimes(1);
    });
});
