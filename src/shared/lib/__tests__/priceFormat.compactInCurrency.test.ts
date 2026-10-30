import { describe, it, expect } from 'vitest';
import { formatCompactInCurrency } from '@/shared/lib/priceFormat';

describe('formatCompactInCurrency', () => {
    it('USD·KRW는 기존 축약 포매터와 같은 표기를 쓴다', () => {
        expect(formatCompactInCurrency(5_000_000_000, 'USD', 'en')).toBe('$5B');
        expect(formatCompactInCurrency(333_605_938_000_000, 'KRW', 'ko')).toBe(
            '₩333.6조'
        );
    });

    it('그 밖의 통화는 통화 코드를 붙여 달러 계열끼리 구분한다', () => {
        const twd = formatCompactInCurrency(1_200_000_000_000, 'TWD', 'en');
        expect(twd).toContain('TWD');
        expect(twd).toContain('1.2T');
        expect(formatCompactInCurrency(5_000_000_000, 'CAD', 'en')).toContain(
            'CAD'
        );
    });

    it('소문자·공백이 섞인 코드도 정규화한다', () => {
        expect(formatCompactInCurrency(1_000_000, ' twd ', 'en')).toContain(
            'TWD'
        );
    });

    it('로케일 단위 체계를 따른다', () => {
        expect(
            formatCompactInCurrency(1_200_000_000_000, 'TWD', 'ko')
        ).toContain('조');
    });

    it('음수 부호를 유지한다', () => {
        expect(formatCompactInCurrency(-5_000_000, 'JPY', 'en')).toContain('-');
    });

    it('형식이 잘못된 코드는 던지지 않고 null을 돌려준다', () => {
        expect(formatCompactInCurrency(1_000, 'NOT-A-CODE', 'en')).toBeNull();
        expect(formatCompactInCurrency(1_000, '12', 'en')).toBeNull();
    });
});
