import {
    detectRsiOversold,
    detectRsiOverbought,
    detectGoldenCross,
    detectDeathCross,
} from '@/domain/signals/confirmed';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import { calculateMA } from '@/domain/indicators/ma';
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

    describe('RSI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            expect(detectRsiOverbought(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('마지막 RSI가 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            const indicators = withRsi([null, null, null, null, null]);
            expect(detectRsiOverbought(bars, indicators)).toBeNull();
        });
    });
});

function buildBarsWithCloses(closes: number[]): Bar[] {
    return closes.map((c, i) => ({
        time: 1700000000 + i * 86400,
        open: c,
        high: c,
        low: c,
        close: c,
        volume: 1000,
    }));
}

describe('detectGoldenCross', () => {
    describe('최근 3봉 내 MA20이 MA50을 상향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            // V-shape: 45봉 하락(100→77.5) 후 15봉 상승(77.5→105.5).
            // MA20이 MA50을 마지막 3봉 내에서 상향 교차하도록 설계.
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 - i * 0.5),
                ...Array.from({ length: 15 }, (_, i) => 77.5 + i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            const result = detectGoldenCross(bars, EMPTY_INDICATOR_RESULT);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('golden_cross');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('교차가 4봉 이전에 발생했을 때', () => {
        it('null을 반환한다', () => {
            // 45봉 하락 + 20봉 상승 → 교차가 idx=59 부근에서 발생하고
            // len=65이므로 교차-to-last 거리가 5봉 → 최근 3봉 밖.
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 - i * 0.5),
                ...Array.from({ length: 20 }, (_, i) => 77.5 + i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            expect(detectGoldenCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('bars가 MA50에 부족할 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBarsWithCloses(Array(30).fill(100));
            expect(detectGoldenCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('bars가 51봉이어서 lookback 범위에 null MA 구간이 포함될 때', () => {
        it('null MA 봉은 건너뛰고 평탄 가격이라 교차가 없으므로 null을 반환한다', () => {
            // 51봉 flat: len=51, start=max(1, 51-3)=48. MA50은 idx=48에서 null이라
            // null 건너뛰기 분기(continue)가 실행됨.
            const bars = buildBarsWithCloses(Array(51).fill(100));
            expect(detectGoldenCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('indicators.ma[20]이 사전 계산되어 제공된 경우', () => {
        it('사전 계산된 MA20을 재사용하여 Signal을 반환한다', () => {
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 - i * 0.5),
                ...Array.from({ length: 15 }, (_, i) => 77.5 + i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            // 캐리어 역할: ma[20]이 EMPTY가 아니라 실제 계산된 배열이 주어진 경우
            // ?? 연산자의 왼쪽 피연산자가 선택되는 분기를 커버.
            const precomputedMa20 = calculateMA(bars, 20);
            const indicators: IndicatorResult = {
                ...EMPTY_INDICATOR_RESULT,
                ma: { 20: precomputedMa20 },
            };
            const result = detectGoldenCross(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('golden_cross');
        });
    });
});

describe('detectDeathCross', () => {
    describe('최근 3봉 내 MA20이 MA50을 하향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            // Inverted V-shape: 45봉 상승(100→122.5) 후 15봉 하락(122.5→94.5).
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 + i * 0.5),
                ...Array.from({ length: 15 }, (_, i) => 122.5 - i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            const result = detectDeathCross(bars, EMPTY_INDICATOR_RESULT);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('death_cross');
            expect(result?.direction).toBe('bearish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('교차가 발생하지 않았을 때', () => {
        it('null을 반환한다', () => {
            const closes = Array(80).fill(100);
            const bars = buildBarsWithCloses(closes);
            expect(detectDeathCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('bars가 MA50에 부족할 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBarsWithCloses(Array(30).fill(100));
            expect(detectDeathCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('indicators.ma[20]이 사전 계산되어 제공된 경우', () => {
        it('사전 계산된 MA20을 재사용하여 Signal을 반환한다', () => {
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 + i * 0.5),
                ...Array.from({ length: 15 }, (_, i) => 122.5 - i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            const precomputedMa20 = calculateMA(bars, 20);
            const indicators: IndicatorResult = {
                ...EMPTY_INDICATOR_RESULT,
                ma: { 20: precomputedMa20 },
            };
            const result = detectDeathCross(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('death_cross');
        });
    });
});
