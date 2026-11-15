import { describe, expect, it } from 'vitest';
import { sliceUtf16 } from '../sliceUtf16';

describe('sliceUtf16', () => {
    it('상한 이하면 그대로, 넘으면 자르고 cut', () => {
        expect(sliceUtf16('abc', 3)).toEqual({ text: 'abc', cut: false });
        expect(sliceUtf16('abcd', 3)).toEqual({ text: 'abc', cut: true });
    });

    it('서로게이트 쌍을 쪼개지 않는다', () => {
        expect(sliceUtf16('ab😀', 3)).toEqual({ text: 'ab', cut: true });
        expect(sliceUtf16('ab😀c', 4)).toEqual({ text: 'ab😀', cut: true });
    });

    it('상한이 0 이하면 빈 문자열', () => {
        expect(sliceUtf16('abc', 0)).toEqual({ text: '', cut: true });
    });
});
