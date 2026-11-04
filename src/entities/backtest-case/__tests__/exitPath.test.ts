import type {
    BacktestEntryType,
    BacktestLegExitReason,
    BacktestTrade,
} from '@y0ngha/siglens-core';
import { exitPathOf } from '@/entities/backtest-case/lib/exitPath';

function trade(
    entryType: BacktestEntryType,
    a: BacktestLegExitReason,
    b: BacktestLegExitReason
): BacktestTrade {
    const leg = (name: 'A' | 'B', reason: BacktestLegExitReason) => ({
        name,
        size: 0.5,
        exitDate: '2025-01-03',
        exitPrice: 100,
        reason,
        returnPct: 0,
    });
    return {
        ticker: 'AAA',
        entryType,
        decisionDate: '2025-01-01',
        entryDate: '2025-01-02',
        entryPrice: 100,
        exitDate: '2025-01-03',
        holdingDays: 1,
        returnPct: 0,
        legs: [leg('A', a), leg('B', b)],
        initialPlan: { tp1: 1, tpFinal: 2, sl1: 0.5, sl2: 0.4, source: 'ai' },
        holdingReviews: 0,
        summary: '',
    };
}

describe('exitPathOf', () => {
    it.each([
        ['wait_limit', 'tp1', 'tp_final', 'tp1_tpFinal'],
        ['wait_limit', 'tp1', 'sl1', 'tp1_trailing'],
        ['wait_limit', 'tp1', 'breakeven', 'tp1_breakeven'],
        ['enter_close', 'sl1', 'tp_final', 'sl1_tpFinal'],
        ['wait_limit', 'sl1', 'sl2', 'sl1_sl2'],
        ['enter_selloff', 'selloff_ma5', 'selloff_ma5', 'selloff_recovered'],
        ['enter_selloff', 'selloff_time', 'selloff_time', 'selloff_recovered'],
        ['enter_selloff', 'selloff_stop', 'selloff_stop', 'selloff_stopped'],
        ['enter_selloff', 'open', 'open', 'other'],
        ['enter_selloff', 'max_hold', 'max_hold', 'other'],
        ['wait_limit', 'tp1', 'max_hold', 'other'],
        ['wait_limit', 'open', 'open', 'other'],
    ] as const)('%s %s+%s → %s', (entryType, a, b, expected) => {
        expect(exitPathOf(trade(entryType, a, b))).toBe(expected);
    });
});
