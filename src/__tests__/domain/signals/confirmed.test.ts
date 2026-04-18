import {
    detectRsiOversold,
    detectRsiOverbought,
} from '@/domain/signals/confirmed';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import type { Bar, IndicatorResult } from '@/domain/types';

function buildBars(n: number): Bar[] {
    return Array.from({ length: n }, (_, i) => ({
        time: 1700000000 + i * 86400,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1000,
    }));
}

function withRsi(values: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, rsi: values };
}

describe('detectRsiOversold', () => {
    describe('마지막 RSI가 30 미만일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 25]);
            const result = detectRsiOversold(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('rsi_oversold');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(19);
        });
    });

    describe('마지막 RSI가 30 이상일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 35]);
            expect(detectRsiOversold(bars, indicators)).toBeNull();
        });
    });

    describe('경계값 RSI=30일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 30]);
            expect(detectRsiOversold(bars, indicators)).toBeNull();
        });
    });

    describe('RSI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            expect(detectRsiOversold(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('마지막 RSI가 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            const indicators = withRsi([null, null, null, null, null]);
            expect(detectRsiOversold(bars, indicators)).toBeNull();
        });
    });
});

describe('detectRsiOverbought', () => {
    describe('마지막 RSI가 70 초과일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 75]);
            const result = detectRsiOverbought(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('rsi_overbought');
            expect(result?.direction).toBe('bearish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('마지막 RSI가 70 이하일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 65]);
            expect(detectRsiOverbought(bars, indicators)).toBeNull();
        });
    });

    describe('경계값 RSI=70일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 70]);
            expect(detectRsiOverbought(bars, indicators)).toBeNull();
        });
    });
});
