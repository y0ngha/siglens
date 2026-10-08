import type { Bar } from '@y0ngha/siglens-core';
import { barsUpToDate } from '@/entities/email-report/lib/barsUpToDate';

function barAt(iso: string): Bar {
    return {
        time: Date.parse(iso) / 1000,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1,
    };
}

describe('barsUpToDate', () => {
    const bars = [
        barAt('2026-10-06T13:30:00Z'),
        barAt('2026-10-07T13:30:00Z'),
        barAt('2026-10-08T13:30:00Z'),
        barAt('2026-10-09T13:30:00Z'),
    ];

    it('기준일 이후의 봉을 잘라 내고 남은 개수를 돌려준다', () => {
        const result = barsUpToDate(bars, '2026-10-07');

        expect(result.count).toBe(2);
        expect(result.bars).toEqual(bars.slice(0, 2));
    });

    it('기준일 당일 봉은 포함한다', () => {
        expect(barsUpToDate(bars, '2026-10-08').count).toBe(3);
    });

    it('모든 봉이 기준일 이전이면 전부 남긴다', () => {
        expect(barsUpToDate(bars, '2026-12-31').count).toBe(4);
    });

    it('모든 봉이 기준일 이후면 비운다', () => {
        expect(barsUpToDate(bars, '2026-01-01')).toEqual({
            bars: [],
            count: 0,
        });
    });
});
