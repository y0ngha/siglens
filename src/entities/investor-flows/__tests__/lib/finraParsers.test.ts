import { describe, expect, it } from 'vitest';
import {
    parseCnmsShortVolume,
    parseShortInterest,
} from '../../lib/finraParsers';
import { buildSymbolAliasResolver } from '../../lib/symbolAliasResolver';
import {
    CNMS_SAMPLE,
    SHORT_INTEREST_SAMPLE,
} from '../fixtures/investorFlowsSamples';

// Universe uses OUR notation (dot class separator).
const resolver = buildSymbolAliasResolver(['AAPL', 'MSFT', 'BF.A', 'BF.B']);

describe('parseCnmsShortVolume (real CNMS rows)', () => {
    const rows = parseCnmsShortVolume(CNMS_SAMPLE, resolver);

    it('keeps only universe symbols', () => {
        expect(rows.map(r => r.symbol).sort()).toEqual([
            'AAPL',
            'BF.A',
            'BF.B',
            'MSFT',
        ]);
    });

    it('rounds fractional volumes and reads the ISO trade date', () => {
        expect(rows.find(r => r.symbol === 'AAPL')).toEqual({
            symbol: 'AAPL',
            tradeDate: '2026-10-14',
            shortVolume: 9631784,
            totalVolume: 16757127,
        });
    });

    it('maps slash-notation class shares to our symbols', () => {
        expect(rows.find(r => r.symbol === 'BF.B')?.shortVolume).toBe(828017);
    });

    it('skips rows with missing or non-numeric volumes', () => {
        const text =
            'Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market\n20261014|AAPL|abc|0|10|Q\n20261014|MSFT||0|10|Q\n';
        expect(parseCnmsShortVolume(text, resolver)).toEqual([]);
    });

    it('keeps the first row when a symbol repeats', () => {
        const text =
            'Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market\n20261014|AAPL|1|0|10|Q\n20261014|AAPL|2|0|20|Q\n';
        expect(parseCnmsShortVolume(text, resolver)).toHaveLength(1);
        expect(parseCnmsShortVolume(text, resolver)[0]?.shortVolume).toBe(1);
    });

    it('returns [] for an empty file', () => {
        expect(parseCnmsShortVolume('', resolver)).toEqual([]);
    });
});

describe('parseShortInterest (real biweekly rows)', () => {
    const rows = parseShortInterest(SHORT_INTEREST_SAMPLE, resolver);

    it('keeps only universe symbols, mapping BFA/BFB to BF.A/BF.B', () => {
        expect(rows.map(r => r.symbol).sort()).toEqual([
            'AAPL',
            'BF.A',
            'BF.B',
            'MSFT',
        ]);
    });

    it('reads quantities, previous quantity, average volume and days to cover', () => {
        expect(rows.find(r => r.symbol === 'AAPL')).toEqual({
            symbol: 'AAPL',
            settlementDate: '2026-09-30',
            shortQty: 120763539,
            prevShortQty: 128753092,
            avgDailyVolume: 39858260,
            daysToCover: 3.03,
        });
    });

    it('treats the 999.99 days-to-cover cap as unknown', () => {
        const header = SHORT_INTEREST_SAMPLE.split('\n')[0] as string;
        const row =
            '"20260930"|"AAPL"|"Apple"|"R"|"NNM"|"100"|"90"||"0"|"999.99"||"1.0"|"10"|"2026-09-30"';
        const parsed = parseShortInterest(`${header}\n${row}\n`, resolver);
        expect(parsed[0]?.daysToCover).toBeNull();
    });

    it('reads columns by header name, not position', () => {
        const text =
            '"settlementDate"|"symbolCode"|"currentShortPositionQuantity"\n"2026-09-30"|"MSFT"|"55"\n';
        expect(parseShortInterest(text, resolver)).toEqual([
            {
                symbol: 'MSFT',
                settlementDate: '2026-09-30',
                shortQty: 55,
                prevShortQty: null,
                avgDailyVolume: null,
                daysToCover: null,
            },
        ]);
    });
});
