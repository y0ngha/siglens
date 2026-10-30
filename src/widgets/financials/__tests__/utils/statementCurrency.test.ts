import { describe, expect, it } from 'vitest';
import {
    DEFAULT_STATEMENT_CURRENCY,
    deriveStatementCurrency,
} from '@/widgets/financials/utils/statementCurrency';

type Rows = Parameters<typeof deriveStatementCurrency>[0];

/** 보고 통화만 다른 행들로 스냅샷을 만든다. */
function rowsWith(
    income: (string | null | undefined)[],
    balance: (string | null | undefined)[] = [],
    cashFlow: (string | null | undefined)[] = []
): Rows {
    const toRows = (codes: (string | null | undefined)[]) =>
        codes.map(reportedCurrency => ({ reportedCurrency }));
    return {
        income: toRows(income),
        balance: toRows(balance),
        cashFlow: toRows(cashFlow),
    };
}

describe('DEFAULT_STATEMENT_CURRENCY', () => {
    it('기본 통화는 USD다', () => {
        expect(DEFAULT_STATEMENT_CURRENCY).toBe('USD');
    });
});

describe('deriveStatementCurrency', () => {
    it('행에 보고 통화가 없으면 심볼의 상장 통화를 쓴다', () => {
        expect(
            deriveStatementCurrency(rowsWith([null, undefined]), 'AAPL')
        ).toBe('USD');
        expect(
            deriveStatementCurrency(rowsWith([undefined]), '005930.KS')
        ).toBe('KRW');
    });

    it('행이 하나도 없어도 상장 통화를 쓴다', () => {
        expect(deriveStatementCurrency(rowsWith([]), '005930.KS')).toBe('KRW');
    });

    it('일치하는 보고 통화가 있으면 상장 통화보다 우선한다', () => {
        expect(deriveStatementCurrency(rowsWith(['TWD', 'TWD']), 'TSM')).toBe(
            'TWD'
        );
    });

    it('섹션이 달라도 같은 통화면 쓰고, 공백·소문자는 정규화한다', () => {
        expect(
            deriveStatementCurrency(rowsWith([' twd '], ['TWD'], [null]), 'TSM')
        ).toBe('TWD');
    });

    it('통화가 일부 행에만 있어도 그 통화를 쓴다', () => {
        expect(deriveStatementCurrency(rowsWith([null, 'TWD']), 'TSM')).toBe(
            'TWD'
        );
    });

    it('통화가 서로 다르면 상장 통화로 둔다', () => {
        expect(deriveStatementCurrency(rowsWith(['TWD', 'USD']), 'TSM')).toBe(
            'USD'
        );
        expect(
            deriveStatementCurrency(rowsWith(['TWD'], ['JPY']), '005930.KS')
        ).toBe('KRW');
    });

    it('Intl이 거부하는 코드는 상장 통화로 둔다', () => {
        expect(deriveStatementCurrency(rowsWith(['not-a-code']), 'AAPL')).toBe(
            'USD'
        );
    });
});
