import { describe, expect, it } from 'vitest';
import { barHeightPercent } from '../../utils/barChart';

describe('barHeightPercent', () => {
    it('0 이하의 값은 0이다', () => {
        expect(barHeightPercent(0, 100)).toBe(0);
        expect(barHeightPercent(-5, 100)).toBe(0);
    });

    it('최대값 대비 비율(정수 %)이다', () => {
        expect(barHeightPercent(100, 100)).toBe(100);
        expect(barHeightPercent(50, 100)).toBe(50);
    });

    it('아주 작은 양수도 보이도록 최소 3%를 보장한다', () => {
        expect(barHeightPercent(1, 1_000)).toBe(3);
    });
});
