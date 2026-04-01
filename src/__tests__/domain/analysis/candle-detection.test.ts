import {
    CANDLE_PATTERN_DETECTION_BARS,
    detectCandlePatternEntries,
    getDetectionBars,
    MULTI_CANDLE_PATTERN_BUFFER,
    selectLastCandlePatternEntries,
} from '@/domain/analysis/candle-detection';
import type {
    CandlePatternEntry,
    SingleCandlePatternEntry,
    MultiCandlePatternEntry,
} from '@/domain/analysis/candle-detection';
import {
    makeBar,
    makeEngulfingPair,
    makeHammerBar,
} from '@/__tests__/fixtures/candle';
import type { Bar } from '@/domain/types';

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
                const totalLength =
                    CANDLE_PATTERN_DETECTION_BARS + MULTI_CANDLE_PATTERN_BUFFER;
                const normalBars: Bar[] = Array.from(
                    { length: totalLength - 2 },
                    (_, i) => makeBar(i)
                );
                // Place a bullish engulfing pair at the end to guarantee multi-candle detection
                const [bearish, bullish] = makeEngulfingPair(totalLength - 2);
                const bars: Bar[] = [...normalBars, bearish, bullish];

                const result: CandlePatternEntry[] =
                    detectCandlePatternEntries(bars);
                const multiEntries = result.filter(
                    e => e.patternType === 'multi'
                );

                // Unconditional assertion: engulfing pair guarantees at least one multi entry
                expect(multiEntries.length).toBeGreaterThanOrEqual(1);

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

    describe('getDetectionBars', () => {
        describe('bars가 비어있을 때', () => {
            it('빈 배열을 반환한다', () => {
                expect(getDetectionBars([])).toEqual([]);
            });
        });

        describe('bars가 CANDLE_PATTERN_DETECTION_BARS보다 적을 때', () => {
            it('전체 bars를 반환한다', () => {
                const TEST_BAR_COUNT = 5;
                const bars = Array.from({ length: TEST_BAR_COUNT }, (_, i) =>
                    makeBar(i)
                );
                const result = getDetectionBars(bars);
                expect(result).toHaveLength(TEST_BAR_COUNT);
                expect(result).toEqual(bars);
            });
        });

        describe('bars가 CANDLE_PATTERN_DETECTION_BARS보다 많을 때', () => {
            it('마지막 CANDLE_PATTERN_DETECTION_BARS개의 bars를 반환한다', () => {
                const EXTRA_BARS = 10;
                const totalCount = CANDLE_PATTERN_DETECTION_BARS + EXTRA_BARS;
                const bars = Array.from({ length: totalCount }, (_, i) =>
                    makeBar(i)
                );
                const result = getDetectionBars(bars);
                expect(result).toHaveLength(CANDLE_PATTERN_DETECTION_BARS);
                expect(result[0].time).toBe(bars[EXTRA_BARS].time);
            });
        });
    });

    describe('selectLastCandlePatternEntries', () => {
        const makeSingleEntry = (
            barIndex: number,
            pattern: 'hammer' | 'doji' | 'shooting_star' = 'hammer'
        ): SingleCandlePatternEntry => ({
            barIndex,
            patternType: 'single',
            singlePattern: pattern,
            multiPattern: null,
        });

        const makeMultiEntry = (
            barIndex: number,
            pattern: 'bullish_engulfing' | 'morning_star' = 'bullish_engulfing'
        ): MultiCandlePatternEntry => ({
            barIndex,
            patternType: 'multi',
            singlePattern: null,
            multiPattern: pattern,
        });

        describe('entries가 비어있을 때', () => {
            it('빈 배열을 반환한다', () => {
                const result = selectLastCandlePatternEntries([], []);
                expect(result).toEqual([]);
            });
        });

        describe('단봉 패턴만 존재할 때', () => {
            it('마지막 단봉 패턴만 반환한다', () => {
                const entries: CandlePatternEntry[] = [
                    makeSingleEntry(0, 'hammer'),
                    makeSingleEntry(3, 'doji'),
                    makeSingleEntry(7, 'shooting_star'),
                ];
                const result = selectLastCandlePatternEntries(entries, entries);
                expect(result).toHaveLength(1);
                expect(result[0].barIndex).toBe(7);
                expect(result[0].singlePattern).toBe('shooting_star');
            });

            it('단봉 패턴이 하나일 때 해당 패턴을 반환한다', () => {
                const entries: CandlePatternEntry[] = [
                    makeSingleEntry(5, 'hammer'),
                ];
                const result = selectLastCandlePatternEntries(entries, entries);
                expect(result).toHaveLength(1);
                expect(result[0]).toEqual(makeSingleEntry(5, 'hammer'));
            });
        });

        describe('다봉 패턴만 존재할 때', () => {
            it('마지막 다봉 패턴과 관련 봉의 단봉 패턴을 반환한다', () => {
                // allEntries includes single patterns for involved bars
                const allEntries: CandlePatternEntry[] = [
                    makeSingleEntry(2, 'hammer'),
                    makeSingleEntry(3, 'doji'),
                    makeSingleEntry(4, 'shooting_star'),
                    makeMultiEntry(4, 'bullish_engulfing'),
                ];
                const entries: CandlePatternEntry[] = [
                    makeMultiEntry(4, 'bullish_engulfing'),
                ];
                const result = selectLastCandlePatternEntries(
                    entries,
                    allEntries
                );
                const multiResult = result.find(e => e.patternType === 'multi');
                expect(multiResult).toBeDefined();
                expect(multiResult?.barIndex).toBe(4);

                const singleResults = result.filter(
                    e => e.patternType === 'single'
                );
                expect(singleResults.length).toBeGreaterThanOrEqual(1);
                singleResults.forEach(single => {
                    expect(single.barIndex).toBeLessThanOrEqual(4);
                    expect(single.barIndex).toBeGreaterThanOrEqual(
                        Math.max(0, 4 - MULTI_CANDLE_PATTERN_BUFFER)
                    );
                });

                expect(result[result.length - 1].patternType).toBe('multi');
            });
        });

        describe('단봉과 다봉 패턴이 혼합되어 있을 때', () => {
            it('마지막 다봉 패턴 기준으로 관련 엔트리를 반환한다', () => {
                const entries: CandlePatternEntry[] = [
                    makeSingleEntry(0, 'hammer'),
                    makeSingleEntry(5, 'doji'),
                    makeSingleEntry(8, 'hammer'),
                    makeSingleEntry(9, 'doji'),
                    makeMultiEntry(10, 'bullish_engulfing'),
                ];
                const result = selectLastCandlePatternEntries(entries, entries);
                const multiResult = result.find(e => e.patternType === 'multi');
                expect(multiResult).toBeDefined();
                expect(multiResult?.barIndex).toBe(10);
            });

            it('결과가 barIndex 오름차순으로 정렬된다', () => {
                const entries: CandlePatternEntry[] = [
                    makeSingleEntry(2, 'hammer'),
                    makeSingleEntry(4, 'doji'),
                    makeSingleEntry(5, 'shooting_star'),
                    makeMultiEntry(6, 'morning_star'),
                ];
                const result = selectLastCandlePatternEntries(entries, entries);
                const indices = result.map(e => e.barIndex);
                const sorted = [...indices].sort((a, b) => a - b);
                expect(indices).toEqual(sorted);
            });
        });

        describe('다봉 패턴이 barIndex 0에 위치할 때', () => {
            it('startBarIndex가 0 미만으로 내려가지 않는다', () => {
                const allEntries: CandlePatternEntry[] = [
                    makeSingleEntry(0, 'hammer'),
                    makeMultiEntry(0, 'bullish_engulfing'),
                ];
                const entries: CandlePatternEntry[] = [
                    makeMultiEntry(0, 'bullish_engulfing'),
                ];
                const result = selectLastCandlePatternEntries(
                    entries,
                    allEntries
                );
                const allIndices = result.map(e => e.barIndex);
                allIndices.forEach(idx => {
                    expect(idx).toBeGreaterThanOrEqual(0);
                });
            });
        });
    });
});
