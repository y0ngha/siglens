import { describe, expect, it } from 'vitest';
import { toPercent } from '@/widgets/financials/utils/growthFormat';

describe('toPercent', () => {
    it('분수를 퍼센트로 바꾼다', () => {
        expect(toPercent(0.5)).toBe(50);
        expect(toPercent(-0.2)).toBeCloseTo(-20);
    });

    it('null은 그대로 둔다', () => {
        expect(toPercent(null)).toBeNull();
    });
});
