// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, CandlePatternEntry } from '@y0ngha/siglens-core';
import { useCandlePatternMarkers } from '../../hooks/useCandlePatternMarkers';

const mockSetMarkers = vi.fn();
const mockDetach = vi.fn();
const mockCreateSeriesMarkers = vi.fn(
    (_series: unknown, _markers: unknown) => ({
        setMarkers: mockSetMarkers,
        detach: mockDetach,
    })
);

vi.mock('lightweight-charts', () => ({
    createSeriesMarkers: (series: unknown, markers: unknown) =>
        mockCreateSeriesMarkers(series, markers),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    detectCandlePatternEntries: vi.fn(() => []),
    getDetectionBars: vi.fn((bars: Bar[]) => bars),
    selectLastCandlePatternEntries: vi.fn((entries: unknown[]) => entries),
    getCandlePatternLabel: vi.fn(() => 'Pattern'),
    getMultiCandlePatternLabel: vi.fn(() => 'MultiPattern'),
    getMultiPatternTrend: vi.fn(() => 'bullish'),
    getSinglePatternTrend: vi.fn(() => 'bearish'),
}));

import {
    detectCandlePatternEntries,
    getMultiPatternTrend,
    getSinglePatternTrend,
} from '@y0ngha/siglens-core';

function makeSeriesRef(series: unknown = null) {
    return { current: series } as Parameters<
        typeof useCandlePatternMarkers
    >[0]['seriesRef'];
}

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
    { time: 2000, open: 105, high: 115, low: 95, close: 110, volume: 1200 },
];

describe('useCandlePatternMarkers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(detectCandlePatternEntries).mockReturnValue([]);
        vi.mocked(getSinglePatternTrend).mockReturnValue('bearish');
        vi.mocked(getMultiPatternTrend).mockReturnValue('bullish');
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef(),
                bars: [],
            })
        );

        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible', () => {
        const { result } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef(),
                bars: [],
            })
        );

        act(() => {
            result.current.toggle();
        });
        expect(result.current.isVisible).toBe(true);
    });

    it('creates series markers plugin when seriesRef has value', () => {
        renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef({}),
                bars: FAKE_BARS,
            })
        );

        expect(mockCreateSeriesMarkers).toHaveBeenCalled();
    });

    it('does not create markers plugin when seriesRef is null', () => {
        renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef(null),
                bars: FAKE_BARS,
            })
        );

        expect(mockCreateSeriesMarkers).not.toHaveBeenCalled();
    });

    it('sets empty markers when not visible', () => {
        renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef({}),
                bars: FAKE_BARS,
            })
        );

        expect(mockSetMarkers).toHaveBeenCalledWith([]);
    });

    it('detaches plugin on unmount', () => {
        const { unmount } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef({}),
                bars: FAKE_BARS,
            })
        );

        unmount();

        expect(mockDetach).toHaveBeenCalled();
    });

    /**
     * `isVisible`이 true일 때만 `setMarkers`가 **실제 마커**(빈 배열이 아님)를
     * 받는지 본다. single/multi 두 패턴 타입 모두 감지되고, 각 트렌드
     * (bullish/bearish/neutral)가 올바른 화살표 위치·모양·색으로 매핑되는지까지
     * 확인 — `toggle`만 스파이하면 매핑 버그(예: bearish에 belowBar 배치)를
     * 놓친다.
     */
    it('마커 표시 시 single/multi 패턴을 화면 좌표(position/shape/color)로 매핑한다', () => {
        const entries: CandlePatternEntry[] = [
            { barIndex: 0, patternType: 'single', singlePattern: 'doji' },
            { barIndex: 1, patternType: 'multi', multiPattern: 'engulfing' },
        ] as unknown as CandlePatternEntry[];
        vi.mocked(detectCandlePatternEntries).mockReturnValue(entries);
        vi.mocked(getSinglePatternTrend).mockReturnValue('bearish');
        vi.mocked(getMultiPatternTrend).mockReturnValue('bullish');

        const { result } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef({}),
                bars: FAKE_BARS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        const markers = mockSetMarkers.mock.calls.at(-1)?.[0];
        expect(markers).toHaveLength(2);
        // single(bearish) → 캔들 위, 하락 화살표, bearish 색
        expect(markers[0]).toMatchObject({
            time: 1000,
            position: 'aboveBar',
            shape: 'arrowDown',
            text: 'Pattern',
        });
        // multi(bullish) → 캔들 아래, 상승 화살표
        expect(markers[1]).toMatchObject({
            time: 2000,
            position: 'belowBar',
            shape: 'arrowUp',
            text: 'MultiPattern',
        });
    });

    it('neutral 트렌드는 원형 마커로 매핑한다', () => {
        const entries: CandlePatternEntry[] = [
            { barIndex: 0, patternType: 'single', singlePattern: 'doji' },
        ] as unknown as CandlePatternEntry[];
        vi.mocked(detectCandlePatternEntries).mockReturnValue(entries);
        vi.mocked(getSinglePatternTrend).mockReturnValue('neutral');

        const { result } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef({}),
                bars: FAKE_BARS,
            })
        );

        act(() => {
            result.current.toggle();
        });

        const markers = mockSetMarkers.mock.calls.at(-1)?.[0];
        expect(markers[0]).toMatchObject({
            position: 'aboveBar',
            shape: 'circle',
        });
    });

    it('toggle을 다시 끄면 표시 중이던 마커를 빈 배열로 되돌린다', () => {
        const entries: CandlePatternEntry[] = [
            { barIndex: 0, patternType: 'single', singlePattern: 'doji' },
        ] as unknown as CandlePatternEntry[];
        vi.mocked(detectCandlePatternEntries).mockReturnValue(entries);

        const { result } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef({}),
                bars: FAKE_BARS,
            })
        );

        act(() => result.current.toggle());
        expect(mockSetMarkers.mock.calls.at(-1)?.[0]).toHaveLength(1);

        act(() => result.current.toggle());
        expect(mockSetMarkers.mock.calls.at(-1)?.[0]).toEqual([]);
    });

    it('provides stable toggle reference', () => {
        const { result, rerender } = renderHook(() =>
            useCandlePatternMarkers({
                seriesRef: makeSeriesRef(),
                bars: [],
            })
        );

        const firstToggle = result.current.toggle;
        rerender();
        expect(result.current.toggle).toBe(firstToggle);
    });
});
