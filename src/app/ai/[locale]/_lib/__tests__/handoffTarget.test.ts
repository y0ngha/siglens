import { describe, expect, it } from 'vitest';
import { buildHandoffNext } from '../handoffTarget';

describe('buildHandoffNext', () => {
    it('ko 홈은 접두사가 없다', () => {
        expect(buildHandoffNext('ko', '/', {})).toBe('/');
    });

    it('en 대화 경로는 로케일 접두를 싣는다', () => {
        expect(buildHandoffNext('en', '/c/abc', {})).toBe('/en/c/abc');
    });

    it('허용 목록 파라미터만 살리고 값은 인코딩하며 나머지는 버린다', () => {
        expect(
            buildHandoffNext('ko', '/', {
                gclid: 'G1',
                q: 'a b',
                utm_source: 'google',
                foo: 'x',
            })
        ).toBe('/?q=a%20b&gclid=G1&utm_source=google');
    });

    it('빈 값과 배열 값은 버린다', () => {
        expect(buildHandoffNext('ko', '/', { q: '', gclid: ['a', 'b'] })).toBe(
            '/'
        );
    });
});
