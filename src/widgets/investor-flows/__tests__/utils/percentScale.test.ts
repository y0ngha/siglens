import { describe, expect, it } from 'vitest';
import { PERCENT_SCALE } from '../../utils/percentScale';

describe('PERCENT_SCALE', () => {
    it('0~1 비율에 곱하면 퍼센트가 되는 배율이다', () => {
        expect(PERCENT_SCALE).toBe(100);
        expect(0.25 * PERCENT_SCALE).toBe(25);
    });
});
