import type {
    ConflictInfo,
    ConflictResolution,
    Signal,
    SignalDirection,
    StockSignalResult,
    StockWithConflict,
} from '@y0ngha/siglens-core';

function countSignalDirections(signals: readonly Signal[]): ConflictInfo {
    return signals.reduce(
        (counts, s) => ({
            bullishCount:
                counts.bullishCount + (s.direction === 'bullish' ? 1 : 0),
            bearishCount:
                counts.bearishCount + (s.direction === 'bearish' ? 1 : 0),
        }),
        { bullishCount: 0, bearishCount: 0 }
    );
}

export function resolveConflicts(
    stocks: readonly StockSignalResult[]
): ConflictResolution {
    const resolved: StockWithConflict[] = [];
    const mixed: StockWithConflict[] = [];

    for (const stock of stocks) {
        const { bullishCount, bearishCount } = countSignalDirections(
            stock.signals
        );

        if (bullishCount === 0 || bearishCount === 0) {
            resolved.push(stock);
            continue;
        }

        const conflict: ConflictInfo = { bullishCount, bearishCount };

        if (bullishCount === bearishCount) {
            mixed.push({ ...stock, conflict });
            continue;
        }

        const winningDirection: SignalDirection =
            bullishCount > bearishCount ? 'bullish' : 'bearish';
        resolved.push({
            ...stock,
            signals: stock.signals.filter(
                s => s.direction === winningDirection
            ),
            conflict,
        });
    }

    return { resolved, mixed };
}
