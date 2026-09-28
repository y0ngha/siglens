// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useOverlayLegend } from '../../hooks/useOverlayLegend';
import type { OverlayLabelConfig } from '../../utils/overlayLabelUtils';

const mockSubscribeCrosshairMove = vi.fn();
const mockUnsubscribeCrosshairMove = vi.fn();

vi.mock('lightweight-charts', () => ({}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useOverlayLegend
    >[0]['chartRef'];
}

function makeChart() {
    return {
        subscribeCrosshairMove: mockSubscribeCrosshairMove,
        unsubscribeCrosshairMove: mockUnsubscribeCrosshairMove,
    };
}

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { time: 2000, open: 105, high: 115, low: 95, close: 110, volume: 1200 },
];

const INDICATORS = {
    ma: { 20: [100, 101] },
} as unknown as IndicatorResult;

const LABEL_CONFIGS: OverlayLabelConfig[] = [
    {
        name: 'MA(20)',
        color: '#eab308',
        getValue: (ind: IndicatorResult, i: number): number | null =>
            (ind.ma as Record<number, (number | null)[]>)[20]?.[i] ?? null,
    },
];

describe('useOverlayLegend', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns legend items with null values when bars are empty', () => {
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(),
                bars: [],
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(result.current).toHaveLength(1);
        expect(result.current[0].value).toBeNull();
    });

    it('returns legend items with last bar values by default', () => {
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(result.current).toHaveLength(1);
        expect(result.current[0].name).toBe('MA(20)');
        expect(result.current[0].value).toBe(101);
    });

    it('returns empty array when no label configs provided', () => {
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: [],
            })
        );

        expect(result.current).toEqual([]);
    });

    it('subscribes to crosshair move when chart exists', () => {
        renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(mockSubscribeCrosshairMove).toHaveBeenCalled();
    });

    it('does not subscribe when chart is null', () => {
        renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(mockSubscribeCrosshairMove).not.toHaveBeenCalled();
    });

    it('unsubscribes on unmount', () => {
        const { unmount } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        unmount();

        expect(mockUnsubscribeCrosshairMove).toHaveBeenCalled();
    });

    /**
     * crosshair 핸들러의 핵심 분기 — `param.time`이 숫자일 때는 해당 bar
     * index로 legend 값을 바꾸고, 시간 밖으로 나가면(마우스가 차트를 벗어나면
     * `param.time`이 `undefined`) 다시 마지막 bar 값으로 되돌아가야 한다.
     * 이전 테스트는 subscribe 호출 여부만 봤고 핸들러 자체를 실행한 적이 없다.
     */
    it('crosshair가 특정 시간을 가리키면 해당 bar의 legend 값을 반영한다', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        // 기본값: 마지막 bar(index 1) 값
        expect(result.current[0].value).toBe(101);

        const handler = mockSubscribeCrosshairMove.mock.calls[0]?.[0];
        act(() => {
            handler({ time: 1000 });
        });

        // index 0으로 이동 — MA(20)의 첫 값
        expect(result.current[0].value).toBe(100);
    });

    /**
     * 같은 bar index를 가리키는 동안(마우스가 같은 캔들 안에서만 움직일 때)
     * `setCrosshairIndex`가 함수형 업데이트에서 동일 값이면 이전 state를 그대로
     * 반환해 리렌더를 만들지 않는다 — dedup 분기. 값이 바뀌었을 때만 실제로
     * legend가 갱신되는지까지 함께 본다.
     */
    it('같은 bar를 가리키는 동안에는 legend 값이 그대로 유지된다', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        const handler = mockSubscribeCrosshairMove.mock.calls[0]?.[0];
        act(() => {
            handler({ time: 1000 });
        });
        expect(result.current[0].value).toBe(100);

        // 같은 시간을 다시 가리켜도(dedup) 값은 그대로다.
        act(() => {
            handler({ time: 1000 });
        });
        expect(result.current[0].value).toBe(100);
    });

    it('crosshair가 차트 이미 밖(time 없음)인 상태에서 다시 밖을 가리켜도 그대로다', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        const handler = mockSubscribeCrosshairMove.mock.calls[0]?.[0];
        // 처음부터 차트 밖(마운트 직후 마우스가 아직 안 들어온 상태)이면
        // crosshairIndex는 이미 null이므로 dedup 분기(prev === null)를 탄다.
        act(() => {
            handler({});
        });
        expect(result.current[0].value).toBe(101);
    });

    it('crosshair가 차트 밖으로 나가면(time 없음) 마지막 bar 값으로 되돌아간다', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        const handler = mockSubscribeCrosshairMove.mock.calls[0]?.[0];
        act(() => {
            handler({ time: 1000 });
        });
        expect(result.current[0].value).toBe(100);

        act(() => {
            handler({});
        });
        expect(result.current[0].value).toBe(101);
    });

    it('preserves color from label config', () => {
        const { result } = renderHook(() =>
            useOverlayLegend({
                chartRef: makeChartRef(),
                bars: FAKE_BARS,
                indicators: INDICATORS,
                labelConfigs: LABEL_CONFIGS,
            })
        );

        expect(result.current[0].color).toBe('#eab308');
    });
});
