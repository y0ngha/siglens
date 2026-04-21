import {
    EMPTY_QUADRANTS,
    filterStrictAnticipation,
    groupStockIntoQuadrants,
} from '@/domain/signals/quadrants';
import type {
    QuadrantKey,
    Signal,
    StockSignalResult,
    StockWithConflict,
} from '@/domain/types';

function buildSignal(
    direction: 'bullish' | 'bearish',
    phase: 'confirmed' | 'expected' = 'confirmed'
): Signal {
    return {
        type: direction === 'bullish' ? 'rsi_oversold' : 'rsi_overbought',
        direction,
        phase,
        detectedAt: 0,
    };
}

function buildStock(
    overrides: Partial<StockSignalResult> = {}
): StockSignalResult {
    return {
        symbol: 'AAPL',
        koreanName: '애플',
        sectorSymbol: 'XLK',
        price: 100,
        changePercent: 0,
        trend: 'sideways',
        signals: [],
        ...overrides,
    };
}

function buildStockWithConflict(
    overrides: Partial<StockWithConflict> = {}
): StockWithConflict {
    return { ...buildStock(), ...overrides };
}

describe('groupStockIntoQuadrants', () => {
    describe('빈 신호 배열', () => {
        it('acc를 그대로 반환한다', () => {
            const stock = buildStockWithConflict({ signals: [] });
            const result = groupStockIntoQuadrants(EMPTY_QUADRANTS, stock);
            expect(result).toEqual(EMPTY_QUADRANTS);
        });
    });

    describe('단일 direction × phase 조합', () => {
        it('bullish + confirmed는 bullishConfirmed에 분류된다', () => {
            const stock = buildStockWithConflict({
                signals: [buildSignal('bullish', 'confirmed')],
            });
            const result = groupStockIntoQuadrants(EMPTY_QUADRANTS, stock);
            expect(result.bullishConfirmed).toHaveLength(1);
            expect(result.bullishExpected).toHaveLength(0);
            expect(result.bearishExpected).toHaveLength(0);
            expect(result.bearishConfirmed).toHaveLength(0);
        });

        it('bullish + expected는 bullishExpected에 분류된다', () => {
            const stock = buildStockWithConflict({
                signals: [buildSignal('bullish', 'expected')],
            });
            const result = groupStockIntoQuadrants(EMPTY_QUADRANTS, stock);
            expect(result.bullishExpected).toHaveLength(1);
            expect(result.bullishConfirmed).toHaveLength(0);
        });

        it('bearish + confirmed는 bearishConfirmed에 분류된다', () => {
            const stock = buildStockWithConflict({
                signals: [buildSignal('bearish', 'confirmed')],
            });
            const result = groupStockIntoQuadrants(EMPTY_QUADRANTS, stock);
            expect(result.bearishConfirmed).toHaveLength(1);
        });

        it('bearish + expected는 bearishExpected에 분류된다', () => {
            const stock = buildStockWithConflict({
                signals: [buildSignal('bearish', 'expected')],
            });
            const result = groupStockIntoQuadrants(EMPTY_QUADRANTS, stock);
            expect(result.bearishExpected).toHaveLength(1);
        });
    });

    describe('여러 phase가 섞인 종목', () => {
        it('같은 종목이 두 분면에 각각 따로 분류된다', () => {
            const stock = buildStockWithConflict({
                symbol: 'MSFT',
                signals: [
                    buildSignal('bullish', 'confirmed'),
                    buildSignal('bullish', 'expected'),
                ],
            });
            const result = groupStockIntoQuadrants(EMPTY_QUADRANTS, stock);
            expect(result.bullishConfirmed).toHaveLength(1);
            expect(result.bullishExpected).toHaveLength(1);
            expect(result.bullishConfirmed[0].signals).toHaveLength(1);
            expect(result.bullishExpected[0].signals).toHaveLength(1);
        });
    });

    describe('누적(acc)이 있는 경우', () => {
        it('기존 분면에 새 종목이 추가된다', () => {
            const first = buildStockWithConflict({
                symbol: 'AAPL',
                signals: [buildSignal('bullish', 'confirmed')],
            });
            const second = buildStockWithConflict({
                symbol: 'MSFT',
                signals: [buildSignal('bullish', 'confirmed')],
            });
            const after1 = groupStockIntoQuadrants(EMPTY_QUADRANTS, first);
            const after2 = groupStockIntoQuadrants(after1, second);
            expect(after2.bullishConfirmed).toHaveLength(2);
        });
    });
});

describe('filterStrictAnticipation', () => {
    describe('confirmed signals', () => {
        it('trend와 무관하게 모두 통과시킨다', () => {
            const stock = buildStock({
                trend: 'uptrend',
                signals: [buildSignal('bullish', 'confirmed')],
            });
            const result = filterStrictAnticipation([stock]);
            expect(result).toHaveLength(1);
            expect(result[0].signals).toHaveLength(1);
        });
    });

    describe('bullish expected signals', () => {
        it('trend가 uptrend면 제거한다', () => {
            const stock = buildStock({
                trend: 'uptrend',
                signals: [buildSignal('bullish', 'expected')],
            });
            const result = filterStrictAnticipation([stock]);
            expect(result).toHaveLength(0);
        });

        it('trend가 sideways면 통과시킨다', () => {
            const stock = buildStock({
                trend: 'sideways',
                signals: [buildSignal('bullish', 'expected')],
            });
            const result = filterStrictAnticipation([stock]);
            expect(result).toHaveLength(1);
        });

        it('trend가 downtrend면 통과시킨다', () => {
            const stock = buildStock({
                trend: 'downtrend',
                signals: [buildSignal('bullish', 'expected')],
            });
            const result = filterStrictAnticipation([stock]);
            expect(result).toHaveLength(1);
        });
    });

    describe('bearish expected signals', () => {
        it('trend가 downtrend면 제거한다', () => {
            const stock = buildStock({
                trend: 'downtrend',
                signals: [buildSignal('bearish', 'expected')],
            });
            const result = filterStrictAnticipation([stock]);
            expect(result).toHaveLength(0);
        });

        it('trend가 uptrend면 통과시킨다', () => {
            const stock = buildStock({
                trend: 'uptrend',
                signals: [buildSignal('bearish', 'expected')],
            });
            const result = filterStrictAnticipation([stock]);
            expect(result).toHaveLength(1);
        });

        it('trend가 sideways면 통과시킨다', () => {
            const stock = buildStock({
                trend: 'sideways',
                signals: [buildSignal('bearish', 'expected')],
            });
            const result = filterStrictAnticipation([stock]);
            expect(result).toHaveLength(1);
        });
    });

    describe('모든 신호가 필터된 종목', () => {
        it('종목 전체가 결과에서 제외된다', () => {
            const stock = buildStock({
                trend: 'uptrend',
                signals: [buildSignal('bullish', 'expected')],
            });
            const result = filterStrictAnticipation([stock]);
            expect(result).toHaveLength(0);
        });
    });

    describe('부분 필터링', () => {
        it('남은 신호만으로 새 종목 객체를 만든다', () => {
            const stock = buildStock({
                trend: 'uptrend',
                signals: [
                    buildSignal('bullish', 'confirmed'),
                    buildSignal('bullish', 'expected'),
                ],
            });
            const result = filterStrictAnticipation([stock]);
            expect(result).toHaveLength(1);
            expect(result[0].signals).toHaveLength(1);
            expect(result[0].signals[0].phase).toBe('confirmed');
        });
    });

    describe('QuadrantKey 타입 가드', () => {
        it('EMPTY_QUADRANTS는 4개 키를 모두 포함한다', () => {
            const keys: QuadrantKey[] = [
                'bullishConfirmed',
                'bullishExpected',
                'bearishExpected',
                'bearishConfirmed',
            ];
            keys.forEach(k => {
                expect(EMPTY_QUADRANTS[k]).toEqual([]);
            });
        });
    });
});
