/**
 * 시간외 봉이 있어도 지표가 **정규장 봉 시각**에 찍히는지 — `seriesDataUtils`를 mock하지 않는
 * 통합 테스트. 실제 AAPL 응답(5분봉·1시간봉)을 어댑터에 통과시킨 정규장 봉·확장 봉을 쓴다.
 *
 * 지표 시리즈 빌더(`tailAligned`)는 **인덱스로** 봉과 짝짓는다. 그래서 캔들용으로 합친 봉 배열
 * (`displayBars`)을 빌더에 넘기면 지표 값이 엉뚱한 시각에 찍힌다 — 시간외 봉이 사이사이에 끼어
 * 인덱스가 밀리기 때문이다. 설계는 지표·임펄스 색을 항상 정규장 봉으로 만들고, 시간외 봉은 캔들·
 * 거래량 시리즈에 **시각으로** 얹는 것이다. 이 파일이 그 불변식을 실물로 고정한다.
 */
import { TRANSPARENT_COLOR } from '@/widgets/chart/constants';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

import type { Bar, ImpulseColor } from '@y0ngha/siglens-core';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';
import {
    mergeExtendedBars,
    type ExtendedBarTimeframe,
} from '@/shared/api/market/extendedBarsSession';
import {
    buildSeriesData,
    buildSeriesDataFromValues,
} from '@/widgets/chart/utils/seriesDataUtils';
import {
    buildCandlestickDataWithExtended,
    buildTotalVolumeData,
} from '@/widgets/chart/utils/extendedBarsDisplay';
import { buildCandlestickData } from '@/widgets/chart/utils/candlestickDataUtils';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import regular5Min from '../../../shared/api/fmp/__tests__/fixtures/regularBars.aapl.5min.json';
import extended5Min from '../../../shared/api/fmp/__tests__/fixtures/extendedBars.aapl.5min.json';
import regular1Hour from '../../../shared/api/fmp/__tests__/fixtures/regularBars.aapl.1hour.json';
import extended1Hour from '../../../shared/api/fmp/__tests__/fixtures/extendedBars.aapl.1hour.json';

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

const IMPULSE_CYCLE: ImpulseColor[] = ['green', 'red', 'blue'];

interface Shape {
    name: string;
    timeframe: ExtendedBarTimeframe;
    regularRaw: unknown;
    extendedRaw: unknown;
}

const SHAPES: Shape[] = [
    {
        name: '5분봉(정규장·확장 봉이 같은 시각)',
        timeframe: '5Min',
        regularRaw: regular5Min,
        extendedRaw: extended5Min,
    },
    {
        name: '1시간봉(확장 버킷이 시계 정각 — 정규장은 09:30 시작)',
        timeframe: '1Hour',
        regularRaw: regular1Hour,
        extendedRaw: extended1Hour,
    },
];

describe.each(SHAPES)('시간외 봉이 있는 $name', shape => {
    let regular: Bar[];
    let extendedBars: Bar[];
    let displayBars: Bar[];

    beforeEach(async () => {
        mockFmpGet.mockReset();
        mockFmpGet.mockRejectedValue(new Error('fmpGet must be stubbed'));
        regular = await load(shape.regularRaw, shape.timeframe, false);
        const extended = await load(shape.extendedRaw, shape.timeframe, true);
        ({ displayBars, extendedBars } = mergeExtendedBars(
            regular,
            extended,
            shape.timeframe
        ));
    });

    it('전제: 시간외 봉이 정규장 봉 사이가 아니라 앞뒤에 끼어 인덱스가 밀린다', () => {
        expect(extendedBars.length).toBeGreaterThan(0);
        expect(displayBars.length).toBe(regular.length + extendedBars.length);
        // 첫 정규 봉의 display 인덱스가 0이 아니다(프리마켓이 앞에 있다)
        expect(displayBars.indexOf(regular[0]!)).toBeGreaterThan(0);
    });

    it('길이가 같은 지표: i번째 값은 정확히 i번째 **정규장** 봉 시각에 찍힌다', () => {
        const values = regular.map((_, i) => i * 10);
        const out = buildSeriesDataFromValues(regular, values);

        expect(out).toHaveLength(regular.length);
        out.forEach((point, i) => {
            expect(point.time).toBe(regular[i]!.time);
            expect(point).toHaveProperty('value', i * 10);
        });
        const regularTimes = new Set(regular.map(b => b.time));
        expect(out.every(p => regularTimes.has(p.time))).toBe(true);
    });

    it('접힌(짧은) 지표: 마지막 값은 마지막 **정규장** 봉에 붙는다(마지막 display 봉이 아니다)', () => {
        const folded = [7, 8, 9];
        const out = buildSeriesDataFromValues(regular, folded);

        expect(out.map(p => p.time)).toEqual(
            regular.slice(-3).map(b => b.time)
        );
        expect(out.at(-1)!.time).toBe(regular.at(-1)!.time);
        expect(out.at(-1)!.time).not.toBe(displayBars.at(-1)!.time);
    });

    it('객체 지표(buildSeriesData)도 정규장 봉 시각에 찍힌다', () => {
        const rows = regular.map((_, i) => ({ histogram: i }));
        const out = buildSeriesData(regular, rows, 'histogram');
        expect(out.map(p => p.time)).toEqual(regular.map(b => b.time));
    });

    it('정규장 봉이 아니라 display 봉을 빌더에 넘기면 값이 밀린다 — 불변식이 실제로 의미 있다', () => {
        const values = regular.map((_, i) => i);
        const wrong = buildSeriesDataFromValues(displayBars, values);
        const regularTimes = new Set(regular.map(b => b.time));
        // 잘못된 입력에서는 지표 점이 시간외 시각에 찍힌다
        expect(wrong.some(p => !regularTimes.has(p.time))).toBe(true);
    });

    it('캔들 시리즈 시각은 모든 지표 점의 시각을 포함하고, 오름차순·유일하다', () => {
        const candles = buildCandlestickDataWithExtended(
            regular,
            extendedBars,
            [],
            false
        );
        const candleTimes = candles.map(c => c.time as number);
        expect(candleTimes).toEqual(displayBars.map(b => b.time));
        expect(candleTimes).toEqual(
            [...new Set(candleTimes)].toSorted((a, b) => a - b)
        );

        const indicatorTimes = buildSeriesDataFromValues(
            regular,
            regular.map((_, i) => i)
        ).map(p => p.time as number);
        const candleTimeSet = new Set(candleTimes);
        expect(indicatorTimes.every(t => candleTimeSet.has(t))).toBe(true);
    });

    it('정규장 캔들은 시간외 봉이 없을 때와 완전히 같고(Elder 임펄스 색 포함), 시간외 캔들만 속 빈 몸통이다', () => {
        const impulse = regular.map((_, i) => IMPULSE_CYCLE[i % 3]!);
        const baseline = buildCandlestickData(regular, impulse, true);
        const candles = buildCandlestickDataWithExtended(
            regular,
            extendedBars,
            impulse,
            true
        );

        const regularTimes = new Set(regular.map(b => b.time));
        const regularCandles = candles.filter(c =>
            regularTimes.has(c.time as number)
        );
        expect(regularCandles).toEqual(baseline);

        const extendedCandles = candles.filter(
            c => !regularTimes.has(c.time as number)
        );
        expect(extendedCandles).toHaveLength(extendedBars.length);
        const directional = new Set([
            CHART_COLORS.extendedBullish,
            CHART_COLORS.extendedBearish,
        ]);
        for (const c of extendedCandles) {
            expect(c.color).toBe(TRANSPARENT_COLOR);
            expect(directional.has(c.borderColor as string)).toBe(true);
            expect(c.wickColor).toBe(c.borderColor);
        }
    });

    it('총 거래량: 정규장 막대는 기본 색(필드 없음), 시간외 막대만 중립 색이며 시각 오름차순이다', () => {
        const total = buildTotalVolumeData(regular, extendedBars);
        expect(total.map(p => p.time as number)).toEqual(
            displayBars.map(b => b.time)
        );
        const regularTimes = new Set(regular.map(b => b.time));
        for (const p of total) {
            if (regularTimes.has(p.time as number)) {
                expect(p).not.toHaveProperty('color');
            } else {
                expect(p.color).toBe(CHART_COLORS.extendedVolume);
            }
        }
    });
});
