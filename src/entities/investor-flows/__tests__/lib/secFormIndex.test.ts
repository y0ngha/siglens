import { describe, expect, it } from 'vitest';
import { parseSecFormIndex } from '../../lib/secFormIndex';
import { FORM_144_FORMS, OFFERING_FORMS } from '../../lib/offeringIndex';
import { FORM_INDEX_EXPANSION_EXCERPT } from '../fixtures/investorFlowsExpansionSamples';

describe('parseSecFormIndex', () => {
    it('keeps every line of the requested forms, one per CIK (issuer and reporter of one Form 144)', () => {
        const entries = parseSecFormIndex(
            FORM_INDEX_EXPANSION_EXCERPT,
            FORM_144_FORMS
        );
        expect(
            entries
                .filter(e => e.accession === '0001950047-26-010251')
                .map(e => e.cik)
        ).toEqual(['0000002488', '0001622864']);
    });

    it('extracts form, company, padded CIK, ISO filing date and dashed accession', () => {
        const [amd] = parseSecFormIndex(
            FORM_INDEX_EXPANSION_EXCERPT,
            FORM_144_FORMS
        );
        expect(amd).toEqual({
            formType: '144',
            companyName: 'ADVANCED MICRO DEVICES INC',
            cik: '0000002488',
            filingDate: '2026-10-15',
            accession: '0001950047-26-010251',
        });
    });

    it('drops forms that are not requested (424B2 structured notes, FWP)', () => {
        const forms = new Set(
            parseSecFormIndex(FORM_INDEX_EXPANSION_EXCERPT, OFFERING_FORMS).map(
                e => e.formType
            )
        );
        expect([...forms].sort()).toEqual(['424B3', '424B5', 'D', 'S-3']);
    });
});
