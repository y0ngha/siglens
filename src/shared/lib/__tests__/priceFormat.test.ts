import { describe, it, expect } from 'vitest';
import {
    formatUsdPrice,
    formatUsdCurrency,
    formatPriceChange,
    formatPrice,
    dynamicDecimals,
} from '@/shared/lib/priceFormat';
import type { PricePrecision } from '@/shared/config/marketProfile';

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

const usd = { currency: 'USD' as const, locale: 'en-US' };
const fixed2: PricePrecision = { kind: 'fixed', digits: 2 };
const integer: PricePrecision = { kind: 'integer' };
const dyn: PricePrecision = { kind: 'dynamic-by-magnitude' };

describe('dynamicDecimals', () => {
    it('clamps values >= 1000 to 2dp', () => {
        expect(dynamicDecimals(64192)).toBe(2);
    });

    it('uses 2dp for values in [1, 1000)', () => {
        expect(dynamicDecimals(123.4)).toBe(2);
    });

    it('treats exact zero as 2dp', () => {
        expect(dynamicDecimals(0)).toBe(2);
    });

    it('expands precision for sub-1 values by leading zeros', () => {
        // 0.058158 → 1 leading zero + 4 = 5dp
        expect(dynamicDecimals(0.058158)).toBe(5);
    });

    it('caps precision at 12dp', () => {
        expect(dynamicDecimals(1e-20)).toBe(12);
    });

    it('returns 2dp for non-finite input (NaN/Infinity guard)', () => {
        expect(dynamicDecimals(NaN)).toBe(2);
        expect(dynamicDecimals(Infinity)).toBe(2);
        expect(dynamicDecimals(-Infinity)).toBe(2);
    });
});

describe('formatPrice', () => {
    it('fixed-2 renders equity prices to 2 decimals', () => {
        expect(formatPrice(123.456, { ...usd, precision: fixed2 })).toBe(
            '$123.46'
        );
    });

    it('integer precision renders whole-unit prices', () => {
        expect(formatPrice(1234.56, { ...usd, precision: integer })).toBe(
            '$1,235'
        );
    });

    it('non-finite value falls back to 2dp without throwing', () => {
        // dynamicDecimals NaN-guard prevents Intl RangeError; value renders as $NaN
        expect(() =>
            formatPrice(NaN, { ...usd, precision: dyn })
        ).not.toThrow();
    });

    it('dynamic keeps 2dp for large crypto prices', () => {
        expect(formatPrice(64192, { ...usd, precision: dyn })).toBe(
            '$64,192.00'
        );
    });

    it('dynamic preserves sub-cent precision', () => {
        // MIOTAUSD ~0.058158 must not collapse to 0.06
        expect(formatPrice(0.058158, { ...usd, precision: dyn })).toMatch(
            /0\.0581/
        );
        // SHIB-scale must not collapse to 0.00
        expect(formatPrice(0.00001234, { ...usd, precision: dyn })).toMatch(
            /0\.00001/
        );
    });
});
