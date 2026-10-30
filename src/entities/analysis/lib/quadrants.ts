import type {
    QuadrantKey,
    Signal,
    SignalDirection,
    SignalPhase,
    StockSignalResult,
    StockWithConflict,
} from '@y0ngha/siglens-core';

/** 4분면 모두 빈 배열인 초기 분류. 종목을 누적 분류하는 reduce의 시작값이다. */
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

/**
 * 종목의 시그널을 방향·단계별 분면으로 나눠 `acc`에 누적한다. 한 종목이 여러 분면에
 * 걸치면 분면마다 해당 시그널만 담은 사본이 들어간다.
 */
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

/**
 * strict 모드 필터. 예상(expected) 시그널은 추세가 이미 그 방향이면 숨기고(상승 시그널은
 * 상승 추세에서, 하락 시그널은 하락 추세에서) 추세가 반대·중립일 때만 노출한다. 확정
 * 시그널은 그대로 두고, 시그널이 남지 않은 종목은 뺀다.
 */
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
