import { describe, it, expect } from 'vitest';
import { formatInCurrency } from '@/shared/lib/priceFormat';

describe('formatInCurrency', () => {
    it('원화는 소수 없이 천 단위 구분자를 쓴다', () => {
        expect(formatInCurrency(4950, 'KRW', 'ko')).toBe('₩4,950');
    });

    it('달러는 소수 둘째 자리까지 표기한다', () => {
        expect(formatInCurrency(1234.5, 'USD', 'en')).toBe('$1,234.50');
    });

    it('그 밖의 통화는 통화 코드를 붙이고 소수 둘째 자리까지 표기한다', () => {
        const twd = formatInCurrency(66.1, 'twd', 'en');
        expect(twd).toContain('TWD');
        expect(twd).toContain('66.10');
    });

    it('형식이 잘못된 코드는 null을 돌려준다', () => {
        expect(formatInCurrency(1, 'not-a-code', 'en')).toBeNull();
    });
});
