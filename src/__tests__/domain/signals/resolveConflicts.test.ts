import { resolveConflicts } from '@/domain/signals/resolveConflicts';
import type { StockSignalResult, Signal } from '@/domain/types';

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

describe('resolveConflicts', () => {
    describe('빈 배열', () => {
        it('resolved와 mixed 모두 빈 배열을 반환한다', () => {
            const result = resolveConflicts([]);
            expect(result.resolved).toEqual([]);
            expect(result.mixed).toEqual([]);
        });
    });

    describe('단방향 신호만 있는 경우 (충돌 없음)', () => {
        it('상승 신호만 있는 종목은 conflict 없이 resolved에 포함된다', () => {
            const stock = buildStock({
                signals: [buildSignal('bullish'), buildSignal('bullish')],
            });
            const { resolved, mixed } = resolveConflicts([stock]);
            expect(resolved).toHaveLength(1);
            expect(resolved[0].conflict).toBeUndefined();
            expect(mixed).toHaveLength(0);
        });

        it('하락 신호만 있는 종목은 conflict 없이 resolved에 포함된다', () => {
            const stock = buildStock({ signals: [buildSignal('bearish')] });
            const { resolved, mixed } = resolveConflicts([stock]);
            expect(resolved).toHaveLength(1);
            expect(resolved[0].conflict).toBeUndefined();
            expect(mixed).toHaveLength(0);
        });

        it('신호가 없는 종목은 conflict 없이 resolved에 포함된다', () => {
            const stock = buildStock({ signals: [] });
            const { resolved, mixed } = resolveConflicts([stock]);
            expect(resolved).toHaveLength(1);
            expect(resolved[0].conflict).toBeUndefined();
            expect(mixed).toHaveLength(0);
        });
    });

    describe('bullishCount === bearishCount (mixed 분류)', () => {
        it('동수인 종목은 mixed에 포함되며 conflict 필드를 가진다', () => {
            const stock = buildStock({
                signals: [buildSignal('bullish'), buildSignal('bearish')],
            });
            const { resolved, mixed } = resolveConflicts([stock]);
            expect(resolved).toHaveLength(0);
            expect(mixed).toHaveLength(1);
            expect(mixed[0].conflict).toEqual({
                bullishCount: 1,
                bearishCount: 1,
            });
        });

        it('동수(2:2)인 경우 원본 signals를 그대로 유지한다', () => {
            const signals = [
                buildSignal('bullish'),
                buildSignal('bullish'),
                buildSignal('bearish'),
                buildSignal('bearish'),
            ];
            const stock = buildStock({ signals });
            const { mixed } = resolveConflicts([stock]);
            expect(mixed[0].signals).toHaveLength(4);
        });
    });

    describe('bullishCount > bearishCount (상승 우세)', () => {
        it('상승 우세 종목은 resolved에 포함되며 bullish signals만 남는다', () => {
            const stock = buildStock({
                signals: [
                    buildSignal('bullish'),
                    buildSignal('bullish'),
                    buildSignal('bearish'),
                ],
            });
            const { resolved, mixed } = resolveConflicts([stock]);
            expect(resolved).toHaveLength(1);
            expect(mixed).toHaveLength(0);
            expect(
                resolved[0].signals.every(s => s.direction === 'bullish')
            ).toBe(true);
            expect(resolved[0].signals).toHaveLength(2);
        });

        it('conflict 필드에 원본 카운트가 보존된다', () => {
            const stock = buildStock({
                signals: [
                    buildSignal('bullish'),
                    buildSignal('bullish'),
                    buildSignal('bearish'),
                ],
            });
            const { resolved } = resolveConflicts([stock]);
            expect(resolved[0].conflict).toEqual({
                bullishCount: 2,
                bearishCount: 1,
            });
        });
    });

    describe('bearishCount > bullishCount (하락 우세)', () => {
        it('하락 우세 종목은 resolved에 포함되며 bearish signals만 남는다', () => {
            const stock = buildStock({
                signals: [
                    buildSignal('bullish'),
                    buildSignal('bearish'),
                    buildSignal('bearish'),
                ],
            });
            const { resolved, mixed } = resolveConflicts([stock]);
            expect(resolved).toHaveLength(1);
            expect(mixed).toHaveLength(0);
            expect(
                resolved[0].signals.every(s => s.direction === 'bearish')
            ).toBe(true);
            expect(resolved[0].signals).toHaveLength(2);
        });

        it('conflict 필드에 원본 카운트가 보존된다', () => {
            const stock = buildStock({
                signals: [
                    buildSignal('bullish'),
                    buildSignal('bearish'),
                    buildSignal('bearish'),
                ],
            });
            const { resolved } = resolveConflicts([stock]);
            expect(resolved[0].conflict).toEqual({
                bullishCount: 1,
                bearishCount: 2,
            });
        });
    });

    describe('복수 종목 혼합', () => {
        it('충돌 없는 종목, mixed 종목, 우세 방향 종목을 각각 올바른 버킷으로 분류한다', () => {
            const noConflict = buildStock({
                symbol: 'A',
                signals: [buildSignal('bullish')],
            });
            const mixed = buildStock({
                symbol: 'B',
                signals: [buildSignal('bullish'), buildSignal('bearish')],
            });
            const resolved = buildStock({
                symbol: 'C',
                signals: [
                    buildSignal('bullish'),
                    buildSignal('bullish'),
                    buildSignal('bearish'),
                ],
            });

            const result = resolveConflicts([noConflict, mixed, resolved]);
            expect(result.resolved.map(s => s.symbol)).toEqual(['A', 'C']);
            expect(result.mixed.map(s => s.symbol)).toEqual(['B']);
        });
    });
});
