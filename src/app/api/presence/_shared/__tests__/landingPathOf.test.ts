import { describe, it, expect } from 'vitest';
import { landingPathOf } from '@/app/api/presence/_shared/landingPathOf';

describe('landingPathOf', () => {
    it('헤더가 없으면 null이다', () => {
        expect(landingPathOf(null)).toBeNull();
    });

    it('URL로 해석되지 않는 값은 null이다', () => {
        expect(landingPathOf('not a url')).toBeNull();
    });

    it('경로만 남기고 쿼리스트링과 해시를 버린다', () => {
        expect(
            landingPathOf('https://siglens.io/AAPL?ref=abc&q=secret#top')
        ).toBe('/AAPL');
    });

    it('루트 경로는 /로 돌려준다', () => {
        expect(landingPathOf('https://siglens.io')).toBe('/');
    });
});
