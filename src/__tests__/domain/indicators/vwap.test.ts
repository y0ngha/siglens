import { calculateVWAP } from '@/domain/indicators/vwap';

describe('calculateVWAP', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            expect(calculateVWAP([], [], [], [])).toEqual([]);
        });
    });

    describe('정상 입력일 때', () => {
        it('입력과 동일한 길이의 배열을 반환한다', () => {
            const highs = [105, 106, 107];
            const lows = [95, 96, 97];
            const closes = [100, 101, 102];
            const volumes = [1000, 2000, 3000];
            const result = calculateVWAP(highs, lows, closes, volumes);
            expect(result).toHaveLength(3);
        });

        it('반환값은 (number | null)[] 타입이다', () => {
            const result = calculateVWAP([105], [95], [100], [1000]);
            result.forEach(v => {
                expect(v === null || typeof v === 'number').toBe(true);
            });
        });
    });
});
