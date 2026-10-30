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

    // 총 거래량은 봉에서만 나온다 — 분해가 비어도 총 막대는 그대로 그린다.
    it('keeps total volume and empties only the buy split when buySellVolume is empty', () => {
        const refs = makeRefs(true);
        renderHook(() =>
            useVolumeChartData({
                ...refs,
                bars: FAKE_BARS,
                buySellVolume: [],
            })
        );

        expect(mockTotalSetData).toHaveBeenCalledTimes(1);
        expect(mockTotalSetData.mock.calls[0][0]).toHaveLength(
            FAKE_BARS.length
        );
        expect(mockBuySetData).toHaveBeenCalledWith([]);
    });

    describe('프리·애프터마켓 봉', () => {
        const EXTENDED: Bar[] = [
            { time: 500, open: 1, high: 2, low: 1, close: 1.5, volume: 700 },
            { time: 3000, open: 1, high: 2, low: 1, close: 1.5, volume: 800 },
        ];

        it('총 거래량 시리즈에는 시각순으로 얹고(중립 색), 매수 시리즈는 정규장 봉에만 짝짓는다', () => {
            const refs = makeRefs(true);
            renderHook(() =>
                useVolumeChartData({
                    ...refs,
                    bars: FAKE_BARS,
                    extendedBars: EXTENDED,
                    buySellVolume: FAKE_BUY_SELL,
                })
            );

            const total = mockTotalSetData.mock.calls.at(-1)![0] as {
                time: number;
                value: number;
                color?: string;
            }[];
            expect(total.map(p => [p.time, p.value])).toEqual([
                [500, 700],
                [1000, 5000],
                [2000, 6000],
                [3000, 800],
            ]);
            // 정규장 막대는 시리즈 기본 색(color 없음), 시간외 막대만 색을 가진다.
            expect(total.map(p => p.color !== undefined)).toEqual([
                true,
                false,
                false,
                true,
            ]);
            // 매수 시리즈: 정규장 봉 2개 그대로 — 시간외 시각에는 점이 없다.
            expect(mockBuySetData).toHaveBeenCalledWith([
                { time: 1000, value: 3000 },
                { time: 2000, value: 4000 },
            ]);
        });

        it('접힌(짧은) 매수/매도 지표는 시간외 봉이 있어도 마지막 **정규장** 봉에 붙는다', () => {
            const refs = makeRefs(true);
            renderHook(() =>
                useVolumeChartData({
                    ...refs,
                    bars: FAKE_BARS,
                    extendedBars: EXTENDED, // 마지막 봉(3000)은 애프터마켓
                    buySellVolume: [{ buyVolume: 4000, sellVolume: 2000 }],
                })
            );
            expect(mockBuySetData).toHaveBeenCalledWith([
                { time: 2000, value: 4000 },
            ]);
        });

        it('시간외 봉만 나중에 도착하면 시간축을 다시 맞추지 않는다(정규장 데이터가 바뀔 때만 맞춘다)', () => {
            const refs = makeRefs(true);
            const { rerender } = renderHook(
                (props: { extendedBars: Bar[] }) =>
                    useVolumeChartData({
                        ...refs,
                        bars: FAKE_BARS,
                        extendedBars: props.extendedBars,
                        buySellVolume: FAKE_BUY_SELL,
                    }),
                { initialProps: { extendedBars: [] as Bar[] } }
            );
            expect(mockFitContent).toHaveBeenCalledTimes(1);

            rerender({ extendedBars: EXTENDED });

            expect(mockTotalSetData).toHaveBeenCalledTimes(2);
            expect(mockFitContent).toHaveBeenCalledTimes(1);
        });

        it('runUpdate로 setData·시간축 맞춤을 감싼다(거래량 갱신이 가격 차트 범위를 덮지 않게)', () => {
            const order: string[] = [];
            mockTotalSetData.mockImplementation(() => order.push('total'));
            mockBuySetData.mockImplementation(() => order.push('buy'));
            mockFitContent.mockImplementation(() => order.push('fit'));
            const runUpdate = vi.fn((update: () => void) => {
                order.push('begin');
                update();
                order.push('end');
            });
            const refs = makeRefs(true);
            renderHook(() =>
                useVolumeChartData({
                    ...refs,
                    bars: FAKE_BARS,
                    buySellVolume: FAKE_BUY_SELL,
                    runUpdate,
                })
            );
            expect(order).toEqual(['begin', 'total', 'buy', 'fit', 'end']);
        });

        it('extendedBars를 생략하면 기존과 같다(색 필드도 없다)', () => {
            const refs = makeRefs(true);
            renderHook(() =>
                useVolumeChartData({
                    ...refs,
                    bars: FAKE_BARS,
                    buySellVolume: FAKE_BUY_SELL,
                })
            );
            expect(mockTotalSetData).toHaveBeenCalledWith([
                { time: 1000, value: 5000 },
                { time: 2000, value: 6000 },
            ]);
        });
    });
});
