import type { Bar } from '@/domain/types';

export function calculateEMA(bars: Bar[], period: number): (number | null)[] {
  if (bars.length === 0 || period <= 0) return [];

  const closes = bars.map((bar) => bar.close);

  if (closes.length < period) {
    return closes.map(() => null);
  }

  const initialSMA =
    closes.slice(0, period).reduce((sum, close) => sum + close, 0) / period;

  const multiplier = 2 / (period + 1);

  const result: (number | null)[] = new Array(period - 1).fill(null);

  result.push(initialSMA);

  return closes.slice(period).reduce((acc, close) => {
    const prevEMA = acc[acc.length - 1] as number;
    return [...acc, close * multiplier + prevEMA * (1 - multiplier)];
  }, result);
}
