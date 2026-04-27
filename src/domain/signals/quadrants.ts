import type { QuadrantKey, Signal, SignalDirection, SignalPhase, StockSignalResult, StockWithConflict } from '@y0ngha/siglens-core';

export const EMPTY_QUADRANTS: Record<
    QuadrantKey,
    readonly StockWithConflict[]
> = {
    bullishConfirmed: [],
    bullishExpected: [],
    bearishExpected: [],
    bearishConfirmed: [],
};

const SIGNAL_TO_QUADRANT: Record<
    SignalDirection,
    Record<SignalPhase, QuadrantKey>
> = {
    bullish: {
        confirmed: 'bullishConfirmed',
        expected: 'bullishExpected',
    },
    bearish: {
        confirmed: 'bearishConfirmed',
        expected: 'bearishExpected',
    },
};

const EMPTY_SIGNAL_QUADRANTS: Record<QuadrantKey, readonly Signal[]> = {
    bullishConfirmed: [],
    bullishExpected: [],
    bearishExpected: [],
    bearishConfirmed: [],
};

const QUADRANT_KEYS: readonly QuadrantKey[] = [
    'bullishConfirmed',
    'bullishExpected',
    'bearishExpected',
    'bearishConfirmed',
];

function signalToQuadrantKey(s: Signal): QuadrantKey {
    return SIGNAL_TO_QUADRANT[s.direction][s.phase];
}

export function groupStockIntoQuadrants(
    acc: Record<QuadrantKey, readonly StockWithConflict[]>,
    stock: StockWithConflict
): Record<QuadrantKey, readonly StockWithConflict[]> {
    const grouped = stock.signals.reduce<
        Record<QuadrantKey, readonly Signal[]>
    >((g, s) => {
        const key = signalToQuadrantKey(s);
        return { ...g, [key]: [...g[key], s] };
    }, EMPTY_SIGNAL_QUADRANTS);
    return QUADRANT_KEYS.reduce(
        (next, key) =>
            grouped[key].length === 0
                ? next
                : {
                      ...next,
                      [key]: [
                          ...next[key],
                          { ...stock, signals: grouped[key] },
                      ],
                  },
        acc
    );
}

// Anticipation signals만 trend가 반대/중립일 때 노출한다 (strict 모드).
export function filterStrictAnticipation(
    stocks: readonly StockSignalResult[]
): readonly StockSignalResult[] {
    return stocks.flatMap(stock => {
        const filtered = stock.signals.filter(sig => {
            if (sig.phase === 'confirmed') return true;
            if (sig.direction === 'bullish') return stock.trend !== 'uptrend';
            return stock.trend !== 'downtrend';
        });
        return filtered.length === 0 ? [] : [{ ...stock, signals: filtered }];
    });
}
