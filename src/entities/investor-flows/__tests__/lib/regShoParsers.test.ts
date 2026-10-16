import { describe, expect, it } from 'vitest';
import {
    parseRegShoThresholdList,
    summarizeThresholdListings,
} from '../../lib/regShoParsers';
import {
    CBOE_BZX_TH_20261015,
    NASDAQ_TH_20261015,
    NASDAQ_TH_NOT_PUBLISHED,
    NYSE_ARCA_TH_20261015,
} from '../fixtures/investorFlowsExpansionSamples';

const ON_DATE = { requestedDate: '2026-10-15', requireFooterDate: false };
const NYSE_ON_DATE = { requestedDate: '2026-10-15', requireFooterDate: true };

describe('parseRegShoThresholdList', () => {
    describe('Nasdaq (flag column, CRLF, timestamp footer)', () => {
        const result = parseRegShoThresholdList(NASDAQ_TH_20261015, ON_DATE);

        it('reads the listed symbols and drops the footer', () => {
            expect(result.status).toBe('ok');
            const symbols = result.status === 'ok' ? result.symbols : [];
            expect(symbols).toContain('AAPD');
            expect(symbols).toContain('YMT');
            expect(symbols).not.toContain('20261015230022');
        });

        it('keeps only rows whose threshold flag is Y', () => {
            const flipped = NASDAQ_TH_20261015.replace(
                'AAPD|DIREXION SHS ETF TR DAILY AAPL|G|Y|N|',
                'AAPD|DIREXION SHS ETF TR DAILY AAPL|G|N|N|'
            );
            const parsed = parseRegShoThresholdList(flipped, ON_DATE);
            expect(
                parsed.status === 'ok' && parsed.symbols.includes('AAPD')
            ).toBe(false);
        });

        it('treats the HTML page served for an unpublished date as unavailable', () => {
            expect(
                parseRegShoThresholdList(NASDAQ_TH_NOT_PUBLISHED, {
                    requestedDate: '2026-10-16',
                    requireFooterDate: false,
                })
            ).toEqual({ status: 'unavailable' });
        });
    });

    describe('NYSE (footer date must equal the requested date)', () => {
        it('reads the list when the footer date matches', () => {
            const result = parseRegShoThresholdList(
                NYSE_ARCA_TH_20261015,
                NYSE_ON_DATE
            );
            expect(result.status === 'ok' ? result.symbols : []).toEqual(
                expect.arrayContaining(['BMNZ', 'USO', 'XHB'])
            );
        });

        it('rejects a "future date" answer whose footer names another day', () => {
            expect(
                parseRegShoThresholdList(NYSE_ARCA_TH_20261015, {
                    requestedDate: '2026-10-16',
                    requireFooterDate: true,
                })
            ).toEqual({ status: 'unavailable' });
        });

        it('rejects a header-only answer without a footer', () => {
            const headerOnly =
                'Symbol|Security Name|Market Category|Reg SHO Threshold Flag|Filler|Filler\r\n';
            expect(parseRegShoThresholdList(headerOnly, NYSE_ON_DATE)).toEqual({
                status: 'unavailable',
            });
        });
    });

    describe('Cboe BZX (two columns, no flag column)', () => {
        it('keeps every row', () => {
            const result = parseRegShoThresholdList(
                CBOE_BZX_TH_20261015,
                ON_DATE
            );
            const symbols = result.status === 'ok' ? result.symbols : [];
            expect(symbols).toContain('ABUF');
            expect(symbols).toContain('XNDX');
            expect(symbols.some(s => /^\d+$/.test(s))).toBe(false);
        });
    });

    it('returns an empty list for a published day without threshold securities', () => {
        expect(
            parseRegShoThresholdList(
                'Symbol|CompanyName\r\n20261015030524\r\n',
                ON_DATE
            )
        ).toEqual({ status: 'ok', symbols: [] });
    });

    it('treats an empty body as unavailable', () => {
        expect(parseRegShoThresholdList('', ON_DATE)).toEqual({
            status: 'unavailable',
        });
    });
});

describe('summarizeThresholdListings', () => {
    const tradeDates = [
        '2026-10-09',
        '2026-10-12',
        '2026-10-13',
        '2026-10-14',
        '2026-10-15',
    ];

    it('counts the unbroken run of ingested trade dates ending at the latest one', () => {
        expect(
            summarizeThresholdListings(
                [
                    { tradeDate: '2026-10-09', markets: ['nasdaq'] },
                    { tradeDate: '2026-10-13', markets: ['nasdaq'] },
                    { tradeDate: '2026-10-14', markets: ['nasdaq'] },
                    {
                        tradeDate: '2026-10-15',
                        markets: ['nyse_arca', 'nasdaq'],
                    },
                ],
                tradeDates
            )
        ).toEqual({
            listed: true,
            consecutiveDays: 3,
            firstListedDate: '2026-10-13',
            markets: ['nasdaq', 'nyse_arca'],
            asOf: '2026-10-15',
        });
    });

    it('is not listed when the latest ingested day has no listing', () => {
        expect(
            summarizeThresholdListings(
                [{ tradeDate: '2026-10-14', markets: ['nasdaq'] }],
                tradeDates
            )
        ).toEqual({
            listed: false,
            consecutiveDays: 0,
            firstListedDate: null,
            markets: [],
            asOf: '2026-10-15',
        });
    });

    it('has no as-of date before any list was ingested', () => {
        expect(summarizeThresholdListings([], []).asOf).toBeNull();
    });
});
