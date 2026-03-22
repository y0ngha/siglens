import type { Bar } from '@/domain/types';

export function computeEMAValues(
    values: number[],
    period: number
): (number | null)[] {
    if (values.length === 0 || period <= 0) return [];
    if (values.length < period) return values.map(() => null);

    const initialSMA =
        values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

    const multiplier = 2 / (period + 1);

    const seed: (number | null)[] = [
        ...new Array(period - 1).fill(null),
        initialSMA,
    ];

    return values.slice(period).reduce((acc: (number | null)[], v: number) => {
        const prevEMA = acc[acc.length - 1] as number;
        return [...acc, v * multiplier + prevEMA * (1 - multiplier)];
    }, seed);
}

export function calculateEMA(bars: Bar[], period: number): (number | null)[] {
    if (bars.length === 0 || period <= 0) return [];
    return computeEMAValues(
        bars.map(bar => bar.close),
        period
    );
}
