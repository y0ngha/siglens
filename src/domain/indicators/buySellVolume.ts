import type { Bar, BuySellVolumeResult } from '@/domain/types';

export function calculateBuySellVolume(bars: Bar[]): BuySellVolumeResult[] {
    return bars.map(bar => {
        const range = bar.high - bar.low;
        if (range === 0) {
            return { buyVolume: 0, sellVolume: 0 };
        }
        const buyVolume = (bar.volume * (bar.close - bar.low)) / range;
        const sellVolume = (bar.volume * (bar.high - bar.close)) / range;
        return { buyVolume, sellVolume };
    });
}
