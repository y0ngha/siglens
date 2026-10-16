import { describe, expect, it } from 'vitest';
import {
    OFFERING_CLASSIFY_WINDOW_CHARS,
    classify424B5,
    offeringDocumentText,
} from '../../lib/offeringClassifier';
import {
    B5_ATM_HEARTSCIENCES,
    B5_BEST_EFFORTS_WF_HOLDING,
    B5_DEBT_STATE_STREET,
    B5_UNDERWRITTEN_RECURSION,
} from '../fixtures/investorFlowsExpansionSamples';

describe('classify424B5 (real 424B5 heads, 2026-10-15 filings)', () => {
    it('classifies an at-the-market supplement as atm (HeartSciences)', () => {
        expect(classify424B5(B5_ATM_HEARTSCIENCES)).toBe('atm');
    });

    it('classifies an underwritten offering as underwritten (Recursion)', () => {
        expect(classify424B5(B5_UNDERWRITTEN_RECURSION)).toBe('underwritten');
    });

    it('classifies a placement-agent offering as best_efforts (WF Holding)', () => {
        expect(classify424B5(B5_BEST_EFFORTS_WF_HOLDING)).toBe('best_efforts');
    });

    it('classifies a senior-notes supplement as other even though it has underwriters (State Street)', () => {
        expect(classify424B5(B5_DEBT_STATE_STREET)).toBe('other');
    });
});

describe('classify424B5 rules', () => {
    const doc = (body: string): string =>
        `<DOCUMENT>\n<TYPE>424B5\n<TEXT>\n<html><body><p>Common Stock</p>${body}</body></html>`;

    it('lets ATM wording win over an "underwriter" mention', () => {
        expect(
            classify424B5(
                doc(
                    '<p>The sales agent may be deemed an underwriter under our Sales Agreement.</p>'
                )
            )
        ).toBe('atm');
    });

    it('reads an at&#8209;the&#8209;market spelled with non-breaking hyphen entities', () => {
        expect(
            classify424B5(doc('<p>an at&#8209;the&#8209;market offering</p>'))
        ).toBe('atm');
    });

    it('uses whichever of underwriter / placement agent appears first', () => {
        expect(
            classify424B5(
                doc(
                    '<p>We engaged a placement agent.</p><p>It is not an underwriter.</p>'
                )
            )
        ).toBe('best_efforts');
    });

    it('returns other when no selling method is named', () => {
        expect(classify424B5(doc('<p>Rights offering to holders.</p>'))).toBe(
            'other'
        );
    });

    it('ignores wording past the classification window', () => {
        const filler = `<p>${'x '.repeat(OFFERING_CLASSIFY_WINDOW_CHARS)}</p>`;
        expect(classify424B5(doc(`${filler}<p>underwriter</p>`))).toBe('other');
    });

    it('ignores the SEC header before <TEXT>', () => {
        const withHeader = `<SEC-HEADER>COMPANY: AT-THE-MARKET HOLDINGS</SEC-HEADER>\n${doc('<p>underwriters</p>')}`;
        expect(classify424B5(withHeader)).toBe('underwritten');
    });
});

describe('offeringDocumentText', () => {
    it('strips tags, decodes entities and collapses whitespace', () => {
        expect(
            offeringDocumentText(
                '<p>A&nbsp;&amp;&#160;B</p>\n<p>C&#x2011;D</p>'
            )
        ).toBe('A & B C-D');
    });

    it('leaves an out-of-range numeric entity as written', () => {
        expect(offeringDocumentText('&#99999999;')).toBe('&#99999999;');
    });
});
