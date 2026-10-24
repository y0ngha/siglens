import { describe, expect, it } from 'vitest';

import { escapeLikePattern } from '@/shared/db/likePattern';

describe('escapeLikePattern', () => {
    describe('와일드카드 문자', () => {
        it.each([
            ['_', '\\_'],
            ['%', '\\%'],
            ['50%_off', '50\\%\\_off'],
        ])('%s 를 %s 로 이스케이프한다', (input, expected) => {
            expect(escapeLikePattern(input)).toBe(expected);
        });
    });

    describe('이스케이프 문자', () => {
        it('백슬래시 자신도 이스케이프한다', () => {
            expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
        });
    });

    describe('일반 문자', () => {
        it('와일드카드가 없으면 그대로 돌려준다', () => {
            expect(escapeLikePattern('비트코인 btc')).toBe('비트코인 btc');
        });
    });
});
