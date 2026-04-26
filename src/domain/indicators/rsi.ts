import { RSI_DEFAULT_PERIOD } from '@/domain/indicators/constants';

interface WilderState {
    avgGain: number;
    avgLoss: number;
}

export function calculateRSI(
    closes: number[],
    period = RSI_DEFAULT_PERIOD
): (number | null)[] {
    if (closes.length === 0) return [];
    if (closes.length <= period) return closes.map(() => null);

    const diffs = closes.slice(1).map((close, i) => close - closes[i]);

    const gains = diffs.map(d => (d > 0 ? d : 0));
    const losses = diffs.map(d => (d < 0 ? -d : 0));

    const initialAvgGain =
        gains.slice(0, period).reduce((sum, g) => sum + g, 0) / period;
    const initialAvgLoss =
        losses.slice(0, period).reduce((sum, l) => sum + l, 0) / period;

    const toRSI = (avgGain: number, avgLoss: number): number =>
        avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    const tailDiffs = diffs.slice(period);
    const rsiValues: number[] = new Array(tailDiffs.length + 1);
    rsiValues[0] = toRSI(initialAvgGain, initialAvgLoss);
    let wilderState: WilderState = {
        avgGain: initialAvgGain,
        avgLoss: initialAvgLoss,
    };
    for (let i = 0; i < tailDiffs.length; i++) {
        const diff = tailDiffs[i];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        wilderState = {
            avgGain: (wilderState.avgGain * (period - 1) + gain) / period,
            avgLoss: (wilderState.avgLoss * (period - 1) + loss) / period,
        };
        rsiValues[i + 1] = toRSI(wilderState.avgGain, wilderState.avgLoss);
    }

    return [...new Array(period).fill(null), ...rsiValues];
}
