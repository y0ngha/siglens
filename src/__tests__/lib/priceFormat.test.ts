import {
    formatUsdPrice,
    formatUsdCurrency,
    formatPriceChange,
} from '@/lib/priceFormat';

describe('formatUsdPrice', () => {
    it('정수를 쉼표 포맷으로 반환한다', () => {
        expect(formatUsdPrice(1234)).toBe('1,234');
    });

    it('소수점 2자리까지 표시한다', () => {
        expect(formatUsdPrice(12.5)).toBe('12.5');
    });

    it('소수점 3자리 이상은 최대 2자리로 반올림한다', () => {
        expect(formatUsdPrice(1.234)).toBe('1.23');
    });

    it('0을 처리한다', () => {
        expect(formatUsdPrice(0)).toBe('0');
    });
});

describe('formatUsdCurrency', () => {
    it('달러 기호와 소수점 2자리 고정으로 포맷한다', () => {
        expect(formatUsdCurrency(123.45)).toBe('$123.45');
    });

    it('소수점 없는 정수에도 .00을 붙인다', () => {
        expect(formatUsdCurrency(100)).toBe('$100.00');
    });

    it('1000 이상에 쉼표를 추가한다', () => {
        expect(formatUsdCurrency(1234.56)).toBe('$1,234.56');
    });

    it('0을 처리한다', () => {
        expect(formatUsdCurrency(0)).toBe('$0.00');
    });
});

describe('formatPriceChange', () => {
    describe('양수(상승)', () => {
        it('isUp이 true이고 + 부호를 반환한다', () => {
            const result = formatPriceChange(1.5);
            expect(result.isUp).toBe(true);
            expect(result.sign).toBe('+');
            expect(result.arrow).toBe('▲');
            expect(result.arrowLabel).toBe('상승');
        });
    });

    describe('0(보합)', () => {
        it('isUp이 true로 처리된다', () => {
            const result = formatPriceChange(0);
            expect(result.isUp).toBe(true);
            expect(result.sign).toBe('+');
        });
    });

    describe('음수(하락)', () => {
        it('isUp이 false이고 부호가 없다', () => {
            const result = formatPriceChange(-2.3);
            expect(result.isUp).toBe(false);
            expect(result.sign).toBe('');
            expect(result.arrow).toBe('▼');
            expect(result.arrowLabel).toBe('하락');
        });
    });
});
