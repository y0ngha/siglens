import { describe, expect, it } from 'vitest';
import {
    FORM_144_FORMS,
    OFFERING_FORMS,
    offeringKindForForm,
    secFilingIndexUrl,
    selectIndexTargets,
} from '../../lib/offeringIndex';
import { parseSecFormIndex } from '../../lib/secFormIndex';
import { FORM_INDEX_EXPANSION_EXCERPT } from '../fixtures/investorFlowsExpansionSamples';

const CIK_SYMBOLS = new Map<number, readonly string[]>([
    [2488, ['AMD']],
    [920760, ['LEN', 'LEN-B']],
    [1601830, ['RXRX']],
    [1650372, ['TEAM']],
]);

describe('offeringKindForForm', () => {
    it.each([
        ['S-1', 'registration'],
        ['F-1/A', 'registration'],
        ['S-3ASR', 'shelf'],
        ['F-3', 'shelf'],
        ['424B4', 'prospectus'],
        ['D/A', 'private_placement'],
    ])('maps %s to %s', (form, kind) => {
        expect(offeringKindForForm(form)).toBe(kind);
    });

    it('needs the document for 424B5', () => {
        expect(offeringKindForForm('424B5')).toBeNull();
    });

    it.each(['424B2', 'FWP', '8-K'])(
        'does not treat %s as an offering',
        form => {
            expect(offeringKindForForm(form)).toBeUndefined();
            expect(OFFERING_FORMS.has(form)).toBe(false);
        }
    );
});

describe('secFilingIndexUrl', () => {
    it('links the EDGAR filing index page', () => {
        expect(secFilingIndexUrl('0000002488', '0001950047-26-010251')).toBe(
            'https://www.sec.gov/Archives/edgar/data/2488/000195004726010251/0001950047-26-010251-index.htm'
        );
    });
});

describe('selectIndexTargets', () => {
    describe('Form 144 (issuer + reporting-person lines)', () => {
        const targets = selectIndexTargets(
            parseSecFormIndex(FORM_INDEX_EXPANSION_EXCERPT, FORM_144_FORMS),
            CIK_SYMBOLS
        );

        it('merges the two lines of one accession into one target', () => {
            expect(
                targets.filter(t => t.accession === '0001950047-26-010251')
            ).toHaveLength(1);
        });

        it('keeps only CIKs present in the CIK map (the reporter CIK is not a listed issuer)', () => {
            const amd = targets.find(
                t => t.accession === '0001950047-26-010251'
            );
            expect([...(amd?.issuers ?? new Map()).entries()]).toEqual([
                ['0000002488', ['AMD']],
            ]);
        });
    });

    describe('offerings with co-registrants', () => {
        const targets = selectIndexTargets(
            parseSecFormIndex(FORM_INDEX_EXPANSION_EXCERPT, OFFERING_FORMS),
            CIK_SYMBOLS
        );

        it('keeps only the universe issuer of a co-registrant filing (Lennar, not its subsidiaries)', () => {
            const lennar = targets.find(
                t => t.accession === '0001193125-26-421862'
            );
            expect([...(lennar?.issuers ?? new Map()).entries()]).toEqual([
                ['0000920760', ['LEN', 'LEN-B']],
            ]);
        });

        it('drops accessions without any universe CIK before any document is fetched', () => {
            expect(targets.map(t => t.accession).sort()).toEqual([
                '0001193125-26-421862',
                '0001601830-26-000126',
            ]);
        });
    });
});
