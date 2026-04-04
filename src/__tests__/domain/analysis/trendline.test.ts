import { extendTrendline } from '@/domain/analysis/trendline';
import type { Trendline } from '@/domain/types';

describe('trendline', () => {
    describe('extendTrendline', () => {
        describe('start.time === end.time (zero time delta)일 때', () => {
            it('end.price를 그대로 반환한다', () => {
                const trendline: Trendline = {
                    direction: 'ascending',
                    start: { time: 1000, price: 100 },
                    end: { time: 1000, price: 150 },
                };

                const result = extendTrendline(trendline, 2000);

                expect(result).toEqual({ time: 2000, price: 150 });
            });
        });

        describe('targetTime === end.time일 때', () => {
            it('정확한 end point를 반환한다', () => {
                const trendline: Trendline = {
                    direction: 'ascending',
                    start: { time: 1000, price: 100 },
                    end: { time: 2000, price: 110 },
                };

                const result = extendTrendline(trendline, 2000);

                expect(result).toEqual({ time: 2000, price: 110 });
            });
        });

        describe('상승 추세선 외삽일 때', () => {
            it('targetTime이 end보다 클 때 price가 증가한다', () => {
                const trendline: Trendline = {
                    direction: 'ascending',
                    start: { time: 1000, price: 100 },
                    end: { time: 2000, price: 110 },
                };

                const result = extendTrendline(trendline, 3000);

                expect(result.time).toBe(3000);
                expect(result.price).toBeCloseTo(120);
            });
        });

        describe('하락 추세선 외삽일 때', () => {
            it('targetTime이 end보다 클 때 price가 감소한다', () => {
                const trendline: Trendline = {
                    direction: 'descending',
                    start: { time: 1000, price: 200 },
                    end: { time: 2000, price: 190 },
                };

                const result = extendTrendline(trendline, 3000);

                expect(result.time).toBe(3000);
                expect(result.price).toBeCloseTo(180);
            });
        });

        describe('역방향 외삽 (targetTime < start.time)일 때', () => {
            it('선형 외삽이 정상 동작한다', () => {
                const trendline: Trendline = {
                    direction: 'ascending',
                    start: { time: 1000, price: 100 },
                    end: { time: 2000, price: 110 },
                };

                const result = extendTrendline(trendline, 500);

                expect(result.time).toBe(500);
                expect(result.price).toBeCloseTo(95);
            });
        });
    });
});
