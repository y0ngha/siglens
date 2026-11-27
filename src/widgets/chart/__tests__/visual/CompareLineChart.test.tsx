import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareLineChart } from '@/widgets/chart/visual/CompareLineChart';
import ko from '../../../../../messages/ko.json';
import { COMPARE } from './fixtures';

const m = vi.hoisted(() => {
    const crosshair: { current: ((p: unknown) => void) | null } = {
        current: null,
    };
    const lines = new Map<
        number,
        {
            setData: ReturnType<typeof vi.fn>;
            createPriceLine: ReturnType<typeof vi.fn>;
        }
    >();
    const chart = {
        addSeries: vi.fn(() => {
            const line = { setData: vi.fn(), createPriceLine: vi.fn() };
            lines.set(lines.size, line);
            return line;
        }),
        timeScale: () => ({ fitContent: vi.fn() }),
        subscribeCrosshairMove: vi.fn((cb: (p: unknown) => void) => {
            crosshair.current = cb;
        }),
        unsubscribeCrosshairMove: vi.fn(),
        applyOptions: vi.fn(),
        remove: vi.fn(),
    };
    return { chart, lines, crosshair, createChart: vi.fn(() => chart) };
});

vi.mock('lightweight-charts', () => ({
    createChart: m.createChart,
    LineSeries: 'LineSeries',
    LineStyle: { Dashed: 2 },
}));

function mount() {
    return render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            <CompareLineChart block={COMPARE} />
        </NextIntlClientProvider>
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    m.lines.clear();
    m.crosshair.current = null;
});

describe('CompareLineChart', () => {
    it('종목마다 선 하나를 서로 다른 색으로 그리고 점은 [시각, 수익률]이다', () => {
        mount();
        expect(m.lines.size).toBe(2);
        const colors = m.chart.addSeries.mock.calls.map(
            call => (call as unknown as [string, { color: string }])[1].color
        );
        expect(new Set(colors).size).toBe(2);
        expect(m.lines.get(0)?.setData).toHaveBeenCalledWith([
            { time: 1_760_000_000, value: 0 },
            { time: 1_760_086_400, value: 12.3 },
        ]);
    });

    it('0% 기준선을 한 번 건다', () => {
        mount();
        const calls = [...m.lines.values()].flatMap(
            l => l.createPriceLine.mock.calls
        );
        expect(calls).toHaveLength(1);
        expect(calls[0]?.[0]).toMatchObject({ price: 0 });
    });

    it('범례는 마지막 수익률을 보이고 크로스헤어가 가리키는 값으로 바뀐다', () => {
        mount();
        expect(screen.getByText('+12.3%')).toBeInTheDocument();
        expect(screen.getByText('-4.5%')).toBeInTheDocument();
        const nvdaLine = m.lines.get(0);
        const amdLine = m.lines.get(1);
        act(() =>
            m.crosshair.current?.({
                time: 1_760_000_000,
                seriesData: new Map([
                    [nvdaLine, { value: 3.2 }],
                    [amdLine, { value: -1 }],
                ]),
            })
        );
        expect(screen.getByText('+3.2%')).toBeInTheDocument();
        expect(screen.getByText('-1.0%')).toBeInTheDocument();
        act(() =>
            m.crosshair.current?.({ time: undefined, seriesData: new Map() })
        );
        expect(screen.getByText('+12.3%')).toBeInTheDocument();
    });

    it('언마운트하면 구독을 끊고 차트를 지운다', () => {
        const { unmount } = mount();
        unmount();
        expect(m.chart.unsubscribeCrosshairMove).toHaveBeenCalledTimes(1);
        expect(m.chart.remove).toHaveBeenCalledTimes(1);
    });
});
