import { describe, expect, it } from 'vitest';
import { localePrefixOf } from '../localePrefix';

describe('localePrefixOf', () => {
    it('기본 로케일은 빈 문자열이다', () => {
        expect(localePrefixOf('ko')).toBe('');
    });

    it('그 외 로케일은 끝 슬래시 없는 접두다', () => {
        expect(localePrefixOf('en')).toBe('/en');
    });
});
