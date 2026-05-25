import type { Bar, Trendline } from '@y0ngha/siglens-core';
import {
    trendlineKey,
    resolveTrendlinePrice,
} from '@/widgets/chart/utils/trendlineUtils';

describe('trendlineKey', () => {
    it('returns a string combining direction and start/end times', () => {
        const trendline: Trendline = {
            direction: 'ascending',
            start: { time: 1000, price: 100 },
            end: { time: 2000, price: 150 },
        };

        expect(trendlineKey(trendline)).toBe('ascending:1000:2000');
    });

    it('produces different keys for different directions', () => {
        const ascending: Trendline = {
            direction: 'ascending',
            start: { time: 1000, price: 100 },
            end: { time: 2000, price: 150 },
        };
        const descending: Trendline = {
            direction: 'descending',
            start: { time: 1000, price: 100 },
            end: { time: 2000, price: 150 },
        };

        expect(trendlineKey(ascending)).not.toBe(trendlineKey(descending));
    });

    it('produces different keys for different time ranges', () => {
        const t1: Trendline = {
            direction: 'ascending',
            start: { time: 1000, price: 100 },
            end: { time: 2000, price: 150 },
        };
        const t2: Trendline = {
            direction: 'ascending',
            start: { time: 1000, price: 100 },
            end: { time: 3000, price: 150 },
        };

        expect(trendlineKey(t1)).not.toBe(trendlineKey(t2));
    });
});

describe('resolveTrendlinePrice', () => {
    const mockBar: Bar = {
        time: 100,
        open: 50,
        high: 60,
        low: 40,
        close: 55,
        volume: 1000,
    };

    it('returns bar.low for ascending direction', () => {
        expect(resolveTrendlinePrice(mockBar, 'ascending', 999)).toBe(
            mockBar.low
        );
    });

    it('returns bar.high for descending direction', () => {
        expect(resolveTrendlinePrice(mockBar, 'descending', 999)).toBe(
            mockBar.high
        );
    });

    it('returns fallback when bar is undefined', () => {
        expect(resolveTrendlinePrice(undefined, 'ascending', 42)).toBe(42);
    });

    it('returns fallback for descending when bar is undefined', () => {
        expect(resolveTrendlinePrice(undefined, 'descending', 77)).toBe(77);
    });
});
