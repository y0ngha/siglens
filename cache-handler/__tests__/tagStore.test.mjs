import { describe, it, expect, beforeEach } from 'vitest';
import {
    markRevalidated,
    maxRevalidatedAt,
    _resetForTest,
} from '../tagStore.mjs';

describe('tagStore', () => {
    beforeEach(() => _resetForTest());

    it('미등록 태그는 0을 반환한다(fresh)', () => {
        expect(maxRevalidatedAt(['symbol:AAPL'])).toBe(0);
    });

    it('revalidate된 태그의 타임스탬프를 반환한다(read-your-writes)', () => {
        markRevalidated('news:AAPL', 1000);
        expect(maxRevalidatedAt(['news:AAPL'])).toBe(1000);
    });

    it('여러 태그 중 최댓값을 반환한다', () => {
        markRevalidated('a', 1000);
        markRevalidated('b', 2000);
        expect(maxRevalidatedAt(['a', 'b', 'c'])).toBe(2000);
    });
});
