import { act, render, screen } from '@testing-library/react';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { FEAR_GREED_CHART_HEIGHT } from '@/widgets/fear-greed/constants';
import { LazyFearGreedHistoricalChart } from '@/widgets/fear-greed/LazyFearGreedHistoricalChart';

// 실제 차트는 lightweight-charts(캔버스)라 jsdom에서 못 그린다.
const { chartMounts } = vi.hoisted(() => ({
    chartMounts: vi.fn(),
}));
vi.mock('@/widgets/fear-greed/FearGreedHistoricalChart', () => ({
    FearGreedHistoricalChart: (props: { history: unknown[] }) => {
        chartMounts(props.history.length);
        return <div data-testid="chart" />;
    },
}));

const HISTORY: FearGreedHistoryPoint[] = [
    { date: '2026-01-01', score: 50, label: 'NEUTRAL' },
    { date: '2026-01-02', score: 55, label: 'GREED' },
];

describe('LazyFearGreedHistoricalChart', () => {
    it('차트가 도착하기 전에 같은 높이의 자리(aria-hidden)를 먼저 그린다', () => {
        const { container } = render(
            <LazyFearGreedHistoricalChart history={HISTORY} />
        );

        const placeholder = container.querySelector<HTMLElement>(
            '[aria-hidden="true"]'
        );
        expect(placeholder).not.toBeNull();
        expect(placeholder?.style.height).toBe(`${FEAR_GREED_CHART_HEIGHT}px`);
        expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
    });

    it('차트가 도착하면 받은 기록을 그대로 넘겨 그린다', async () => {
        chartMounts.mockClear();
        render(<LazyFearGreedHistoricalChart history={HISTORY} />);

        await act(async () => {
            await Promise.resolve();
        });

        expect(await screen.findByTestId('chart')).toBeInTheDocument();
        expect(chartMounts).toHaveBeenCalledWith(HISTORY.length);
    });
});
