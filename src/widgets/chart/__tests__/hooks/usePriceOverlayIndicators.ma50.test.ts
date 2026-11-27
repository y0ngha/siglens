// @vitest-environment jsdom
/**
 * 차트 50일선(N43-b) — core가 내지 않는 MA50이 메뉴에 뜨고, 켜면 봉으로 계산한 값이 선과
 * 범례에 같은 값으로 실리는지 실제 훅 조합(`withChartOnlyMaPeriods` → `usePriceOverlayIndicators`
 * → `useMAOverlay`)으로 확인한다. 차트 라이브러리만 목이다 — 브라우저 렌더(pageerror)는
 * 여기서 보지 않는다.
 */
import { act, renderHook } from '@testing-library/react';
import {
    EMPTY_INDICATOR_RESULT,
    calculateMA,
    type Bar,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import type { IChartApi } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { usePriceOverlayIndicators } from '../../hooks/usePriceOverlayIndicators';
import { withChartOnlyMaPeriods } from '../../utils/chartMaPeriods';

vi.mock('lightweight-charts', () => ({
    LineSeries: 'LineSeries',
    LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3 },
}));

interface FakeSeries {
    options: Record<string, unknown>;
    setData: ReturnType<typeof vi.fn>;
    applyOptions: ReturnType<typeof vi.fn>;
}

function makeChart() {
    const series: FakeSeries[] = [];
    const chart = {
        addSeries: vi.fn((_type: unknown, options: Record<string, unknown>) => {
            const s: FakeSeries = {
                options,
                setData: vi.fn(),
                applyOptions: vi.fn(),
            };
            series.push(s);
            return s;
        }),
        removeSeries: vi.fn(),
    };
    return { chart, series };
}

const bars: Bar[] = Array.from({ length: 80 }, (_, i) => ({
    time: 1_700_000_000 + i * 86_400,
    open: 100 + i,
    high: 100 + i,
    low: 100 + i,
    close: 100 + i,
    volume: 1000,
}));

const coreIndicators: IndicatorResult = {
    ...EMPTY_INDICATOR_RESULT,
    ma: { 20: calculateMA(bars, 20) },
};

describe('usePriceOverlayIndicators — 50일선', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('MA 메뉴에 50일선이 core 기본 기간과 함께 뜬다', () => {
        const { chart } = makeChart();
        const { result } = renderHook(() =>
            usePriceOverlayIndicators(
                {
                    chartRef: { current: chart as unknown as IChartApi },
                    bars,
                    indicators: withChartOnlyMaPeriods(coreIndicators, bars),
                    lineWidth: 1,
                },
                bars.at(-1)?.time
            )
        );
        expect(result.current.bindingOverrides.ma?.availablePeriods).toEqual([
            5, 20, 50, 60, 120, 200,
        ]);
    });

    it('50일선을 켜면 period10 색 선이 봉으로 계산한 값으로 그려지고, 범례도 같은 값을 읽는다', () => {
        const { chart, series } = makeChart();
        const indicators = withChartOnlyMaPeriods(coreIndicators, bars);
        const { result } = renderHook(() =>
            usePriceOverlayIndicators(
                {
                    chartRef: { current: chart as unknown as IChartApi },
                    bars,
                    indicators,
                    lineWidth: 1,
                },
                bars.at(-1)?.time
            )
        );

        act(() => {
            result.current.bindingOverrides.ma?.onTogglePeriod?.(50);
        });

        const ma50 = series.find(
            s => s.options['color'] === CHART_COLORS.period10
        );
        expect(ma50).toBeDefined();
        // 마지막 봉의 값은 마지막 50개 종가 130..179의 평균.
        expect(ma50?.setData).toHaveBeenLastCalledWith(
            expect.arrayContaining([
                { time: bars.at(-1)?.time, value: expect.closeTo(154.5, 10) },
            ])
        );

        const legend = result.current.labelConfigs.find(
            c => c.name === 'MA(50)'
        );
        expect(legend?.color).toBe(CHART_COLORS.period10);
        expect(legend?.getValue(indicators, bars.length - 1)).toBeCloseTo(
            154.5,
            10
        );
    });
});
