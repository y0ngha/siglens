import { describe, it, expect } from 'vitest';
import {
    formatCurrencyCompact,
    statementCurrencyOf,
    DEFAULT_STATEMENT_CURRENCY,
} from '../numberFormat';

describe('formatCurrencyCompact', () => {
    it('formats USD in the en-US compact scale', () => {
        expect(formatCurrencyCompact(5_000_000_000)).toBe('$5B');
        expect(formatCurrencyCompact(340_000_000)).toBe('$340M');
    });

    it('formats KRW in the Korean compact scale, not the western one', () => {
        // 로케일을 통화에 묶지 않으면 333조가 `₩333T`로 나와 한국 사용자에게 읽히지 않는다.
        const formatted = formatCurrencyCompact(333_605_938_000_000, 'KRW');
        expect(formatted).toContain('조');
        expect(formatted).not.toContain('T');
    });

    it('renders KRW without decimal sub-units', () => {
        expect(formatCurrencyCompact(274_500, 'KRW')).not.toContain('.00');
    });

    it('defaults to USD when no currency is given', () => {
        expect(DEFAULT_STATEMENT_CURRENCY).toBe('USD');
        expect(formatCurrencyCompact(1_000)).toBe(
            formatCurrencyCompact(1_000, 'USD')
        );
    });

    it('keeps the sign for negative amounts (net cash, capex)', () => {
        expect(formatCurrencyCompact(-100_607_975_000_000, 'KRW')).toContain(
            '-'
        );
    });
});

describe('statementCurrencyOf', () => {
    it.each(['005930.KS', '247540.KQ', '005930.ks'])(
        'maps %s to KRW',
        symbol => {
            expect(statementCurrencyOf(symbol)).toBe('KRW');
        }
    );

    it.each(['AAPL', 'BRK.B', 'BTCUSD', '005930'])(
        'leaves %s on USD',
        symbol => {
            expect(statementCurrencyOf(symbol)).toBe('USD');
        }
    );
});
