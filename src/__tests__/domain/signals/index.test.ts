import { classifyTrend, detectSignals } from '@/domain/signals';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import type { Bar, IndicatorResult } from '@/domain/types';

describe('detectSignals', () => {
    describe('빈 bars가 주어지면', () => {
        it('빈 배열을 반환한다', () => {
            expect(detectSignals([], EMPTY_INDICATOR_RESULT)).toEqual([]);
        });
    });

    describe('RSI가 극단 값을 가지면', () => {
        it('해당 확정 신호를 포함한다', () => {
            const bars: Bar[] = Array.from({ length: 20 }, (_, i) => ({
                time: 1 + i,
                open: 100,
                high: 100,
                low: 100,
                close: 100,
                volume: 100,
            }));
            const indicators: IndicatorResult = {
                ...EMPTY_INDICATOR_RESULT,
                rsi: [...Array(19).fill(50), 25],
            };
            const signals = detectSignals(bars, indicators);
            expect(signals.some(s => s.type === 'rsi_oversold')).toBe(true);
        });
    });

    describe('모든 감지기가 null일 때', () => {
        it('빈 배열을 반환한다', () => {
            const bars: Bar[] = Array.from({ length: 20 }, (_, i) => ({
                time: 1 + i,
                open: 100,
                high: 100,
                low: 100,
                close: 100,
                volume: 100,
            }));
            const indicators: IndicatorResult = {
                ...EMPTY_INDICATOR_RESULT,
                rsi: Array(20).fill(50),
            };
            expect(detectSignals(bars, indicators)).toEqual([]);
        });
    });

    describe('classifyTrend 재노출', () => {
        it('signals 인덱스에서 classifyTrend를 호출할 수 있다', () => {
            const bars: Bar[] = Array.from({ length: 20 }, (_, i) => ({
                time: 1 + i,
                open: 100,
                high: 100,
                low: 100,
                close: 100,
                volume: 100,
            }));
            expect(classifyTrend(bars, EMPTY_INDICATOR_RESULT)).toBeDefined();
        });
    });
});
