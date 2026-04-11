import { calculateBuySellVolume } from '@/domain/indicators/buySellVolume';
import type { Bar } from '@/domain/types';

function makeBar(
    overrides: Partial<Bar> & {
        high: number;
        low: number;
        close: number;
        volume: number;
    }
): Bar {
    return {
        time: 0,
        open: overrides.close,
        ...overrides,
    };
}

describe('calculateBuySellVolume', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateBuySellVolume([])).toEqual([]);
        });
    });

    describe('high === low인 경우 (range = 0)', () => {
        it('buyVolume과 sellVolume 모두 0을 반환한다', () => {
            const bar = makeBar({
                high: 100,
                low: 100,
                close: 100,
                volume: 5000,
            });
            const [result] = calculateBuySellVolume([bar]);
            expect(result.buyVolume).toBe(0);
            expect(result.sellVolume).toBe(0);
        });
    });

    describe('정상 range를 가진 봉', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const bars = [
                makeBar({ high: 105, low: 95, close: 102, volume: 1000 }),
                makeBar({ high: 110, low: 100, close: 105, volume: 2000 }),
            ];
            expect(calculateBuySellVolume(bars)).toHaveLength(2);
        });

        it('close가 high일 때 buyVolume이 전체 거래량이다', () => {
            const bar = makeBar({
                high: 110,
                low: 100,
                close: 110,
                volume: 1000,
            });
            const [result] = calculateBuySellVolume([bar]);
            expect(result.buyVolume).toBeCloseTo(1000);
            expect(result.sellVolume).toBeCloseTo(0);
        });

        it('close가 low일 때 sellVolume이 전체 거래량이다', () => {
            const bar = makeBar({
                high: 110,
                low: 100,
                close: 100,
                volume: 1000,
            });
            const [result] = calculateBuySellVolume([bar]);
            expect(result.buyVolume).toBeCloseTo(0);
            expect(result.sellVolume).toBeCloseTo(1000);
        });

        it('close가 중간일 때 buyVolume + sellVolume이 전체 거래량과 같다', () => {
            const bar = makeBar({
                high: 110,
                low: 100,
                close: 105,
                volume: 1000,
            });
            const [result] = calculateBuySellVolume([bar]);
            expect(result.buyVolume + result.sellVolume).toBeCloseTo(1000);
        });

        it('계산값이 PineScript 공식과 일치한다', () => {
            // buyVolume = volume * (close - low) / (high - low)
            // sellVolume = volume * (high - close) / (high - low)
            // high=110, low=100, close=102, volume=1000
            // buyVolume = 1000 * (102-100) / (110-100) = 1000 * 2/10 = 200
            // sellVolume = 1000 * (110-102) / (110-100) = 1000 * 8/10 = 800
            const bar = makeBar({
                high: 110,
                low: 100,
                close: 102,
                volume: 1000,
            });
            const [result] = calculateBuySellVolume([bar]);
            expect(result.buyVolume).toBeCloseTo(200);
            expect(result.sellVolume).toBeCloseTo(800);
        });
    });
});
