import { describe, expect, it } from 'vitest';
import { parseCompanyTickers } from '../../lib/companyTickers';
import { COMPANY_TICKERS_EXCERPT } from '../fixtures/investorFlowsExpansionSamples';

describe('parseCompanyTickers', () => {
    it('keeps universe tickers and every universe class of one CIK', () => {
        const pairs = parseCompanyTickers(COMPANY_TICKERS_EXCERPT, [
            'GOOG',
            'GOOGL',
            'BRK-B',
            'AMD',
        ]);
        expect(pairs).toHaveLength(4);
        expect(pairs).toEqual(
            expect.arrayContaining([
                { cik: 1652044, symbol: 'GOOGL' },
                { cik: 1652044, symbol: 'GOOG' },
                { cik: 1067983, symbol: 'BRK-B' },
                { cik: 2488, symbol: 'AMD' },
            ])
        );
    });

    it('matches a dot universe symbol to the SEC dash form (BF.B ↔ BF-B)', () => {
        expect(parseCompanyTickers(COMPANY_TICKERS_EXCERPT, ['BF.B'])).toEqual([
            { cik: 14693, symbol: 'BF.B' },
        ]);
    });

    it('does not use compact aliases (BFB is not BF-B)', () => {
        expect(parseCompanyTickers(COMPANY_TICKERS_EXCERPT, ['BFB'])).toEqual(
            []
        );
    });

    it('drops malformed rows and non-object input', () => {
        expect(
            parseCompanyTickers(
                {
                    0: { cik_str: '320193', ticker: 'AAPL' },
                    1: { cik_str: 0, ticker: 'AAPL' },
                },
                ['AAPL']
            )
        ).toEqual([]);
        expect(parseCompanyTickers(null, ['AAPL'])).toEqual([]);
    });
});
