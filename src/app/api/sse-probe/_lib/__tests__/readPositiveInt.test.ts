import { describe, it, expect } from 'vitest';
import { readPositiveInt } from '@/app/api/sse-probe/_lib/readPositiveInt';

const params = (query: string): URLSearchParams => new URLSearchParams(query);

describe('readPositiveInt', () => {
    it('키가 없으면 fallback을 돌려준다', () => {
        expect(readPositiveInt(params(''), 'n', 7, 100)).toBe(7);
    });

    it('숫자 뒤에 문자가 붙은 값은 fallback이다', () => {
        expect(readPositiveInt(params('n=10abc'), 'n', 7, 100)).toBe(7);
    });

    it('소수와 음수 표기는 fallback이다', () => {
        expect(readPositiveInt(params('n=1.5'), 'n', 7, 100)).toBe(7);
        expect(readPositiveInt(params('n=-3'), 'n', 7, 100)).toBe(7);
    });

    it('0은 fallback이다', () => {
        expect(readPositiveInt(params('n=0'), 'n', 7, 100)).toBe(7);
    });

    it('안전 정수를 넘는 값은 fallback이다', () => {
        expect(
            readPositiveInt(params('n=99999999999999999999'), 'n', 7, 100)
        ).toBe(7);
    });

    it('max를 넘는 값은 max로 clamp한다', () => {
        expect(readPositiveInt(params('n=101'), 'n', 7, 100)).toBe(100);
    });

    it('유효한 값은 그대로 돌려준다', () => {
        expect(readPositiveInt(params('n=42'), 'n', 7, 100)).toBe(42);
    });
});
