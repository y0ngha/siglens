import { quoteFromBars } from '@/features/watchlist/lib/quoteFromBars';
import type { Bar } from '@y0ngha/siglens-core';

const bar = (close: number): Bar => ({
    time: 1,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
});

describe('quoteFromBars', () => {
    it('봉이 2개 미만이면 null', () => {
        expect(quoteFromBars([])).toBeNull();
        expect(quoteFromBars([bar(100)])).toBeNull();
    });

    it('마지막 종가와 직전 종가 대비 등락률(%)을 돌려준다', () => {
        expect(quoteFromBars([bar(90), bar(100), bar(110)])).toEqual({
            price: 110,
            changePct: 10,
        });
    });

    it('직전 종가가 0이면 등락률은 null', () => {
        expect(quoteFromBars([bar(0), bar(5)])).toEqual({
            price: 5,
            changePct: null,
        });
    });
});
