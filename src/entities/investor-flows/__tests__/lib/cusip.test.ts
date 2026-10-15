import { describe, expect, it } from 'vitest';
import {
    cusipFromIsin,
    figiTickersMatchSymbol,
    isValidCusipChecksum,
    normalizeTickerForMatch,
    parseProfileCusip,
} from '../../lib/cusip';

describe('isValidCusipChecksum', () => {
    it.each(['037833100', '594918104', '67066G104', '02079K305'])(
        'accepts real CUSIP %s',
        cusip => {
            expect(isValidCusipChecksum(cusip)).toBe(true);
        }
    );

    it('rejects a wrong check digit', () => {
        expect(isValidCusipChecksum('037833101')).toBe(false);
    });

    it('rejects the wrong length', () => {
        expect(isValidCusipChecksum('03783310')).toBe(false);
    });
});

describe('cusipFromIsin', () => {
    it('derives the CUSIP from a US ISIN (AAPL)', () => {
        expect(cusipFromIsin('US0378331005')).toBe('037833100');
    });

    it('derives from a Canadian ISIN too', () => {
        expect(cusipFromIsin('CA0679011084')).toBe('067901108');
    });

    it('rejects non-US/CA ISINs', () => {
        expect(cusipFromIsin('GB0002634946')).toBeNull();
    });

    it('rejects an ISIN whose embedded CUSIP fails the checksum', () => {
        expect(cusipFromIsin('US0378331015')).toBeNull();
    });

    it('rejects non-strings and malformed values', () => {
        expect(cusipFromIsin(null)).toBeNull();
        expect(cusipFromIsin('US123')).toBeNull();
    });
});

describe('parseProfileCusip', () => {
    it('accepts a 9-character CUSIP and normalises case', () => {
        expect(parseProfileCusip('67066g104')).toBe('67066G104');
    });

    it('rejects empty, short and non-string values', () => {
        expect(parseProfileCusip('')).toBeNull();
        expect(parseProfileCusip('12345')).toBeNull();
        expect(parseProfileCusip(12345)).toBeNull();
    });
});

describe('ticker matching', () => {
    it('ignores class separators and case', () => {
        expect(normalizeTickerForMatch('brk.b')).toBe('BRKB');
        expect(normalizeTickerForMatch('BF/B')).toBe('BFB');
    });

    it('matches when any FIGI ticker equals the symbol', () => {
        expect(figiTickersMatchSymbol(['XYZ', 'BRK/B'], 'BRK.B')).toBe(true);
    });

    it('does not match a different ticker or an empty list', () => {
        expect(figiTickersMatchSymbol(['AAPL'], 'MSFT')).toBe(false);
        expect(figiTickersMatchSymbol([], 'MSFT')).toBe(false);
    });
});
