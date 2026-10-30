import { describe, expect, it } from 'vitest';
import {
    INVESTOR_FLOWS_FORM144_RETENTION_DAYS,
    INVESTOR_FLOWS_OFFERING_RETENTION_DAYS,
    INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
} from '../../lib/investorFlowsPolicy';
import { addDays } from '../../lib/investorFlowsDates';
import type { IndexTarget } from '../../lib/offeringIndex';
import {
    INDEX_FORMS,
    SEC_FILINGS_CURSOR_OVERLAP_DAYS,
    filingsPruneCutoffs,
    offeringRows,
    planDay,
    planRetries,
    representativeSymbol,
    secFilingsStartDate,
} from '../../lib/secFilingsPlan';

const target = (over: Partial<IndexTarget>): IndexTarget => ({
    accession: '0000000001-26-000001',
    formType: '144',
    filingDate: '2026-10-15',
    issuers: new Map([['0000000001', ['AAA']]]),
    primaryCik: '0000000001',
    ...over,
});

describe('constants', () => {
    it('reads both Form 144 and offering forms from the index', () => {
        expect(INDEX_FORMS.has('144')).toBe(true);
        expect(INDEX_FORMS.has('S-3')).toBe(true);
        expect(INDEX_FORMS.has('8-K')).toBe(false);
    });
});

describe('representativeSymbol', () => {
    it('picks the first symbol in sort order', () => {
        expect(representativeSymbol(['LEN-B', 'LEN'])).toBe('LEN');
    });

    it('is undefined for no symbols', () => {
        expect(representativeSymbol([])).toBeUndefined();
    });
});

describe('offeringRows', () => {
    it('makes one row per issuer symbol with the filing index url', () => {
        const rows = offeringRows(
            '0001193125-26-421862',
            '424B5',
            '2026-10-15',
            new Map([
                ['0000920760', ['LEN', 'LEN-B']],
                ['0001564321', ['ARZ']],
            ]),
            'prospectus'
        );
        expect(rows.map(row => [row.symbol, row.issuerCik])).toEqual([
            ['LEN', 920760],
            ['LEN-B', 920760],
            ['ARZ', 1564321],
        ]);
        expect(rows[0]).toMatchObject({
            accession: '0001193125-26-421862',
            formType: '424B5',
            filingDate: '2026-10-15',
            kind: 'prospectus',
            url: 'https://www.sec.gov/Archives/edgar/data/920760/000119312526421862/0001193125-26-421862-index.htm',
        });
    });
});

describe('planDay', () => {
    const none = new Set<string>();
    const noFailures = new Map<string, number>();

    it('plans a Form 144 document for a new accession', () => {
        const plan = planDay([target({})], none, none, noFailures);
        expect(plan.formOnly).toEqual([]);
        expect(plan.documents).toEqual([
            {
                kind: 'form144',
                target: {
                    accession: '0000000001-26-000001',
                    cik: '0000000001',
                    formType: '144',
                    filingDate: '2026-10-15',
                },
            },
        ]);
    });

    it('skips a Form 144 that is already stored', () => {
        const plan = planDay(
            [target({})],
            new Set(['0000000001-26-000001']),
            none,
            noFailures
        );
        expect(plan.documents).toEqual([]);
    });

    it('skips a Form 144 whose attempts are exhausted but not one with attempts left', () => {
        const exhausted = new Map([
            ['0000000001-26-000001', INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS],
        ]);
        const left = new Map([
            [
                '0000000001-26-000001',
                INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS - 1,
            ],
        ]);
        expect(planDay([target({})], none, none, exhausted).documents).toEqual(
            []
        );
        expect(planDay([target({})], none, none, left).documents).toHaveLength(
            1
        );
    });

    it('turns a document-free offering form into rows without a document', () => {
        const plan = planDay(
            [target({ formType: 'S-3', accession: '0000000002-26-000001' })],
            none,
            none,
            noFailures
        );
        expect(plan.documents).toEqual([]);
        expect(plan.formOnly).toEqual([
            expect.objectContaining({
                accession: '0000000002-26-000001',
                symbol: 'AAA',
                kind: 'shelf',
            }),
        ]);
    });

    it('skips an offering that is already stored', () => {
        const plan = planDay(
            [target({ formType: 'S-3', accession: '0000000002-26-000001' })],
            none,
            new Set(['0000000002-26-000001']),
            noFailures
        );
        expect(plan).toEqual({ formOnly: [], documents: [] });
    });

    it('plans a prospectus document for 424B5 with its issuers', () => {
        const issuers = new Map([['0000000001', ['AAA']]]);
        const plan = planDay(
            [
                target({
                    formType: '424B5',
                    accession: '0000000003-26-000001',
                    issuers,
                }),
            ],
            none,
            none,
            noFailures
        );
        expect(plan.documents).toEqual([
            {
                kind: 'prospectus',
                target: expect.objectContaining({
                    accession: '0000000003-26-000001',
                    formType: '424B5',
                }),
                issuers,
            },
        ]);
    });

    it('skips a 424B5 whose attempts are exhausted', () => {
        const plan = planDay(
            [target({ formType: '424B5', accession: '0000000003-26-000001' })],
            none,
            none,
            new Map([
                [
                    '0000000003-26-000001',
                    INVESTOR_FLOWS_SEC_FILINGS_MAX_ATTEMPTS,
                ],
            ])
        );
        expect(plan.documents).toEqual([]);
    });

    it('ignores forms that are not offerings', () => {
        const plan = planDay(
            [target({ formType: '8-K' })],
            none,
            none,
            noFailures
        );
        expect(plan).toEqual({ formOnly: [], documents: [] });
    });

    it('keeps document plans in target order and collects form-only rows separately', () => {
        const plan = planDay(
            [
                target({ accession: '0000000001-26-000001' }),
                target({ formType: 'S-1', accession: '0000000002-26-000001' }),
                target({
                    formType: '424B5',
                    accession: '0000000003-26-000001',
                }),
            ],
            none,
            none,
            noFailures
        );
        expect(plan.documents.map(d => d.kind)).toEqual([
            'form144',
            'prospectus',
        ]);
        expect(plan.formOnly.map(r => r.accession)).toEqual([
            '0000000002-26-000001',
        ]);
    });
});

describe('planRetries', () => {
    const retry = (formType: string, cik = '0000000001') => ({
        accession: '0000000009-26-000001',
        cik,
        formType,
        filingDate: '2026-10-01',
        attempts: 1,
    });
    const cikSymbols = new Map<number, readonly string[]>([[1, ['AAA']]]);

    it('retries a Form 144 as is, without the attempt count', () => {
        expect(planRetries([retry('144')], cikSymbols)).toEqual([
            {
                kind: 'form144',
                target: {
                    accession: '0000000009-26-000001',
                    cik: '0000000001',
                    formType: '144',
                    filingDate: '2026-10-01',
                },
            },
        ]);
    });

    it('retries a 424B5 for an issuer still in the universe', () => {
        const [plan] = planRetries([retry('424B5')], cikSymbols);
        expect(plan).toMatchObject({
            kind: 'prospectus',
            issuers: new Map([['0000000001', ['AAA']]]),
        });
    });

    it('drops a 424B5 whose issuer left the universe', () => {
        expect(planRetries([retry('424B5', '0000000777')], cikSymbols)).toEqual(
            []
        );
    });

    it('drops forms that never need a document retry', () => {
        expect(planRetries([retry('S-3')], cikSymbols)).toEqual([]);
    });
});

describe('secFilingsStartDate', () => {
    it('starts at the backfill start without a cursor', () => {
        expect(secFilingsStartDate(null, '2026-04-18')).toBe('2026-04-18');
    });

    it('re-reads the overlap before the cursor', () => {
        expect(secFilingsStartDate('2026-10-14', '2026-04-18')).toBe(
            addDays('2026-10-14', -SEC_FILINGS_CURSOR_OVERLAP_DAYS)
        );
    });

    it('never goes back before the backfill start', () => {
        expect(secFilingsStartDate('2026-04-19', '2026-04-18')).toBe(
            '2026-04-18'
        );
    });
});

describe('filingsPruneCutoffs', () => {
    it('derives each cutoff from its retention and reuses the Form 144 one for failures', () => {
        const cutoffs = filingsPruneCutoffs('2026-10-15');
        expect(cutoffs).toEqual({
            form144Before: addDays(
                '2026-10-15',
                -INVESTOR_FLOWS_FORM144_RETENTION_DAYS
            ),
            offeringsBefore: addDays(
                '2026-10-15',
                -INVESTOR_FLOWS_OFFERING_RETENTION_DAYS
            ),
            failuresBefore: addDays(
                '2026-10-15',
                -INVESTOR_FLOWS_FORM144_RETENTION_DAYS
            ),
        });
    });
});
