// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, BuySellVolumeResult } from '@y0ngha/siglens-core';
import { useVolumeChartData } from '../../hooks/useVolumeChartData';

const mockTotalSetData = vi.fn();
const mockBuySetData = vi.fn();
const mockFitContent = vi.fn();

vi.mock('lightweight-charts', () => ({}));

function makeRefs(hasRefs: boolean) {
    const chart = hasRefs
        ? { timeScale: () => ({ fitContent: mockFitContent }) }
        : null;
    const totalSeries = hasRefs ? { setData: mockTotalSetData } : null;
    const buySeries = hasRefs ? { setData: mockBuySetData } : null;

    return {
        chartRef: { current: chart } as Parameters<
            typeof useVolumeChartData
        >[0]['chartRef'],
        totalSeriesRef: { current: totalSeries } as Parameters<
            typeof useVolumeChartData
        >[0]['totalSeriesRef'],
        buySeriesRef: { current: buySeries } as Parameters<
            typeof useVolumeChartData
        >[0]['buySeriesRef'],
    };
}

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 5000 },
    { time: 2000, open: 105, high: 115, low: 95, close: 110, volume: 6000 },
];

const FAKE_BUY_SELL: BuySellVolumeResult[] = [
    { buyVolume: 3000, sellVolume: 2000 },
    { buyVolume: 4000, sellVolume: 2000 },
];

describe('useVolumeChartData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns void', () => {
        const refs = makeRefs(false);
        const { result } = renderHook(() =>
            useVolumeChartData({
                ...refs,
                bars: [],
                buySellVolume: [],
            })
        );

        expect(result.current).toBeUndefined();
    });

    it('does nothing when refs are null', () => {
        const refs = makeRefs(false);
        renderHook(() =>
            useVolumeChartData({
                ...refs,
                bars: FAKE_BARS,
                buySellVolume: FAKE_BUY_SELL,
            })
        );

        expect(mockTotalSetData).not.toHaveBeenCalled();
        expect(mockBuySetData).not.toHaveBeenCalled();
    });

    it('sets empty data when bars are empty', () => {
        const refs = makeRefs(true);
        renderHook(() =>
            useVolumeChartData({
                ...refs,
                bars: [],
                buySellVolume: [],
            })
        );

        expect(mockTotalSetData).toHaveBeenCalledWith([]);
        expect(mockBuySetData).toHaveBeenCalledWith([]);
    });

    it('sets volume data and calls fitContent with valid bars', () => {
        const refs = makeRefs(true);
        renderHook(() =>
            useVolumeChartData({
                ...refs,
                bars: FAKE_BARS,
                buySellVolume: FAKE_BUY_SELL,
            })
        );

        expect(mockTotalSetData).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ time: 1000, value: 5000 }),
            ])
        );
        expect(mockBuySetData).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ time: 1000, value: 3000 }),
            ])
        );
        expect(mockFitContent).toHaveBeenCalled();
    });

    it('buySellVolume이 bars보다 짧으면 최신 봉 쪽에 맞추고 throw하지 않는다', () => {
        // 예전 구현은 `buySellVolume[i]!.buyVolume`로 좌측 정렬 + non-null 단언이었다.
        // RSC seed가 지표를 접기 시작하면서 길이가 갈릴 수 있게 됐고, 그 조합은
        // `undefined.buyVolume`으로 **throw**한다 — 사이에 ErrorBoundary가 없어
        // 차트가 통째로 빈다. 정렬 규약은 `tailAligned`가 소유한다.
        const refs = makeRefs(true);
        expect(() =>
            renderHook(() =>
                useVolumeChartData({
                    ...refs,
                    bars: FAKE_BARS, // 2개
                    buySellVolume: [{ buyVolume: 4000, sellVolume: 2000 }], // 1개
                })
            )
        ).not.toThrow();

        // 값 1개는 **마지막** 봉(time 2000)에 붙는다. 좌측 정렬이면 time 1000이었다.
        expect(mockBuySetData).toHaveBeenCalledWith([
            { time: 2000, value: 4000 },
        ]);
        // 총거래량 시리즈는 봉 전체를 그대로 그린다(지표와 무관).
        expect(mockTotalSetData).toHaveBeenCalledWith([
            { time: 1000, value: 5000 },
            { time: 2000, value: 6000 },
        ]);
    });

    it('sets empty data when buySellVolume is empty but bars exist', () => {
        const refs = makeRefs(true);
        renderHook(() =>
            useVolumeChartData({
                ...refs,
                bars: FAKE_BARS,
                buySellVolume: [],
            })
        );

        expect(mockTotalSetData).toHaveBeenCalledWith([]);
        expect(mockBuySetData).toHaveBeenCalledWith([]);
    });
});
