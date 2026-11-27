import { describe, expect, it } from 'vitest';
import {
    FILER_LEGAL_FORM_TOKENS,
    filerNameTokens,
    matchesFiler,
} from '../../lib/filerNameMatch';

describe('filerNameTokens', () => {
    it.each([
        ['Vanguard Group Inc.', ['VANGUARD', 'GROUP']],
        ['BlackRock, Inc.', ['BLACKROCK']],
        // `&` becomes AND; both trailing legal forms (LLC, then CO) go, the AND stays.
        ['Goldman Sachs & Co. LLC', ['GOLDMAN', 'SACHS', 'AND']],
        [
            'T. Rowe Price Associates, Inc.',
            ['T', 'ROWE', 'PRICE', 'ASSOCIATES'],
        ],
        // legal-form words are dropped from the TAIL only
        ['The Vanguard Group', ['THE', 'VANGUARD', 'GROUP']],
        ['Company Store Fund', ['COMPANY', 'STORE', 'FUND']],
        ['Berkshire Hathaway Corporation Ltd', ['BERKSHIRE', 'HATHAWAY']],
        // NFKC folds full-width letters
        ['ＢＬＡＣＫＲＯＣＫ', ['BLACKROCK']],
    ])('%s -> %j', (name, tokens) => {
        expect(filerNameTokens(name)).toEqual(tokens);
    });

    it('a name with no Latin token yields no tokens (a Korean-only query cannot match)', () => {
        expect(filerNameTokens('블랙록')).toEqual([]);
        expect(filerNameTokens('')).toEqual([]);
        expect(filerNameTokens('  ,. ')).toEqual([]);
    });

    it('keeps only the Latin tokens of a mixed query', () => {
        expect(filerNameTokens('블랙록 BlackRock')).toEqual(['BLACKROCK']);
    });

    it('a query made only of legal-form words yields no tokens', () => {
        expect(filerNameTokens('Inc')).toEqual([]);
        expect(filerNameTokens('The Co.')).toEqual([]);
    });

    it('every listed legal form is dropped from the tail', () => {
        FILER_LEGAL_FORM_TOKENS.forEach(form => {
            expect(filerNameTokens(`Acme ${form}`)).toEqual(['ACME']);
        });
    });
});

describe('matchesFiler', () => {
    it('matches when every query token is a filer token (subset)', () => {
        expect(matchesFiler(['VANGUARD'], 'VANGUARD GROUP INC')).toBe(true);
        expect(matchesFiler(['VANGUARD', 'GROUP'], 'Vanguard Group')).toBe(
            true
        );
        expect(matchesFiler(['GROUP'], 'Vanguard Group Inc')).toBe(true);
    });

    it('compares whole tokens, never substrings', () => {
        expect(matchesFiler(['VANGUARD'], 'Vanguardia Holdings')).toBe(false);
        expect(matchesFiler(['ROCK'], 'BlackRock Inc')).toBe(false);
    });

    it('fails when a query token is missing from the filer name', () => {
        expect(matchesFiler(['VANGUARD', 'FUND'], 'Vanguard Group')).toBe(
            false
        );
    });

    it('an empty query matches nothing', () => {
        expect(matchesFiler([], 'Vanguard Group')).toBe(false);
    });
});
