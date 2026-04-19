import { simulateExit } from '@/domain/backtest/exit';
import type { Bar } from '@/domain/types';

function bar(low: number, high: number, close: number, idx = 0): Bar {
    return {
        time: 1700000000 + idx * 86400,
        open: close,
        low,
        high,
        close,
        volume: 1000,
    };
}

describe('simulateExit', () => {
    describe('TP가 먼저 달성될 때', () => {
        it('take_profit exit을 반환한다', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(99, 101, 100, 1),
                bar(102, 110, 108, 2),
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 95,
                takeProfit: 105,
                maxHoldDays: 10,
            });
            expect(result.exitIdx).toBe(2);
            expect(result.exitPrice).toBe(105);
            expect(result.exitReason).toBe('take_profit');
            expect(result.holdingDays).toBe(2);
            expect(result.returnPct).toBeCloseTo(5.0, 3);
        });
    });

    describe('SL이 먼저 발동될 때', () => {
        it('stop_loss exit을 반환한다', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(90, 100, 93, 1),
                bar(100, 110, 108, 2),
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 95,
                takeProfit: 105,
                maxHoldDays: 10,
            });
            expect(result.exitIdx).toBe(1);
            expect(result.exitPrice).toBe(95);
            expect(result.exitReason).toBe('stop_loss');
            expect(result.returnPct).toBeCloseTo(-5.0, 3);
        });
    });

    describe('동일 bar에서 SL·TP 모두 발동할 때', () => {
        it('SL을 우선 반환한다 (보수적 가정)', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(94, 106, 100, 1),
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 95,
                takeProfit: 105,
                maxHoldDays: 10,
            });
            expect(result.exitReason).toBe('stop_loss');
            expect(result.exitPrice).toBe(95);
        });
    });

    describe('SL·TP 모두 미발동 → 시간 만기', () => {
        it('time exit을 반환하고 close 가격 사용', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(99, 102, 101, 1),
                bar(100, 104, 103, 2),
                bar(100, 104, 102, 3),
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 95,
                takeProfit: 110,
                maxHoldDays: 3,
            });
            expect(result.exitIdx).toBe(3);
            expect(result.exitPrice).toBe(102);
            expect(result.exitReason).toBe('time');
            expect(result.holdingDays).toBe(3);
        });
    });

    describe('SL·TP 모두 undefined', () => {
        it('항상 time exit으로 만기 bar close 반환', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(90, 115, 110, 1),
                bar(100, 105, 103, 2),
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: undefined,
                takeProfit: undefined,
                maxHoldDays: 2,
            });
            expect(result.exitReason).toBe('time');
            expect(result.exitIdx).toBe(2);
            expect(result.exitPrice).toBe(103);
        });
    });

    describe('maxHoldDays가 bars 길이를 초과할 때', () => {
        it('가용 마지막 bar에서 time exit', () => {
            const bars: Bar[] = [
                bar(100, 100, 100, 0),
                bar(100, 102, 101, 1),
            ];
            const result = simulateExit({
                bars,
                entryIdx: 0,
                entryPrice: 100,
                stopLoss: 90,
                takeProfit: 110,
                maxHoldDays: 10,
            });
            expect(result.exitReason).toBe('time');
            expect(result.exitIdx).toBe(1);
            expect(result.exitPrice).toBe(101);
        });
    });
});
