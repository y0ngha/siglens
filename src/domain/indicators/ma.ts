import type { Bar } from '@/domain/types';

export function calculateMA(bars: Bar[], period: number): (number | null)[] {
    if (bars.length === 0 || period <= 0) return [];

    const closes = bars.map(bar => bar.close);

    if (closes.length < period) {
        return closes.map(() => null);
    }

    const nulls: (number | null)[] = new Array(period - 1).fill(null);

    const smas: (number | null)[] = closes
        .slice(period - 1)
        .map(
            (_, i) =>
                closes
                    .slice(i, i + period)
                    .reduce((sum, close) => sum + close, 0) / period
        );

    return [...nulls, ...smas];
}
