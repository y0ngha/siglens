import { describe, expect, it } from 'vitest';
import { draftFrom } from '../homeDraft';

describe('draftFrom', () => {
    it('q를 다듬어 돌려준다', () => {
        expect(draftFrom({ q: '  NVDA 어때?  ' })).toBe('NVDA 어때?');
    });

    it('공백뿐이거나 없으면 undefined다', () => {
        expect(draftFrom({ q: '   ' })).toBeUndefined();
        expect(draftFrom({})).toBeUndefined();
    });

    it('배열 값은 무시한다', () => {
        expect(draftFrom({ q: ['a', 'b'] })).toBeUndefined();
    });

    it('500자로 자른다', () => {
        expect(draftFrom({ q: 'a'.repeat(600) })).toHaveLength(500);
    });
});
