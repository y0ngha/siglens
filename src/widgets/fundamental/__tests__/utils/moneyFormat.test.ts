import {
    formatBigMoney,
    formatFixed,
    formatMoney,
    sharePercent,
} from '@/widgets/fundamental/utils/moneyFormat';

describe('moneyFormat', () => {
    it('sharePercent는 소수 첫째 자리까지 퍼센트를 만든다', () => {
        expect(sharePercent(1, 3)).toBe('33.3');
        expect(sharePercent(5, 5)).toBe('100.0');
    });

    it('formatMoney는 null이면 -이다', () => {
        expect(formatMoney(null, 'AAPL', 'en')).toBe('-');
        expect(formatBigMoney(null, 'AAPL', 'en')).toBe('-');
    });

    it('formatMoney·formatBigMoney는 종목 통화를 따른다', () => {
        expect(formatMoney(6.5, 'AAPL', 'en')).toBe('$6.50');
        expect(formatBigMoney(400_000_000_000, 'AAPL', 'en')).toBe('$400B');
        expect(formatMoney(450_000, '005930.KS', 'ko')).toContain('₩');
    });

    it('formatFixed는 자릿수를 고정하고 값이 없으면 -이다', () => {
        expect(formatFixed(0.3)).toBe('0.30');
        expect(formatFixed(7, 0)).toBe('7');
        expect(formatFixed(null)).toBe('-');
        expect(formatFixed(undefined)).toBe('-');
    });

    it('formatFixed는 0을 값으로 취급한다', () => {
        expect(formatFixed(0)).toBe('0.00');
    });
});
