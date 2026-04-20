import type {
    Signal,
    SignalDirection,
    StockSignalResult,
    ConflictInfo,
    StockWithConflict,
    ConflictResolution,
} from '@/domain/types';

function countSignalDirections(signals: readonly Signal[]): { bullishCount: number; bearishCount: number } {
    return signals.reduce(
        (counts, s) => ({
            bullishCount: counts.bullishCount + (s.direction === 'bullish' ? 1 : 0),
            bearishCount: counts.bearishCount + (s.direction === 'bearish' ? 1 : 0),
        }),
        { bullishCount: 0, bearishCount: 0 }
    );
}

export function resolveConflicts(stocks: readonly StockSignalResult[]): ConflictResolution {
    return stocks.reduce<{ resolved: StockWithConflict[]; mixed: StockWithConflict[] }>(
        (acc, stock) => {
            const { bullishCount, bearishCount } = countSignalDirections(stock.signals);

            if (bullishCount === 0 || bearishCount === 0) {
                return { ...acc, resolved: [...acc.resolved, stock] };
            }

            const conflict: ConflictInfo = { bullishCount, bearishCount };

            if (bullishCount === bearishCount) {
                return { ...acc, mixed: [...acc.mixed, { ...stock, conflict }] };
            }

            const winningDirection: SignalDirection =
                bullishCount > bearishCount ? 'bullish' : 'bearish';
            const filteredSignals = stock.signals.filter(
                s => s.direction === winningDirection
            );
            return {
                ...acc,
                resolved: [
                    ...acc.resolved,
                    { ...stock, signals: filteredSignals, conflict },
                ],
            };
        },
        { resolved: [], mixed: [] }
    );
}
