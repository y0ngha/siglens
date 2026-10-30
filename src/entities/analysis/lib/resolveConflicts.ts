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

/**
 * 종목별로 상반된 시그널을 정리한다. 한 방향뿐이면 그대로 `resolved`, 양 방향 개수가
 * 같으면 `mixed`(충돌 정보 포함), 다르면 다수 방향 시그널만 남겨 `resolved`에 충돌
 * 정보와 함께 담는다.
 */
export function resolveConflicts(
    stocks: readonly StockSignalResult[]
): ConflictResolution {
    return stocks.reduce(
        (acc, stock) => {
            const { bullishCount, bearishCount } = countSignalDirections(
                stock.signals
            );

            if (bullishCount === 0 || bearishCount === 0) {
                return { ...acc, resolved: [...acc.resolved, stock] };
            }

            const conflict: ConflictInfo = { bullishCount, bearishCount };

            if (bullishCount === bearishCount) {
                return {
                    ...acc,
                    mixed: [...acc.mixed, { ...stock, conflict }],
                };
            }

            const winningDirection: SignalDirection =
                bullishCount > bearishCount ? 'bullish' : 'bearish';
            return {
                ...acc,
                resolved: [
                    ...acc.resolved,
                    {
                        ...stock,
                        signals: stock.signals.filter(
                            s => s.direction === winningDirection
                        ),
                        conflict,
                    },
                ],
            };
        },
        { resolved: [], mixed: [] } as ConflictResolution
    );
}
