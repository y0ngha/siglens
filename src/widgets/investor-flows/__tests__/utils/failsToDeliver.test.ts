import { describe, expect, it } from 'vitest';
import { ftdPctDigits } from '../../utils/failsToDeliver';

describe('ftdPctDigits', () => {
    it('발행주식 대비 %가 0.01 미만이고 0이 아니면 네 자리, 그 밖에는 두 자리다', () => {
        expect(ftdPctDigits(0.0006)).toBe(4);
        expect(ftdPctDigits(-0.0006)).toBe(4);
        expect(ftdPctDigits(0)).toBe(2);
        expect(ftdPctDigits(0.01)).toBe(2);
        expect(ftdPctDigits(0.5)).toBe(2);
    });
});
