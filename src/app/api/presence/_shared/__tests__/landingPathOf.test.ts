import { describe, it, expect } from 'vitest';
import {
    landingPathOf,
    landingSiteOf,
} from '@/app/api/presence/_shared/landingPathOf';

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

describe('landingSiteOf', () => {
    it('siglens.io 페이지는 main이다', () => {
        expect(landingSiteOf('https://siglens.io/ko/AAPL?tab=chart')).toBe(
            'main'
        );
    });

    it('ai.siglens.io 페이지는 ai다', () => {
        expect(landingSiteOf('https://ai.siglens.io/c/abc')).toBe('ai');
    });

    it('로컬 ai 호스트(포트 포함)도 ai다', () => {
        expect(landingSiteOf('http://ai.localhost:3000/')).toBe('ai');
    });

    it('헤더가 없거나 URL이 아니면 null이다', () => {
        expect(landingSiteOf(null)).toBeNull();
        expect(landingSiteOf('not a url')).toBeNull();
    });

    it('원본 호스트가 아니라 닫힌 두 값만 돌려준다', () => {
        expect(landingSiteOf('https://example.org/x')).toBe('main');
    });
});
