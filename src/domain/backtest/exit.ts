import type { Bar, BacktestExitReason } from '@/domain/types';

export interface ExitSimulationInput {
    bars: Bar[];
    entryIdx: number;
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    maxHoldDays: number;
}

export interface ExitSimulationResult {
    exitIdx: number;
    exitPrice: number;
    exitReason: BacktestExitReason;
    holdingDays: number;
    returnPct: number;
}

function buildResult(
    exitIdx: number,
    exitPrice: number,
    exitReason: BacktestExitReason,
    entryIdx: number,
    entryPrice: number
): ExitSimulationResult {
    return {
        exitIdx,
        exitPrice,
        exitReason,
        holdingDays: exitIdx - entryIdx,
        returnPct: ((exitPrice - entryPrice) / entryPrice) * 100,
    };
}

export function simulateExit(input: ExitSimulationInput): ExitSimulationResult {
    const { bars, entryIdx, entryPrice, stopLoss, takeProfit, maxHoldDays } =
        input;
    const maxIdx = Math.min(entryIdx + maxHoldDays, bars.length - 1);

    for (let i = entryIdx + 1; i <= maxIdx; i++) {
        const b = bars[i];
        const hitSL = stopLoss !== undefined && b.low <= stopLoss;
        const hitTP = takeProfit !== undefined && b.high >= takeProfit;

        // 동일 bar 내 SL·TP 동시 발동 시 보수적으로 SL 우선 — intraday 순서 불명
        if (hitSL) {
            return buildResult(i, stopLoss!, 'stop_loss', entryIdx, entryPrice);
        }
        if (hitTP) {
            return buildResult(
                i,
                takeProfit!,
                'take_profit',
                entryIdx,
                entryPrice
            );
        }
    }

    const exitBar = bars[maxIdx];
    return buildResult(maxIdx, exitBar.close, 'time', entryIdx, entryPrice);
}
