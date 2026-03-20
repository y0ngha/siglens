import { calculateRSI } from '@/domain/indicators/rsi';

describe('calculateRSI', () => {
  describe('closes.length < period', () => {
    it('모두 null 반환', () => {
      const result = calculateRSI([100, 101, 102], 14);
      expect(result).toEqual([null, null, null]);
    });

    it('빈 배열이면 빈 배열 반환', () => {
      expect(calculateRSI([], 14)).toEqual([]);
    });
  });

  describe('정상 입력 (closes.length >= period)', () => {
    it('입력과 동일한 길이의 배열 반환', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const result = calculateRSI(closes, 14);
      expect(result).toHaveLength(20);
    });

    it('반환값은 (number | null)[] 타입', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const result = calculateRSI(closes, 14);
      result.forEach((v) => {
        expect(v === null || typeof v === 'number').toBe(true);
      });
    });
  });
});
