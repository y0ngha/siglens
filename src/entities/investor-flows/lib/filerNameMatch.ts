/**
 * Legal-form words dropped from the END of a filer or query name, so "Vanguard Group Inc" and "Vanguard Group"
 * match. One list for both sides of the comparison.
 */
export const FILER_LEGAL_FORM_TOKENS: readonly string[] = [
    'INC',
    'INCORPORATED',
    'CORP',
    'CORPORATION',
    'CO',
    'COMPANY',
    'LLC',
    'LP',
    'LLP',
    'LTD',
    'LIMITED',
    'PLC',
    'SA',
    'AG',
    'NV',
    'THE',
];

const LATIN_LETTER = /\p{Script=Latin}/u;
const NON_WORD = /[^\p{L}\p{N}]+/gu;

/** Drops legal-form tokens from the tail only: a legal-form word inside a name ("Company Store Fund") is a real token. */
function dropTrailingLegalForms(tokens: readonly string[]): string[] {
    const end = tokens.findLastIndex(t => !FILER_LEGAL_FORM_TOKENS.includes(t));
    return tokens.slice(0, end + 1);
}

/**
 * Name -> comparable tokens: NFKC, uppercase, `&` to `AND`, punctuation to spaces, trailing legal forms dropped.
 *
 * Only tokens with a Latin letter are kept: 13F filer names are English, and a Korean-only query (the model did
 * not translate it) must yield no tokens so the lookup reports `no_matching_filer` instead of matching on digits.
 */
export function filerNameTokens(name: string): string[] {
    const flat = name
        .normalize('NFKC')
        .toUpperCase()
        .replaceAll('&', ' AND ')
        .replace(NON_WORD, ' ')
        .trim();
    if (flat === '') return [];
    return dropTrailingLegalForms(
        flat.split(' ').filter(t => LATIN_LETTER.test(t))
    );
}

/** True when every query token equals one of the filer's tokens (a subset match: "Vanguard" finds "Vanguard Group"). */
export function matchesFiler(
    queryTokens: readonly string[],
    filerName: string
): boolean {
    if (queryTokens.length === 0) return false;
    const filerTokens = filerNameTokens(filerName);
    return queryTokens.every(t => filerTokens.includes(t));
}
