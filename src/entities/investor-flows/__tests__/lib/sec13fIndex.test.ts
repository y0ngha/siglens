import { describe, expect, it } from 'vitest';
import { parseSec13fFormIndex } from '../../lib/sec13fIndex';
import { FORM_INDEX_SAMPLE } from '../fixtures/investorFlowsSamples';

describe('parseSec13fFormIndex', () => {
    describe('real daily form index', () => {
        const entries = parseSec13fFormIndex(FORM_INDEX_SAMPLE);

        it('keeps only 13F-HR and 13F-HR/A (drops 13F-NT and other forms)', () => {
            expect(entries.map(e => e.formType)).toEqual([
                '13F-HR/A',
                '13F-HR/A',
                '13F-HR',
                '13F-HR',
            ]);
        });

        it('extracts cik (10-digit padded), filing date and dashed accession', () => {
            expect(entries[2]).toEqual({
                formType: '13F-HR',
                companyName: '15 Wealth Advisors LLC',
                cik: '0002148692',
                filingDate: '2026-10-14',
                accession: '0002085853-26-001185',
            });
        });

        it('keeps company names that contain digits intact', () => {
            expect(entries[3]?.companyName).toBe('6th Street Advisors, LLC');
        });
    });

    describe('edge cases', () => {
        const line = (acc: string): string =>
            `13F-HR           Foo LLC                                                        1234     20261014    edgar/data/1234/${acc}.txt`;

        it('collapses a repeated accession to its first line', () => {
            const text = [
                line('0001234567-26-000001'),
                line('0001234567-26-000001'),
            ].join('\n');
            expect(parseSec13fFormIndex(text)).toHaveLength(1);
        });

        it('returns an empty list for text without matching lines', () => {
            expect(parseSec13fFormIndex('Description: x\n\n')).toEqual([]);
        });

        it('pads a short CIK to ten digits', () => {
            expect(
                parseSec13fFormIndex(line('0001234567-26-000002'))[0]?.cik
            ).toBe('0000001234');
        });
    });
});
