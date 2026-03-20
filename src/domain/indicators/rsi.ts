import { RSI_DEFAULT_PERIOD } from '@/domain/indicators/constants';

export function calculateRSI(closes: number[], period = RSI_DEFAULT_PERIOD): (number | null)[] {
  if (closes.length === 0) return [];
  if (closes.length <= period) return closes.map(() => null);

  const diffs = closes.slice(1).map((close, i) => close - closes[i]);

  const gains = diffs.map((d) => (d > 0 ? d : 0));
  const losses = diffs.map((d) => (d < 0 ? -d : 0));

  const initialAvgGain =
    gains.slice(0, period).reduce((sum, g) => sum + g, 0) / period;
  const initialAvgLoss =
    losses.slice(0, period).reduce((sum, l) => sum + l, 0) / period;

  const toRSI = (avgGain: number, avgLoss: number): number =>
    avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  type WilderState = { avgGain: number; avgLoss: number };

  const allStates = diffs.slice(period).reduce<WilderState[]>(
    (acc, diff) => {
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      const prev = acc[acc.length - 1];
      return [
        ...acc,
        {
          avgGain: (prev.avgGain * (period - 1) + gain) / period,
          avgLoss: (prev.avgLoss * (period - 1) + loss) / period,
        },
      ];
    },
    [{ avgGain: initialAvgGain, avgLoss: initialAvgLoss }],
  );

  const rsiValues = allStates.map(({ avgGain, avgLoss }) =>
    toRSI(avgGain, avgLoss),
  );

  return [...new Array(period).fill(null), ...rsiValues];
}
