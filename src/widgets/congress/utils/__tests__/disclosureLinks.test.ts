import {
    PTR_ID_PREFIX_LENGTH,
    SENATE_EFD_SEARCH_URL,
    extractSenatePtrId,
    getDisclosureHref,
} from '../disclosureLinks';

const PTR_URL =
    'https://efdsearch.senate.gov/search/view/ptr/029f67f3-1234-5678-abcd-ef0123456789/';

describe('getDisclosureHref', () => {
    it('routes senate links to the efdsearch landing page', () => {
        expect(getDisclosureHref('senate', PTR_URL)).toBe(
            SENATE_EFD_SEARCH_URL
        );
    });

    it('keeps house links direct', () => {
        const pdf = 'https://disclosures-clerk.house.gov/ptr/example.pdf';
        expect(getDisclosureHref('house', pdf)).toBe(pdf);
    });
});

describe('extractSenatePtrId', () => {
    it('extracts the UUID from a ptr deep link', () => {
        expect(extractSenatePtrId(PTR_URL)).toBe(
            '029f67f3-1234-5678-abcd-ef0123456789'
        );
    });

    it('tolerates trailing query strings', () => {
        expect(extractSenatePtrId(`${PTR_URL}?utm_source=fmp`)).toBe(
            '029f67f3-1234-5678-abcd-ef0123456789'
        );
    });

    it('returns null for an unexpected shape', () => {
        expect(
            extractSenatePtrId('https://efdsearch.senate.gov/oddshape/')
        ).toBeNull();
    });
});

describe('PTR_ID_PREFIX_LENGTH', () => {
    it('is 8', () => {
        expect(PTR_ID_PREFIX_LENGTH).toBe(8);
    });
});
