import type { Bar } from '@/domain/types';

export function calculateOBV(bars: Bar[]): (number | null)[] {
    if (bars.length === 0) return [];

    return bars.reduce<number[]>((acc, bar, i) => {
        if (i === 0) return [bar.volume];
        const prev = acc[acc.length - 1];
        const prevClose = bars[i - 1].close;
        if (bar.close > prevClose) return [...acc, prev + bar.volume];
        if (bar.close < prevClose) return [...acc, prev - bar.volume];
        return [...acc, prev];
    }, []);
}
