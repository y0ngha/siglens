// @vitest-environment jsdom
import { isElementClamped } from '../../utils/clamp';

describe('isElementClamped', () => {
    function fakeEl(scrollHeight: number, clientHeight: number): HTMLElement {
        return { scrollHeight, clientHeight } as HTMLElement;
    }

    it('returns true when content overflows the clamped box', () => {
        expect(isElementClamped(fakeEl(80, 40))).toBe(true);
    });

    it('returns false when content fits within the box', () => {
        expect(isElementClamped(fakeEl(40, 40))).toBe(false);
    });

    it('tolerates 1px sub-pixel rounding (not clamped)', () => {
        expect(isElementClamped(fakeEl(41, 40))).toBe(false);
    });

    it('returns false for null element', () => {
        expect(isElementClamped(null)).toBe(false);
    });
});
