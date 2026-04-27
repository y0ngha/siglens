import type {
    ConflictInfo,
    ConflictResolution,
    Signal,
    SignalDirection,
    StockSignalResult,
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
    // Mutable accumulator avoids O(N²) spread; cast is safe — mutable array satisfies readonly
    return stocks.reduce(
        (acc, stock) => {
            const { bullishCount, bearishCount } = countSignalDirections(
                stock.signals
            );

            if (bullishCount === 0 || bearishCount === 0) {
                acc.resolved.push(stock);
                return acc;
            }

            const conflict: ConflictInfo = { bullishCount, bearishCount };

            if (bullishCount === bearishCount) {
                acc.mixed.push({ ...stock, conflict });
                return acc;
            }

            const winningDirection: SignalDirection =
                bullishCount > bearishCount ? 'bullish' : 'bearish';
            acc.resolved.push({
                ...stock,
                signals: stock.signals.filter(
                    s => s.direction === winningDirection
                ),
                conflict,
            });
            return acc;
        },
        {
            resolved: [] as ConflictResolution['resolved'][number][],
            mixed: [] as ConflictResolution['mixed'][number][],
        }
    ) as ConflictResolution;
}
