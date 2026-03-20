import { calculateRSI } from '@/domain/indicators/rsi';

describe('calculateRSI', () => {
  describe('입력 배열이 비어있을 때', () => {
    it('빈 배열을 반환한다', () => {
      expect(calculateRSI([], 14)).toEqual([]);
    });
  });

  describe('입력 배열 길이가 period 미만일 때', () => {
    it('전부 null인 배열을 반환한다', () => {
      const result = calculateRSI([100, 101, 102], 14);
      expect(result).toEqual([null, null, null]);
    });
  });

  describe('입력 배열 길이가 period 이상일 때', () => {
    it('입력과 동일한 길이의 배열을 반환한다', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const result = calculateRSI(closes, 14);
      expect(result).toHaveLength(20);
    });

    it('처음 period개의 값은 null이다', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const result = calculateRSI(closes, 14);
      expect(result.slice(0, 14).every((v) => v === null)).toBe(true);
    });

    it('반환값은 (number | null)[] 타입이다', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const result = calculateRSI(closes, 14);
      result.forEach((v) => {
        expect(v === null || typeof v === 'number').toBe(true);
      });
    });
  });
});
