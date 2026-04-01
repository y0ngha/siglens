import {
    CANDLE_PATTERN_DETECTION_BARS,
    detectCandlePatternEntries,
    MULTI_CANDLE_PATTERN_BUFFER,
} from '@/domain/analysis/candle-detection';
import type { CandlePatternEntry } from '@/domain/analysis/candle-detection';
import type { Bar } from '@/domain/types';

const TEST_BAR_BASE_TIME = 1700000000;
const TEST_BAR_INTERVAL = 60;
const TEST_BAR_BASE_PRICE = 100;
const TEST_BAR_VOLUME = 1000;
const HAMMER_BODY_OFFSET = 3;
const HAMMER_HIGH_OFFSET = 5;
const HAMMER_LOW_OFFSET = -15;

const makeBar = (i: number, overrides?: Partial<Bar>): Bar => ({
    time: TEST_BAR_BASE_TIME + i * TEST_BAR_INTERVAL,
    open: TEST_BAR_BASE_PRICE,
    high: TEST_BAR_BASE_PRICE + 1,
    low: TEST_BAR_BASE_PRICE - 1,
    close: TEST_BAR_BASE_PRICE + 0.5,
    volume: TEST_BAR_VOLUME,
    ...overrides,
});

const makeHammerBar = (i: number): Bar =>
    makeBar(i, {
        open: TEST_BAR_BASE_PRICE,
        high: TEST_BAR_BASE_PRICE + HAMMER_HIGH_OFFSET,
        low: TEST_BAR_BASE_PRICE + HAMMER_LOW_OFFSET,
        close: TEST_BAR_BASE_PRICE + HAMMER_BODY_OFFSET,
    });

describe('candle-detection', () => {
    describe('detectCandlePatternEntries', () => {
        describe('bars가 비어있을 때', () => {
            it('빈 배열을 반환한다', () => {
                const result: CandlePatternEntry[] = detectCandlePatternEntries(
                    []
                );
                expect(result).toEqual([]);
            });
        });

        describe('bars가 CANDLE_PATTERN_DETECTION_BARS보다 적을 때', () => {
            it('가용한 bars에서 패턴을 감지한다', () => {
                const bars: Bar[] = [makeHammerBar(0)];
                const result: CandlePatternEntry[] =
                    detectCandlePatternEntries(bars);
                expect(result.length).toBeGreaterThanOrEqual(1);
                expect(result[0].patternType).toBe('single');
                expect(result[0].singlePattern).toBe('hammer');
            });
        });

        describe('단봉 패턴만 존재할 때', () => {
            it('단봉 패턴 엔트리를 반환한다', () => {
                const normalBars: Bar[] = Array.from(
                    { length: CANDLE_PATTERN_DETECTION_BARS },
                    (_, i) => makeBar(i)
                );
                // Replace last bar with a hammer
                const bars: Bar[] = [
                    ...normalBars.slice(0, -1),
                    makeHammerBar(CANDLE_PATTERN_DETECTION_BARS - 1),
                ];
                const result: CandlePatternEntry[] =
                    detectCandlePatternEntries(bars);

                const hammerEntry = result.find(
                    e => e.singlePattern === 'hammer'
                );
                expect(hammerEntry).toBeDefined();
                expect(hammerEntry?.patternType).toBe('single');
                expect(hammerEntry?.multiPattern).toBeNull();
            });
        });

        describe('제외 대상 단봉 패턴일 때', () => {
            it('기본 형태 패턴은 결과에 포함되지 않는다', () => {
                // Normal bars produce 'bullish' or 'bearish' which are excluded
                const bars: Bar[] = Array.from(
                    { length: CANDLE_PATTERN_DETECTION_BARS },
                    (_, i) => makeBar(i)
                );
                const result: CandlePatternEntry[] =
                    detectCandlePatternEntries(bars);
                const excludedEntries = result.filter(
                    e =>
                        e.singlePattern === 'bullish' ||
                        e.singlePattern === 'bearish' ||
                        e.singlePattern === 'flat' ||
                        e.singlePattern === 'spinning_top'
                );
                expect(excludedEntries).toEqual([]);
            });
        });

        describe('barIndex 정렬', () => {
            it('barIndex 오름차순으로 정렬된다', () => {
                const bars: Bar[] = Array.from(
                    {
                        length:
                            CANDLE_PATTERN_DETECTION_BARS +
                            MULTI_CANDLE_PATTERN_BUFFER,
                    },
                    (_, i) => makeHammerBar(i)
                );
                const result: CandlePatternEntry[] =
                    detectCandlePatternEntries(bars);
                const indices: number[] = result.map(e => e.barIndex);
                const sortedIndices: number[] = [...indices].sort(
                    (a, b) => a - b
                );
                expect(indices).toEqual(sortedIndices);
            });
        });

        describe('MULTI_CANDLE_PATTERN_BUFFER 상수', () => {
            it('3봉 패턴 감지를 위해 2의 값을 갖는다', () => {
                expect(MULTI_CANDLE_PATTERN_BUFFER).toBe(2);
            });
        });

        describe('다봉 패턴 관련 모든 봉에서 단봉 패턴 제외', () => {
            it('다봉 패턴에 포함된 봉은 단봉 결과에서 제외된다', () => {
                const bars: Bar[] = Array.from(
                    {
                        length:
                            CANDLE_PATTERN_DETECTION_BARS +
                            MULTI_CANDLE_PATTERN_BUFFER,
                    },
                    (_, i) => makeBar(i)
                );
                const result: CandlePatternEntry[] =
                    detectCandlePatternEntries(bars);
                const multiEntries = result.filter(
                    e => e.patternType === 'multi'
                );
                const singleBarIndices = new Set(
                    result
                        .filter(e => e.patternType === 'single')
                        .map(e => e.barIndex)
                );

                // No single entry should share a barIndex with any multi entry
                multiEntries.forEach(multi => {
                    expect(singleBarIndices.has(multi.barIndex)).toBe(false);
                });
            });
        });
    });
});
