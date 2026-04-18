import { classifyTrend } from '@/domain/signals/trend';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import type { Bar, IndicatorResult } from '@/domain/types';

function buildBars(closes: number[]): Bar[] {
    return closes.map((c, i) => ({
        time: 1700000000 + i * 86400,
        open: c,
        high: c,
        low: c,
        close: c,
        volume: 1000,
    }));
}

function buildIndicators(ema20: (number | null)[]): IndicatorResult {
    return {
        ...EMPTY_INDICATOR_RESULT,
        ema: { 20: ema20 },
    };
}

describe('classifyTrend', () => {
    describe('EMA20 데이터가 없을 때', () => {
        it('sideways를 반환한다', () => {
            const bars = buildBars([100, 101, 102]);
            const indicators = buildIndicators([null, null, null]);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('indicators.ema에 20 키가 없을 때', () => {
        it('sideways를 반환한다', () => {
            const bars = buildBars([100, 101, 102]);
            const indicators: IndicatorResult = {
                ...EMPTY_INDICATOR_RESULT,
                ema: {},
            };
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('ema20 배열이 lookback+1 보다 짧을 때', () => {
        it('sideways를 반환한다', () => {
            const bars = buildBars([100, 101, 102]);
            const indicators = buildIndicators([100, 101, 102]);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('최근 20봉 EMA 기울기가 +5% 이고 가격이 EMA 위일 때', () => {
        it('uptrend를 반환한다', () => {
            const emaValues = Array.from({ length: 21 }, (_, i) => 100 + i * 0.25);
            const closes = emaValues.map(v => v + 5);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('uptrend');
        });
    });

    describe('최근 20봉 EMA 기울기가 -5% 이고 가격이 EMA 아래일 때', () => {
        it('downtrend를 반환한다', () => {
            const emaValues = Array.from({ length: 21 }, (_, i) => 105 - i * 0.25);
            const closes = emaValues.map(v => v - 5);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('downtrend');
        });
    });

    describe('EMA 기울기가 ±3% 이내일 때', () => {
        it('sideways를 반환한다', () => {
            const emaValues = Array.from({ length: 21 }, (_, i) => 100 + i * 0.05);
            const closes = emaValues.map(v => v + 1);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('기울기는 양수지만 가격이 EMA 아래일 때', () => {
        it('sideways를 반환한다', () => {
            const emaValues = Array.from({ length: 21 }, (_, i) => 100 + i * 0.25);
            const closes = emaValues.map(v => v - 5);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('최근 EMA 값이 null일 때', () => {
        it('sideways를 반환한다', () => {
            const emaValues: (number | null)[] = Array.from(
                { length: 21 },
                (_, i) => 100 + i * 0.25
            );
            emaValues[20] = null;
            const closes = Array.from({ length: 21 }, (_, i) => 100 + i * 0.25 + 5);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('이전 EMA 값이 null일 때', () => {
        it('sideways를 반환한다', () => {
            const emaValues: (number | null)[] = Array.from(
                { length: 21 },
                (_, i) => 100 + i * 0.25
            );
            emaValues[0] = null;
            const closes = Array.from({ length: 21 }, (_, i) => 100 + i * 0.25 + 5);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('이전 EMA 값이 0일 때', () => {
        it('sideways를 반환한다', () => {
            const emaValues: (number | null)[] = Array.from(
                { length: 21 },
                (_, i) => 100 + i * 0.25
            );
            emaValues[0] = 0;
            const closes = Array.from({ length: 21 }, (_, i) => 100 + i * 0.25 + 5);
            const bars = buildBars(closes);
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });

    describe('bars 배열이 비어 있을 때', () => {
        it('sideways를 반환한다', () => {
            const emaValues = Array.from({ length: 21 }, (_, i) => 100 + i * 0.25);
            const bars: Bar[] = [];
            const indicators = buildIndicators(emaValues);
            expect(classifyTrend(bars, indicators)).toBe('sideways');
        });
    });
});
