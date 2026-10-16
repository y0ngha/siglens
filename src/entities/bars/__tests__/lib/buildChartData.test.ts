// @vitest-environment node
import { calculateIndicators } from '@y0ngha/siglens-core';
import { buildChartData, type ChartData } from '../../lib/buildChartData';
import {
    CHART_DATA_INDICATOR_NAMES,
    CHART_DATA_PERIOD_KEYED_INDICATORS,
    CHART_DATA_SNAPSHOT_INDICATORS,
    type ChartDataIndicatorName,
} from '../../lib/chartDataIndicators';
import { roundIndicators } from '../../lib/roundIndicators';
import { makeDailyBars } from './chartDataFixtures';

const bars = makeDailyBars(400);
/** 웹이 쓰는 경로 그대로: 전체 룩백으로 계산하고 `roundIndicators`로 반올림한다. */
const full = roundIndicators(calculateIndicators(bars));

const snapshots: readonly string[] = CHART_DATA_SNAPSHOT_INDICATORS;
const periodKeyed: readonly string[] = CHART_DATA_PERIOD_KEYED_INDICATORS;

const build = (
    count: number,
    selected: readonly ChartDataIndicatorName[] = CHART_DATA_INDICATOR_NAMES
) =>
    buildChartData({
        symbol: 'AAPL',
        timeframe: '1Day',
        bars,
        indicators: full,
        count,
        selected,
    });

/** 응답 속 시리즈를 전부 훑는다: 배열이면 길이를 모으고, 객체 안의 배열도 재귀한다(스냅샷 제외). */
function seriesLengths(data: ChartData): Array<[string, number]> {
    const out: Array<[string, number]> = [];
    const visit = (path: string, value: unknown): void => {
        if (Array.isArray(value)) out.push([path, value.length]);
        else if (typeof value === 'object' && value !== null)
            for (const [key, inner] of Object.entries(value))
                visit(`${path}.${key}`, inner);
    };
    for (const [name, value] of Object.entries(data.indicators))
        if (!snapshots.includes(name)) visit(name, value);
    return out;
}

describe('buildChartData — 정렬', () => {
    it.each([1, 50, 100, 400])(
        '봉 %i개: time·ohlcv·모든 시리즈의 길이가 같다',
        count => {
            const data = build(count);
            expect(data.bars).toBe(count);
            expect(data.time).toHaveLength(count);
            for (const column of Object.values(data.ohlcv))
                expect(column).toHaveLength(count);
            const lengths = seriesLengths(data);
            expect(lengths.length).toBeGreaterThan(40);
            for (const [path, length] of lengths)
                expect(length, path).toBe(count);
        }
    );

    it('time은 유닉스 초 오름차순이고 ohlcv가 같은 봉을 가리킨다', () => {
        const data = build(30);
        const tail = bars.slice(-30);
        expect(data.time).toEqual(tail.map(b => b.time));
        expect(data.time).toEqual(data.time.toSorted((a, b) => a - b));
        expect(data.ohlcv.close).toEqual(tail.map(b => b.close));
        expect(data.ohlcv.open).toEqual(tail.map(b => b.open));
        expect(data.ohlcv.high).toEqual(tail.map(b => b.high));
        expect(data.ohlcv.low).toEqual(tail.map(b => b.low));
        expect(data.ohlcv.volume).toEqual(tail.map(b => b.volume));
    });

    it('요청이 가진 봉보다 많으면 가진 만큼만 돌려준다', () => {
        const data = build(10_000);
        expect(data.bars).toBe(400);
        expect(data.time).toHaveLength(400);
    });

    it('워밍업 구간은 null이다(긴 기간 이동평균의 앞쪽)', () => {
        const data = build(400);
        const ma200 = (data.indicators.ma as Record<string, unknown[]>)['200']!;
        expect(ma200[0]).toBeNull();
        expect(ma200.at(-1)).not.toBeNull();
    });
});

describe('buildChartData — 자르기가 웹의 값과 같다', () => {
    const count = 60;
    const offset = bars.length - count;
    const data = build(count);

    it.each(
        CHART_DATA_INDICATOR_NAMES.filter(
            n => !snapshots.includes(n) && !periodKeyed.includes(n)
        )
    )('%s: 전체 계산 결과의 마지막 N개와 봉 단위로 같다', name => {
        const direct = full[name] as unknown[];
        const sliced = data.indicators[name];
        const expectedTail = direct.slice(offset);
        const first = direct.find(v => v !== null);
        if (typeof first === 'object' && first !== null) {
            const columns = sliced as Record<string, unknown[]>;
            for (const field of Object.keys(first)) {
                expect(columns[field], `${name}.${field}`).toEqual(
                    expectedTail.map(
                        row => (row as Record<string, unknown>)[field]
                    )
                );
            }
        } else {
            expect(sliced).toEqual(expectedTail);
        }
    });

    it.each(['ma', 'ema'] as const)(
        '%s: core가 계산하는 모든 주기가 문자열 키로 나가고 마지막 N개와 같다',
        name => {
            const direct = full[name];
            const columns = data.indicators[name] as Record<string, unknown[]>;
            expect(Object.keys(columns).toSorted()).toEqual(
                Object.keys(direct).toSorted()
            );
            for (const [period, series] of Object.entries(direct))
                expect(columns[period]).toEqual(series.slice(offset));
        }
    );

    it('값은 웹이 쓰는 roundIndicators 결과(유효숫자 6자리)다', () => {
        const rsi = data.indicators.rsi as Array<number | null>;
        for (const value of rsi) {
            if (value === null || Number.isInteger(value)) continue;
            expect(value).toBe(Number(value.toPrecision(6)));
        }
        // 반올림하지 않은 원본과는 다르다 — 반올림이 실제로 적용됐다는 증거.
        const raw = calculateIndicators(bars).rsi.slice(offset);
        expect(rsi).not.toEqual(raw);
    });

    it('같은 봉에 대한 값은 창 크기와 무관하다(작은 창이 큰 창의 꼬리)', () => {
        const small = build(20);
        const large = build(200);
        expect(small.indicators.rsi).toEqual(
            (large.indicators.rsi as unknown[]).slice(-20)
        );
        expect(small.indicators.macd).toEqual({
            macd: (large.indicators.macd as { macd: unknown[] }).macd.slice(
                -20
            ),
            signal: (
                large.indicators.macd as { signal: unknown[] }
            ).signal.slice(-20),
            histogram: (
                large.indicators.macd as { histogram: unknown[] }
            ).histogram.slice(-20),
        });
    });
});

describe('buildChartData — 다중 필드 지표의 필드 이름은 core 그대로', () => {
    const data = build(30);
    const fieldsOf = (name: string): string[] =>
        Object.keys(data.indicators[name] as object).toSorted();

    it.each([
        ['macd', ['histogram', 'macd', 'signal']],
        ['bollinger', ['lower', 'middle', 'upper']],
        ['dmi', ['adx', 'diMinus', 'diPlus']],
        ['stochastic', ['percentD', 'percentK']],
        ['ichimoku', ['chikou', 'kijun', 'senkouA', 'senkouB', 'tenkan']],
        ['supertrend', ['supertrend', 'trend']],
        ['parabolicSar', ['sar', 'trend']],
    ])('%s', (name, fields) => {
        expect(fieldsOf(name)).toEqual(fields);
    });
});

describe('buildChartData — 선택', () => {
    it('고른 지표만 나가고 ohlcv·time은 항상 나간다', () => {
        const data = build(10, ['rsi', 'ma']);
        expect(Object.keys(data.indicators)).toEqual(['rsi', 'ma']);
        expect(data.time).toHaveLength(10);
    });

    it('전부를 고르면 core의 모든 지표가 나간다', () => {
        const data = build(10);
        expect(Object.keys(data.indicators).toSorted()).toEqual(
            Object.keys(full).toSorted()
        );
    });
});

describe('buildChartData — 스냅샷(volumeProfile, smc)', () => {
    const count = 60;
    const offset = bars.length - count;
    const data = build(count);

    it('volumeProfile은 전체 구간 값 그대로 나간다(time과 정렬되지 않는다)', () => {
        expect(data.indicators.volumeProfile).toEqual(full.volumeProfile);
    });

    it('실제 계산 결과: 단일 인덱스 항목(swing·구조 돌파)은 구간 기준으로 옮겨지고 구간 앞 항목은 빠진다', () => {
        const smc = data.indicators.smc as typeof full.smc;
        const inside = (index: number): boolean => index - offset >= 0;
        for (const key of [
            'swingHighs',
            'swingLows',
            'structureBreaks',
        ] as const)
            expect(smc[key].map(p => p.index)).toEqual(
                full.smc[key]
                    .filter(p => inside(p.index))
                    .map(p => p.index - offset)
            );
        // 구간 기준 인덱스가 가리키는 봉에서 swing high의 가격이 그 봉의 고가와 맞는다.
        for (const point of smc.swingHighs)
            expect(point.price).toBe(data.ohlcv.high[point.index]);
        expect(smc.premiumZone).toEqual(full.smc.premiumZone);
    });

    it('테스트 픽스처가 smc의 구간 앞 항목을 실제로 만든다(공허한 통과 방지)', () => {
        expect(
            full.smc.swingHighs.filter(p => p.index < offset).length
        ).toBeGreaterThan(0);
    });

    describe('구간 앞으로 밀린 항목의 규칙(손으로 만든 smc)', () => {
        // offset = 400 - 60 = 340. 구간 안 인덱스는 340..399 -> 0..59.
        const smcInput = {
            ...full.smc,
            swingHighs: [
                { index: 339, price: 1, type: 'high' },
                { index: 340, price: 2, type: 'high' },
                { index: 399, price: 3, type: 'high' },
            ],
            orderBlocks: [
                {
                    startIndex: 100,
                    high: 5,
                    low: 4,
                    type: 'bullish',
                    isMitigated: false,
                },
                {
                    startIndex: 100,
                    high: 5,
                    low: 4,
                    type: 'bullish',
                    isMitigated: true,
                },
                {
                    startIndex: 350,
                    high: 7,
                    low: 6,
                    type: 'bearish',
                    isMitigated: true,
                },
            ],
            fairValueGaps: [
                {
                    index: 120,
                    high: 5,
                    low: 4,
                    type: 'bullish',
                    isMitigated: false,
                },
                {
                    index: 120,
                    high: 5,
                    low: 4,
                    type: 'bullish',
                    isMitigated: true,
                },
                {
                    index: 360,
                    high: 7,
                    low: 6,
                    type: 'bearish',
                    isMitigated: false,
                },
            ],
            equalHighs: [
                { price: 10, firstIndex: 350, secondIndex: 380 },
                { price: 11, firstIndex: 100, secondIndex: 380 },
                { price: 12, firstIndex: 100, secondIndex: 200 },
            ],
            equalLows: [
                { price: 20, firstIndex: 345, secondIndex: 390 },
                { price: 21, firstIndex: 339, secondIndex: 340 },
                { price: 22, firstIndex: 10, secondIndex: 339 },
            ],
            structureBreaks: [
                { index: 200, price: 1, type: 'bullish', breakType: 'bos' },
                { index: 345, price: 2, type: 'bearish', breakType: 'choch' },
            ],
        } as unknown as typeof full.smc;
        const out = buildChartData({
            symbol: 'AAPL',
            timeframe: '1Day',
            bars,
            indicators: { ...full, smc: smcInput },
            count,
            selected: ['smc'],
        }).indicators.smc as Record<string, Array<Record<string, unknown>>>;

        it('swing 인덱스는 offset만큼 당겨지고 구간 앞 항목은 빠진다', () => {
            expect(out.swingHighs?.map(p => p.index)).toEqual([0, 59]);
            expect(out.swingHighs?.some(p => 'startsBeforeWindow' in p)).toBe(
                false
            );
        });

        it('equalHighs/equalLows: firstIndex와 secondIndex가 모두 offset만큼 당겨진다', () => {
            expect(out.equalHighs?.[0]).toEqual({
                price: 10,
                firstIndex: 10,
                secondIndex: 40,
            });
            expect(out.equalLows?.[0]).toEqual({
                price: 20,
                firstIndex: 5,
                secondIndex: 50,
            });
        });

        it('일부만 구간 앞이면(걸친 항목) 앞쪽 인덱스를 null로 두고 startsBeforeWindow: true로 유지한다', () => {
            expect(out.equalHighs?.[1]).toEqual({
                price: 11,
                firstIndex: null,
                secondIndex: 40,
                startsBeforeWindow: true,
            });
            expect(out.equalLows?.[1]).toEqual({
                price: 21,
                firstIndex: null,
                secondIndex: 0,
                startsBeforeWindow: true,
            });
        });

        it('인덱스가 모두 구간 앞인 equal 항목은 빠진다', () => {
            expect(out.equalHighs?.map(p => p.price)).toEqual([10, 11]);
            expect(out.equalLows?.map(p => p.price)).toEqual([20, 21]);
        });

        it('미완화(isMitigated: false) 오더블록·FVG는 구간 앞에서 시작해도 null 인덱스 + startsBeforeWindow로 남고, 완화된 것은 빠진다', () => {
            expect(out.orderBlocks).toEqual([
                {
                    startIndex: null,
                    high: 5,
                    low: 4,
                    type: 'bullish',
                    isMitigated: false,
                    startsBeforeWindow: true,
                },
                {
                    startIndex: 10,
                    high: 7,
                    low: 6,
                    type: 'bearish',
                    isMitigated: true,
                },
            ]);
            expect(out.fairValueGaps).toEqual([
                {
                    index: null,
                    high: 5,
                    low: 4,
                    type: 'bullish',
                    isMitigated: false,
                    startsBeforeWindow: true,
                },
                {
                    index: 20,
                    high: 7,
                    low: 6,
                    type: 'bearish',
                    isMitigated: false,
                },
            ]);
        });

        it('구조 돌파는 구간 앞이면 빠진다', () => {
            expect(out.structureBreaks?.map(p => p.index)).toEqual([5]);
        });
    });

    it('창이 전체와 같으면(offset 0) smc는 그대로다', () => {
        expect(build(400).indicators.smc).toEqual(full.smc);
    });
});

describe('buildChartData — 꼬리 정렬 방어', () => {
    it('지표 시리즈가 봉보다 짧으면 왼쪽을 null로 채워 꼬리를 맞춘다', () => {
        const shortRsi = (full.rsi as Array<number | null>).slice(-5);
        const data = buildChartData({
            symbol: 'AAPL',
            timeframe: '1Day',
            bars,
            indicators: { ...full, rsi: shortRsi },
            count: 8,
            selected: ['rsi'],
        });
        expect(data.indicators.rsi).toEqual([null, null, null, ...shortRsi]);
    });
});
