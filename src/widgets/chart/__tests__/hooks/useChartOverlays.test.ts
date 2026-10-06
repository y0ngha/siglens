// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useChartOverlays } from '../../hooks/useChartOverlays';
import type { OverlayLineSpec } from '../../utils/chartOverlayUtils';

const mockRemoveSeries = vi.fn();
const mockCreateSeriesMarkers = vi.fn();

// 라벨 전용 시리즈가 메인 라인 시리즈와 **다른 객체**를 갖도록, 매 addSeries
// 호출마다 독립된 setData mock을 만든다 — 공유 mockSetData 하나만 두면 어느
// 호출이 라벨 시리즈로 간 데이터인지 구분할 수 없다.
const createdSeries: {
    setData: ReturnType<typeof vi.fn>;
    attachPrimitive: ReturnType<typeof vi.fn>;
    applyOptions: ReturnType<typeof vi.fn>;
}[] = [];
// 가격 → y좌표. 테스트마다 바꿔 라벨 겹침을 흉내 낸다(기본: 1원 = 10px, 위로 갈수록 작은 y).
let priceToY: (price: number) => number | null = price => 1000 - price * 10;
const mockAddSeries = vi.fn(() => {
    const series = {
        setData: vi.fn(),
        attachPrimitive: vi.fn(),
        applyOptions: vi.fn(),
        priceToCoordinate: (price: number) => priceToY(price),
    };
    createdSeries.push(series);
    return series;
});

vi.mock('lightweight-charts', () => ({
    LineSeries: 'LineSeries',
    LineStyle: { Solid: 0, Dashed: 1 },
    createSeriesMarkers: (...args: unknown[]) =>
        mockCreateSeriesMarkers(...args),
}));

const mockCreateRightExtend = vi.fn((opts: unknown) => ({ opts }));
vi.mock('../../utils/rightExtendPrimitive', () => ({
    createRightExtendPrimitive: (opts: unknown) => mockCreateRightExtend(opts),
}));

const timeScale = {
    subscribeVisibleLogicalRangeChange: vi.fn(),
    unsubscribeVisibleLogicalRangeChange: vi.fn(),
    subscribeSizeChange: vi.fn(),
    unsubscribeSizeChange: vi.fn(),
};
const chartElement = document.createElement('div');
const frames: FrameRequestCallback[] = [];
/** 예약된 프레임을 실행한다 — 브라우저처럼 예약 호출이 끝난 뒤에 돈다. */
function flushFrames() {
    for (const cb of frames.splice(0)) cb(0);
}

function makeChart() {
    return {
        addSeries: mockAddSeries,
        removeSeries: mockRemoveSeries,
        timeScale: () => timeScale,
        chartElement: () => chartElement,
        options: () => ({ layout: { fontSize: 12 } }),
    };
}

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useChartOverlays
    >[0]['chartRef'];
}

const SPEC: OverlayLineSpec = {
    paneIndex: 0,
    points: [
        { time: 1, value: 10 },
        { time: 3, value: 12 },
    ],
    color: '#42a5f5',
    dashed: false,
    opacity: 1,
    lineWidthMult: 1,
    title: '',
    labelPriority: 0,
    markers: [],
    extendRight: false,
};

describe('useChartOverlays', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createdSeries.length = 0;
        priceToY = price => 1000 - price * 10;
        frames.length = 0;
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
            frames.push(cb);
            return frames.length;
        });
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    });

    it('does nothing when chart is null', () => {
        renderHook(() =>
            useChartOverlays({ chartRef: makeChartRef(null), specs: [SPEC] })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('attaches the right-extend primitive only to extendRight specs', () => {
        renderHook(() =>
            useChartOverlays({
                chartRef: makeChartRef(makeChart()),
                specs: [SPEC, { ...SPEC, extendRight: true, dashed: true }],
            })
        );
        expect(createdSeries[0]!.attachPrimitive).not.toHaveBeenCalled();
        expect(createdSeries[1]!.attachPrimitive).toHaveBeenCalledTimes(1);
        expect(mockCreateRightExtend).toHaveBeenCalledWith({
            startTime: 3,
            price: 12,
            color: '#42a5f5',
            lineWidth: 1,
            dashed: true,
        });
    });

    it('creates one series per spec and sets its points', () => {
        renderHook(() =>
            useChartOverlays({
                chartRef: makeChartRef(makeChart()),
                specs: [SPEC, { ...SPEC }],
            })
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
        expect(createdSeries[0]!.setData).toHaveBeenCalledWith([
            { time: 1, value: 10 },
            { time: 3, value: 12 },
        ]);
    });

    it('creates a second transparent label series with markers when a spec carries labels', () => {
        const withLabel: OverlayLineSpec = {
            ...SPEC,
            markers: [{ time: 3, position: 'aboveBar', text: 'H', price: 12 }],
        };
        renderHook(() =>
            useChartOverlays({
                chartRef: makeChartRef(makeChart()),
                specs: [withLabel],
            })
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
        expect(mockCreateSeriesMarkers).toHaveBeenCalledTimes(1);
        const [, markers] = mockCreateSeriesMarkers.mock.calls[0]!;
        expect(markers).toEqual([
            expect.objectContaining({
                time: 3,
                position: 'aboveBar',
                text: 'H',
            }),
        ]);
    });

    it('label series receives strictly ascending unique times while markers keep every marker, including a same-time duplicate and unsorted input', () => {
        const withDupAndUnsorted: OverlayLineSpec = {
            ...SPEC,
            // 일부러 시각 역순 + 같은 시각(3) 마커 2개를 준다 — 훅이 정렬 후
            // 중복을 걷어내야 한다.
            markers: [
                { time: 5, position: 'aboveBar', text: 'RS', price: 20 },
                { time: 1, position: 'belowBar', text: 'LS', price: 5 },
                { time: 3, position: 'aboveBar', text: 'H-high', price: 12 },
                { time: 3, position: 'belowBar', text: 'H-low', price: 8 },
            ],
        };
        renderHook(() =>
            useChartOverlays({
                chartRef: makeChartRef(makeChart()),
                specs: [withDupAndUnsorted],
            })
        );

        // 라인 시리즈(0번) 다음이 라벨 시리즈(1번) — 그 setData가 시각 오름차순
        // + 중복 시각 제거된 point 배열을 받아야 한다.
        const labelSeries = createdSeries[1]!;
        expect(labelSeries.setData).toHaveBeenCalledWith([
            { time: 1, value: 5 },
            { time: 3, value: 12 },
            { time: 5, value: 20 },
        ]);

        // 마커는 dedup 대상이 아니다 — 같은 시각(3)에 둘 다 살아 있어야 한다.
        const [, markers] = mockCreateSeriesMarkers.mock.calls[0]!;
        expect(markers).toHaveLength(4);
        expect(markers.map((m: { time: number }) => m.time)).toEqual([
            1, 3, 3, 5,
        ]);
    });

    it('removes all created series on unmount', () => {
        const { unmount } = renderHook(() =>
            useChartOverlays({
                chartRef: makeChartRef(makeChart()),
                specs: [SPEC],
            })
        );
        unmount();
        expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
    });

    it('removes the previous series and recreates when specs change', () => {
        const chart = makeChart();
        const { rerender } = renderHook(
            ({ specs }: { specs: OverlayLineSpec[] }) =>
                useChartOverlays({ chartRef: makeChartRef(chart), specs }),
            { initialProps: { specs: [SPEC] } }
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(1);

        rerender({ specs: [SPEC, { ...SPEC }] });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
        expect(mockAddSeries).toHaveBeenCalledTimes(3);
    });
    describe('레벨 라벨 겹침', () => {
        const level = (
            title: string,
            price: number,
            labelPriority: number
        ): OverlayLineSpec => ({
            ...SPEC,
            points: [
                { time: 1, value: price },
                { time: 3, value: price },
            ],
            title,
            labelPriority,
            extendRight: true,
        });
        const titleOf = (i: number) =>
            createdSeries[i]!.applyOptions.mock.calls.at(-1)?.[0]?.title;

        it('겹치지 않는 라벨은 작도가 많아도 그대로 둔다', () => {
            renderHook(() =>
                useChartOverlays({
                    chartRef: makeChartRef(makeChart()),
                    specs: [
                        level('A 목표', 50, 1),
                        level('B 무효화', 40, 1),
                        level('C 돌파', 30, 2),
                        level('D 목표', 20, 1),
                    ],
                })
            );
            flushFrames();
            for (const s of createdSeries) {
                expect(s.applyOptions).not.toHaveBeenCalled();
            }
        });

        it('겹치면 우선순위가 낮은 라벨만 숨긴다', () => {
            renderHook(() =>
                useChartOverlays({
                    chartRef: makeChartRef(makeChart()),
                    // 1원 = 10px → 0.5원 차이 = 5px로 겹친다.
                    specs: [
                        level('A 무효화', 17.1, 1),
                        level('B 돌파', 17.2, 2),
                    ],
                })
            );
            flushFrames();
            expect(titleOf(0)).toBe('');
            expect(createdSeries[1]!.applyOptions).not.toHaveBeenCalled();
        });

        it('범위가 바뀌어 더는 겹치지 않으면 숨긴 라벨을 되살린다', () => {
            renderHook(() =>
                useChartOverlays({
                    chartRef: makeChartRef(makeChart()),
                    specs: [
                        level('A 무효화', 17.1, 1),
                        level('B 돌파', 17.2, 2),
                    ],
                })
            );
            flushFrames();
            expect(titleOf(0)).toBe('');

            priceToY = price => 10000 - price * 1000;
            const onRange = timeScale.subscribeVisibleLogicalRangeChange.mock
                .calls[0]![0] as () => void;
            onRange();
            flushFrames();
            expect(titleOf(0)).toBe('A 무효화');
        });

        it('가격축 드래그·휠(pointerup·wheel)로도 다시 판정한다', () => {
            renderHook(() =>
                useChartOverlays({
                    chartRef: makeChartRef(makeChart()),
                    specs: [
                        level('A 무효화', 17.1, 1),
                        level('B 돌파', 17.2, 2),
                    ],
                })
            );
            flushFrames();
            expect(titleOf(0)).toBe('');

            priceToY = price => 10000 - price * 1000;
            chartElement.dispatchEvent(new Event('pointerup'));
            flushFrames();
            expect(titleOf(0)).toBe('A 무효화');

            priceToY = price => 1000 - price * 10;
            chartElement.dispatchEvent(new Event('wheel'));
            flushFrames();
            expect(titleOf(0)).toBe('');
        });

        it('언마운트하면 DOM 리스너를 떼고 예약된 프레임을 취소한다', () => {
            const removeSpy = vi.spyOn(chartElement, 'removeEventListener');
            const { unmount } = renderHook(() =>
                useChartOverlays({
                    chartRef: makeChartRef(makeChart()),
                    specs: [level('A 목표', 50, 1)],
                })
            );
            // 첫 판정 프레임이 아직 돌지 않은 상태로 언마운트한다.
            unmount();
            expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
            const removed = removeSpy.mock.calls.map(([type]) => type);
            expect(removed).toEqual(
                expect.arrayContaining(['pointerup', 'wheel', 'dblclick'])
            );
            removeSpy.mockRestore();
        });

        it('언마운트하면 구독을 푼다', () => {
            const { unmount } = renderHook(() =>
                useChartOverlays({
                    chartRef: makeChartRef(makeChart()),
                    specs: [level('A 목표', 50, 1)],
                })
            );
            unmount();
            expect(
                timeScale.unsubscribeVisibleLogicalRangeChange
            ).toHaveBeenCalledWith(
                timeScale.subscribeVisibleLogicalRangeChange.mock.calls[0]![0]
            );
            expect(timeScale.unsubscribeSizeChange).toHaveBeenCalled();
        });
    });
});
