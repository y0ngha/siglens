import { SECONDS_PER_DAY } from '@/domain/constants/time';
import { calculateVWAP } from '@/domain/indicators/vwap';
import type { Bar } from '@/domain/types';

function makeBar(overrides: Partial<Bar> & { time: number }): Bar {
    return {
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
        ...overrides,
    };
}

function makeBars(
    values: {
        high: number;
        low: number;
        close: number;
        volume: number;
        time?: number;
    }[]
): Bar[] {
    return values.map((v, i) =>
        makeBar({
            time: (v.time ?? i) * SECONDS_PER_DAY,
            high: v.high,
            low: v.low,
            close: v.close,
            volume: v.volume,
        })
    );
}

describe('calculateVWAP', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateVWAP([])).toEqual([]);
        });
    });

    describe('단일 봉 입력일 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = [
                makeBar({
                    time: 0,
                    high: 105,
                    low: 95,
                    close: 100,
                    volume: 1000,
                }),
            ];
            expect(calculateVWAP(bars)).toHaveLength(1);
        });

        it('첫 번째 값이 typicalPrice와 같다', () => {
            // typicalPrice = (105 + 95 + 100) / 3 = 100
            const bars = [
                makeBar({
                    time: 0,
                    high: 105,
                    low: 95,
                    close: 100,
                    volume: 1000,
                }),
            ];
            const result = calculateVWAP(bars);
            expect(result[0]).toBeCloseTo(100, 10);
        });
    });

    describe('같은 날 여러 봉 입력일 때', () => {
        it('누적 VWAP을 반환한다', () => {
            // bar0: typicalPrice = (105 + 95 + 100) / 3 = 100, volume = 1000
            // bar1: typicalPrice = (110 + 90 + 100) / 3 = 100, volume = 2000
            // vwap[0] = (100 * 1000) / 1000 = 100
            // vwap[1] = (100 * 1000 + 100 * 2000) / (1000 + 2000) = 300000 / 3000 = 100
            const bars = makeBars([
                { high: 105, low: 95, close: 100, volume: 1000, time: 1 },
                { high: 110, low: 90, close: 100, volume: 2000, time: 1 },
            ]);
            const result = calculateVWAP(bars);
            expect(result[0]).toBeCloseTo(100, 10);
            expect(result[1]).toBeCloseTo(100, 10);
        });

        it('거래량 비중에 따라 VWAP이 달라진다', () => {
            // bar0: typicalPrice = (106 + 94 + 100) / 3 = 100, volume = 1000
            // bar1: typicalPrice = (115 + 105 + 110) / 3 = 110, volume = 3000
            // vwap[0] = 100
            // vwap[1] = (100 * 1000 + 110 * 3000) / 4000 = 430000 / 4000 = 107.5
            const bars = makeBars([
                { high: 106, low: 94, close: 100, volume: 1000, time: 1 },
                { high: 115, low: 105, close: 110, volume: 3000, time: 1 },
            ]);
            const result = calculateVWAP(bars);
            expect(result[0]).toBeCloseTo(100, 10);
            expect(result[1]).toBeCloseTo(107.5, 10);
        });

        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = makeBars([
                { high: 105, low: 95, close: 100, volume: 1000, time: 1 },
                { high: 106, low: 96, close: 101, volume: 2000, time: 1 },
                { high: 107, low: 97, close: 102, volume: 3000, time: 1 },
            ]);
            expect(calculateVWAP(bars)).toHaveLength(3);
        });
    });

    describe('날짜가 변경될 때', () => {
        it('날짜 변경 시 누적값을 초기화한다', () => {
            // day1: bar0 typicalPrice = 100, volume = 1000 → vwap = 100
            // day2: bar1 typicalPrice = 110, volume = 2000 → 새 누적 시작 → vwap = 110
            const bars = [
                makeBar({
                    time: 1 * SECONDS_PER_DAY,
                    high: 105,
                    low: 95,
                    close: 100,
                    volume: 1000,
                }),
                makeBar({
                    time: 2 * SECONDS_PER_DAY,
                    high: 115,
                    low: 105,
                    close: 110,
                    volume: 2000,
                }),
            ];
            const result = calculateVWAP(bars);
            expect(result[0]).toBeCloseTo(100, 10);
            expect(result[1]).toBeCloseTo(110, 10);
        });

        it('날짜 변경 후 같은 날 봉은 새 날짜 기준으로 누적된다', () => {
            // day1: bar0 typicalPrice = 100, volume = 1000 → vwap = 100
            // day2: bar1 typicalPrice = 110, volume = 1000 → vwap = 110 (초기화)
            // day2: bar2 typicalPrice = 120, volume = 1000 → vwap = (110+120)/2 = 115
            const bars = [
                makeBar({
                    time: 1 * SECONDS_PER_DAY,
                    high: 105,
                    low: 95,
                    close: 100,
                    volume: 1000,
                }),
                makeBar({
                    time: 2 * SECONDS_PER_DAY,
                    high: 115,
                    low: 105,
                    close: 110,
                    volume: 1000,
                }),
                makeBar({
                    time: 2 * SECONDS_PER_DAY + 3600,
                    high: 125,
                    low: 115,
                    close: 120,
                    volume: 1000,
                }),
            ];
            const result = calculateVWAP(bars);
            expect(result[0]).toBeCloseTo(100, 10);
            expect(result[1]).toBeCloseTo(110, 10);
            expect(result[2]).toBeCloseTo(115, 10);
        });
    });

    describe('거래량이 0일 때', () => {
        it('누적 거래량이 0이면 null을 반환한다', () => {
            const bars = [
                makeBar({ time: 0, high: 105, low: 95, close: 100, volume: 0 }),
            ];
            const result = calculateVWAP(bars);
            expect(result[0]).toBeNull();
        });
    });

    describe('계산 정확성', () => {
        it('첫 번째 유효값이 typicalPrice와 일치한다', () => {
            // typicalPrice = (110 + 90 + 100) / 3 = 100
            const bars = [
                makeBar({
                    time: 0,
                    high: 110,
                    low: 90,
                    close: 100,
                    volume: 5000,
                }),
            ];
            const result = calculateVWAP(bars);
            expect(result[0]).toBeCloseTo(100, 10);
        });

        it('세 봉의 누적 VWAP이 명세와 일치한다', () => {
            // bar0: tp = (110 + 90 + 100) / 3 = 100, vol = 1000 → vwap = 100
            // bar1: tp = (120 + 100 + 110) / 3 = 110, vol = 2000 → vwap = (100000 + 220000) / 3000 = 106.667
            // bar2: tp = (115 + 95 + 105) / 3 = 105, vol = 1000 → vwap = (320000 + 105000) / 4000 = 106.25
            const bars = makeBars([
                { high: 110, low: 90, close: 100, volume: 1000, time: 1 },
                { high: 120, low: 100, close: 110, volume: 2000, time: 1 },
                { high: 115, low: 95, close: 105, volume: 1000, time: 1 },
            ]);
            const result = calculateVWAP(bars);
            expect(result[0]).toBeCloseTo(100, 10);
            expect(result[1]).toBeCloseTo(106 + 2 / 3, 10);
            expect(result[2]).toBeCloseTo(106.25, 10);
        });
    });
});
