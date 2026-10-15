import { TRANSPARENT_COLOR } from '@/widgets/chart/constants';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

import type { IChartApi } from 'lightweight-charts';
import type { Bar } from '@y0ngha/siglens-core';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';
import {
    mergeExtendedBars,
    type ExtendedBarTimeframe,
} from '@/shared/api/market/extendedBarsSession';
import { buildSeriesDataFromValues } from '@/widgets/chart/utils/seriesDataUtils';
import {
    createExtendedGapController,
    hideSegmentsAcrossGaps,
} from '@/widgets/chart/utils/extendedGapChart';
import regular5Min from '../../../../shared/api/fmp/__tests__/fixtures/regularBars.aapl.5min.json';
import extended5Min from '../../../../shared/api/fmp/__tests__/fixtures/extendedBars.aapl.5min.json';
import regular1Hour from '../../../../shared/api/fmp/__tests__/fixtures/regularBars.aapl.1hour.json';
import extended1Hour from '../../../../shared/api/fmp/__tests__/fixtures/extendedBars.aapl.1hour.json';

const mockFmpGet = vi.mocked(fmpGet);
const provider = new FmpMarketProvider();

async function load(
    raw: unknown,
    timeframe: ExtendedBarTimeframe,
    extended: boolean
): Promise<Bar[]> {
    mockFmpGet.mockResolvedValueOnce(raw);
    const options = { symbol: 'AAPL', timeframe, from: '2000-01-01' };
    return extended
        ? provider.getExtendedBars(options)
        : provider.getBars(options);
}

const HIDDEN = { color: TRANSPARENT_COLOR };
const pt = (time: number, value?: number) =>
    value === undefined ? { time } : { time, value };
const hidden = (time: number, value: number) => ({ time, value, ...HIDDEN });

describe('hideSegmentsAcrossGaps', () => {
    it('값 있는 인접한 두 점 사이에 gap이 있으면 앞 점을 투명 스타일로 바꾼다(값·시각 보존)', () => {
        expect(
            hideSegmentsAcrossGaps(
                [pt(10, 1), pt(20, 2), pt(40, 3), pt(70, 4)],
                [25, 30, 50],
                HIDDEN
            )
        ).toEqual([pt(10, 1), hidden(20, 2), hidden(40, 3), pt(70, 4)]);
    });

    it('입력 배열과 점 객체를 바꾸지 않는다', () => {
        const data = [pt(10, 1), pt(40, 2)];
        const snapshot = structuredClone(data);
        const out = hideSegmentsAcrossGaps(data, [25], HIDDEN);
        expect(data).toEqual(snapshot);
        expect(out).not.toBe(data);
        expect(out[1]).toBe(data[1]);
    });

    it('gap이 점과 같은 시각이거나 데이터 바깥이면 건드리지 않는다(입력 그대로)', () => {
        const data = [pt(10, 1), pt(20, 2), pt(30, 3)];
        expect(hideSegmentsAcrossGaps(data, [5, 10, 20, 30, 99], HIDDEN)).toBe(
            data
        );
    });

    it('gap이 없거나 점이 둘 미만이면 입력 그대로다', () => {
        const data = [pt(10, 1), pt(20, 2)];
        expect(hideSegmentsAcrossGaps(data, [], HIDDEN)).toBe(data);
        const one = [pt(10, 1)];
        expect(hideSegmentsAcrossGaps(one, [5, 15], HIDDEN)).toBe(one);
    });

    it('연속한 gap 여럿이어도 앞 점 하나만 바꾼다', () => {
        expect(
            hideSegmentsAcrossGaps([pt(10, 1), pt(90, 2)], [20, 30, 40], HIDDEN)
        ).toEqual([hidden(10, 1), pt(90, 2)]);
    });

    it('값 없는 점(워밍업)은 건너뛰고 값 있는 점끼리 잇는 선분을 본다', () => {
        // 값 있는 점 20 → 값 있는 점 60 사이(워밍업 점 40을 건너뜀)에 gap 30
        expect(
            hideSegmentsAcrossGaps(
                [pt(10), pt(20, 2), pt(40), pt(60, 3)],
                [30],
                HIDDEN
            )
        ).toEqual([pt(10), hidden(20, 2), pt(40), pt(60, 3)]);
    });

    it('기존 점별 색이 있어도 그 점만 투명으로 덮고 다른 점은 그대로다', () => {
        const colored = { time: 10, value: 1, color: '#fff' };
        const next = { time: 40, value: 2, color: '#000' };
        const out = hideSegmentsAcrossGaps([colored, next], [25], HIDDEN);
        expect(out[0]).toEqual({
            time: 10,
            value: 1,
            color: TRANSPARENT_COLOR,
        });
        expect(out[1]).toBe(next);
    });

    it('영역 시리즈용 스타일(선·위·아래 색)을 그대로 입힌다', () => {
        const style = { lineColor: 't', topColor: 't', bottomColor: 't' };
        expect(
            hideSegmentsAcrossGaps([pt(10, 1), pt(40, 2)], [25], style)[0]
        ).toEqual({ time: 10, value: 1, ...style });
    });

    it('시각이 숫자가 아니면 손대지 않는다', () => {
        const data = [
            { time: '2026-01-01', value: 1 },
            { time: '2026-01-02', value: 2 },
        ];
        expect(hideSegmentsAcrossGaps(data, [1], HIDDEN)).toBe(data);
    });
});

describe('createExtendedGapController', () => {
    function fakeChart(
        type: 'Line' | 'Histogram' | 'Area' = 'Line',
        initialOptions: Record<string, unknown> = {
            color: '#abc',
            lineColor: '#def',
            crosshairMarkerBackgroundColor: '',
        }
    ) {
        const series: {
            setData: ReturnType<typeof vi.fn>;
            applyOptions: ReturnType<typeof vi.fn>;
            seriesType: () => string;
            options: () => Record<string, unknown>;
        }[] = [];
        const chart = {
            addSeries: vi.fn((..._args: unknown[]) => {
                // 실제 시리즈처럼 옵션을 합쳐 들고 있다(applyOptions가 options()에 반영된다)
                let current = { ...initialOptions };
                const s = {
                    setData: vi.fn(),
                    applyOptions: vi.fn((o: Record<string, unknown>) => {
                        current = { ...current, ...o };
                    }),
                    seriesType: () => type,
                    options: () => current,
                };
                series.push(s);
                return s;
            }),
            removeSeries: vi.fn(),
            panes: vi.fn(() => ['pane']),
        };
        return { chart: chart as unknown as IChartApi, raw: chart, series };
    }
    const DEF = { type: 'Line' };
    const data = [pt(10, 1), pt(20, 2), pt(40, 3), pt(70, 4)];

    it('wrap은 null을 그대로, 같은 차트는 같은 어댑터를 돌려준다', () => {
        const controller = createExtendedGapController();
        const { chart } = fakeChart();
        expect(controller.wrap(null)).toBeNull();
        expect(controller.wrap(chart)).toBe(controller.wrap(chart));
    });

    it('선 시리즈는 한 시리즈로 남고, 시간외 구간 앞 점이 투명 색을 받는다', () => {
        const controller = createExtendedGapController();
        const { chart, raw, series } = fakeChart('Line');
        controller.setGapTimes([25, 50]);

        const s = controller
            .wrap(chart)!
            .addSeries(DEF as never, { color: 'red' } as never, 2 as never);
        s.setData(data as never);

        expect(series).toHaveLength(1);
        expect(raw.addSeries).toHaveBeenCalledWith(DEF, { color: 'red' }, 2);
        expect(series[0]!.setData).toHaveBeenLastCalledWith([
            pt(10, 1),
            hidden(20, 2),
            hidden(40, 3),
            pt(70, 4),
        ]);
    });

    it('영역 시리즈는 선·위·아래 색을 함께 투명하게 한다', () => {
        const controller = createExtendedGapController();
        const { chart, series } = fakeChart('Area');
        controller.setGapTimes([25]);
        controller
            .wrap(chart)!
            .addSeries(DEF as never)
            .setData(data as never);

        expect(series[0]!.setData).toHaveBeenLastCalledWith([
            pt(10, 1),
            {
                ...pt(20, 2),
                lineColor: TRANSPARENT_COLOR,
                topColor: TRANSPARENT_COLOR,
                bottomColor: TRANSPARENT_COLOR,
            },
            pt(40, 3),
            pt(70, 4),
        ]);
    });

    it('선이 안 보이는 시리즈(lineVisible:false — 파라볼릭 SAR·스퀴즈 점)는 마커를 지키려고 점 색을 건드리지 않는다', () => {
        const controller = createExtendedGapController();
        const { chart, series } = fakeChart('Line', {
            lineVisible: false,
            pointMarkersVisible: true,
            color: '#abc',
            crosshairMarkerBackgroundColor: '',
        });
        controller.setGapTimes([25, 50]);
        controller
            .wrap(chart)!
            .addSeries(DEF as never)
            .setData(data as never);
        expect(series[0]!.setData).toHaveBeenLastCalledWith(data);
    });

    it('lineVisible이 나중에 바뀌어도 그 시점의 옵션을 따른다', () => {
        const controller = createExtendedGapController();
        const { chart, series } = fakeChart('Line');
        controller.setGapTimes([25]);
        const s = controller.wrap(chart)!.addSeries(DEF as never);
        s.setData(data as never);
        expect(series[0]!.setData).toHaveBeenLastCalledWith([
            pt(10, 1),
            hidden(20, 2),
            pt(40, 3),
            pt(70, 4),
        ]);
        s.applyOptions({ lineVisible: false } as never);
        controller.setGapTimes([25, 26]);
        expect(series[0]!.setData).toHaveBeenLastCalledWith(data);
    });

    describe('크로스헤어 마커 배경(투명 점에서 마커가 사라지지 않게)', () => {
        it('선 시리즈는 마커 배경을 자기 선 색으로 고정한다', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Line');
            controller.wrap(chart)!.addSeries(DEF as never);
            expect(series[0]!.applyOptions).toHaveBeenCalledWith({
                crosshairMarkerBackgroundColor: '#abc',
            });
        });

        it('영역 시리즈는 lineColor를 쓴다', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Area');
            controller.wrap(chart)!.addSeries(DEF as never);
            expect(series[0]!.applyOptions).toHaveBeenCalledWith({
                crosshairMarkerBackgroundColor: '#def',
            });
        });

        it('호출부가 명시한 마커 배경은 존중한다(덮어쓰지 않는다)', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Line', {
                color: '#abc',
                crosshairMarkerBackgroundColor: '#123',
            });
            const s = controller.wrap(chart)!.addSeries(DEF as never);
            s.applyOptions({ color: '#fff' } as never);
            expect(series[0]!.options().crosshairMarkerBackgroundColor).toBe(
                '#123'
            );
        });

        it('이후 applyOptions로 선 색이 바뀌면 마커 배경도 따라간다', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Line');
            const s = controller.wrap(chart)!.addSeries(DEF as never);
            s.applyOptions({ color: '#fff' } as never);
            expect(series[0]!.options().crosshairMarkerBackgroundColor).toBe(
                '#fff'
            );
        });

        it('호출부가 나중에 마커 배경을 직접 정하면 그 뒤로는 따라가지 않는다', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Line');
            const s = controller.wrap(chart)!.addSeries(DEF as never);
            s.applyOptions({ crosshairMarkerBackgroundColor: '#999' } as never);
            s.applyOptions({ color: '#fff' } as never);
            expect(series[0]!.options().crosshairMarkerBackgroundColor).toBe(
                '#999'
            );
        });

        it('선이 안 보이는 시리즈(lineVisible:false — 스퀴즈 점)에는 마커 배경을 정하지 않는다(점별 색이 마커 색이다)', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Line', {
                lineVisible: false,
                pointMarkersVisible: true,
                crosshairMarkerBackgroundColor: '',
            });
            const s = controller.wrap(chart)!.addSeries(DEF as never);
            s.applyOptions({ lineWidth: 2 } as never);
            s.setData(data as never);
            const pinned = series[0]!.applyOptions.mock.calls.filter(
                ([o]) => 'crosshairMarkerBackgroundColor' in o
            );
            expect(pinned).toEqual([]);
        });

        it('선이 보이다가 마커 전용으로 뒤집히면 고정을 풀어 빈 값으로 되돌리고, 다시 보이면 고정한다', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Line');
            const s = controller.wrap(chart)!.addSeries(DEF as never);
            expect(series[0]!.options().crosshairMarkerBackgroundColor).toBe(
                '#abc'
            );

            s.applyOptions({ lineVisible: false } as never);
            expect(series[0]!.options().crosshairMarkerBackgroundColor).toBe(
                ''
            );

            s.applyOptions({ lineVisible: true } as never);
            expect(series[0]!.options().crosshairMarkerBackgroundColor).toBe(
                '#abc'
            );
        });

        it('마커 전용이었다가 선이 보이게 뒤집히면 그때부터 고정한다', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Line', {
                lineVisible: false,
                color: '#abc',
                crosshairMarkerBackgroundColor: '',
            });
            const s = controller.wrap(chart)!.addSeries(DEF as never);
            expect(series[0]!.options().crosshairMarkerBackgroundColor).toBe(
                ''
            );
            s.applyOptions({ lineVisible: true } as never);
            expect(series[0]!.options().crosshairMarkerBackgroundColor).toBe(
                '#abc'
            );
        });

        it('호출부가 명시한 마커 배경은 lineVisible 뒤집힘에도 되돌리지 않는다', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Line', {
                color: '#abc',
                crosshairMarkerBackgroundColor: '#123',
            });
            const s = controller.wrap(chart)!.addSeries(DEF as never);
            s.applyOptions({ lineVisible: false } as never);
            expect(series[0]!.options().crosshairMarkerBackgroundColor).toBe(
                '#123'
            );
        });

        it('히스토그램은 마커가 없어 건드리지 않는다', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Histogram');
            controller.wrap(chart)!.addSeries(DEF as never);
            expect(series[0]!.applyOptions).not.toHaveBeenCalled();
        });

        it('진짜 차트의 시리즈(추세선 등)는 건드리지 않는다', () => {
            const controller = createExtendedGapController();
            const { chart, series } = fakeChart('Line');
            controller.wrap(chart);
            chart.addSeries(DEF as never);
            expect(series[0]!.applyOptions).not.toHaveBeenCalled();
        });
    });

    it('히스토그램은 이어질 선이 없어 데이터를 그대로 싣는다', () => {
        const controller = createExtendedGapController();
        const { chart, series } = fakeChart('Histogram');
        controller.setGapTimes([25]);
        controller
            .wrap(chart)!
            .addSeries(DEF as never)
            .setData(data as never);
        expect(series[0]!.setData).toHaveBeenLastCalledWith(data);
    });

    it('진짜 차트에서 만든 시리즈(추세선·작도 레벨)는 이어진다(투명 색 없음)', () => {
        const controller = createExtendedGapController();
        const { chart, series } = fakeChart();
        controller.wrap(chart);
        controller.setGapTimes([25, 50]);

        chart.addSeries(DEF as never).setData(data as never);

        expect(series[0]!.setData).toHaveBeenCalledWith(data);
    });

    it('gap 시각이 나중에 바뀌면 이미 그려진 시리즈를 다시 채운다', () => {
        const controller = createExtendedGapController();
        const { chart, series } = fakeChart();
        controller
            .wrap(chart)!
            .addSeries(DEF as never)
            .setData(data as never);
        expect(series[0]!.setData).toHaveBeenLastCalledWith(data);

        controller.setGapTimes([25]);
        expect(series[0]!.setData).toHaveBeenLastCalledWith([
            pt(10, 1),
            hidden(20, 2),
            pt(40, 3),
            pt(70, 4),
        ]);

        controller.setGapTimes([]);
        expect(series[0]!.setData).toHaveBeenLastCalledWith(data);
    });

    it('removeSeries는 진짜 시리즈를 제거하고 이후 다시 채우지 않는다', () => {
        const controller = createExtendedGapController();
        const { chart, raw, series } = fakeChart();
        const wrapped = controller.wrap(chart)!;
        const s = wrapped.addSeries(DEF as never);
        s.setData(data as never);
        wrapped.removeSeries(s);

        expect(raw.removeSeries).toHaveBeenCalledWith(series[0]);
        series[0]!.setData.mockClear();
        controller.setGapTimes([30]);
        expect(series[0]!.setData).not.toHaveBeenCalled();
    });

    it('applyOptions 등 그 밖의 시리즈·차트 API는 그대로 통과한다', () => {
        const controller = createExtendedGapController();
        const { chart, series } = fakeChart();
        const wrapped = controller.wrap(chart)!;
        expect(wrapped.panes()).toEqual(['pane']);
        wrapped.addSeries(DEF as never).applyOptions({ lineWidth: 3 } as never);
        expect(series[0]!.applyOptions).toHaveBeenCalledWith({ lineWidth: 3 });
    });

    it('차트가 이미 제거돼 setData가 던져도 setGapTimes는 던지지 않는다', () => {
        const controller = createExtendedGapController();
        const { chart, series } = fakeChart();
        controller
            .wrap(chart)!
            .addSeries(DEF as never)
            .setData(data as never);
        series[0]!.setData.mockImplementation(() => {
            throw new Error('disposed');
        });
        expect(() => controller.setGapTimes([25])).not.toThrow();
    });
});

describe.each([
    {
        name: '5분봉',
        timeframe: '5Min' as const,
        regularRaw: regular5Min,
        extendedRaw: extended5Min,
    },
    {
        name: '1시간봉',
        timeframe: '1Hour' as const,
        regularRaw: regular1Hour,
        extendedRaw: extended1Hour,
    },
])('실제 AAPL $name — RSI류 선 시리즈', shape => {
    let regular: Bar[];
    let extendedBars: Bar[];

    beforeEach(async () => {
        mockFmpGet.mockReset();
        mockFmpGet.mockRejectedValue(new Error('fmpGet must be stubbed'));
        // 하루 응답을 다음 날(+24h, 같은 EDT)로 한 벌 더 이어 이틀치로 만든다 — 밤새 구간이 데이터 안쪽에 있어야 한다.
        const nextDay = (bars: Bar[]): Bar[] => [
            ...bars,
            ...bars.map(b => ({ ...b, time: b.time + 86_400 })),
        ];
        regular = nextDay(await load(shape.regularRaw, shape.timeframe, false));
        const ext = nextDay(
            await load(shape.extendedRaw, shape.timeframe, true)
        );
        ({ extendedBars } = mergeExtendedBars(regular, ext, shape.timeframe));
    });

    it('이틀 사이 밤새 구간을 잇는 선분만 안 보이고, 모든 정규장 점의 시각·값은 그대로다', () => {
        let received: { time: number; value?: number; color?: string }[] = [];
        const chart = {
            addSeries: () => ({
                seriesType: () => 'Line',
                options: () => ({
                    color: '#abc',
                    crosshairMarkerBackgroundColor: '',
                }),
                applyOptions: () => {},
                setData: (d: typeof received) => {
                    received = d;
                },
            }),
        } as unknown as IChartApi;
        const controller = createExtendedGapController();
        controller.setGapTimes(extendedBars.map(b => b.time));

        const values = regular.map((_, i) => i * 10);
        controller
            .wrap(chart)!
            .addSeries({} as never)
            .setData(buildSeriesDataFromValues(regular, values) as never);

        expect(received.map(p => [p.time, p.value])).toEqual(
            regular.map((b, i) => [b.time, i * 10])
        );
        const marked = received.filter(p => p.color !== undefined);
        // 하루 중 이어진 점은 모두 그대로, 밤새 건너는 점 단 하나만 투명
        expect(marked).toHaveLength(1);
        expect(marked[0]!.color).toBe(TRANSPARENT_COLOR);
        // 그 점은 1일차의 마지막 정규장 봉이다
        const lastOfDayOne = regular[regular.length / 2 - 1]!;
        expect(marked[0]!.time).toBe(lastOfDayOne.time);
        // 이틀치 모두 합쳐 시간외 시각을 건너뛰는 선분은 그 하나뿐이다
        const crossing = received.filter((p, i) => {
            const next = received[i + 1];
            return (
                next !== undefined &&
                extendedBars.some(b => b.time > p.time && b.time < next.time)
            );
        });
        expect(crossing).toHaveLength(1);
        expect(crossing[0]!.time).toBe(marked[0]!.time);
    });
});
