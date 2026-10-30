import { describe, expect, it } from 'vitest';
import {
    accessionFromFilingUrl,
    indexSubmissions,
    indexSubmissionsFile,
    isLargeHolderForm,
} from '../largeHolderForms';
import { AAPL_SUBMISSIONS } from './fixtures/submissionsSample';

describe('accessionFromFilingUrl', () => {
    it('reads the dashed accession from the new EDGAR URL (FMP 13G row)', () => {
        expect(
            accessionFromFilingUrl(
                'https://www.sec.gov/Archives/edgar/data/320193/000210011926000139/xslSCHEDULE_13G_X02/primary_doc.xml'
            )
        ).toBe('0002100119-26-000139');
    });

    it('reads it from a legacy document URL too', () => {
        expect(
            accessionFromFilingUrl(
                'https://www.sec.gov/Archives/edgar/data/320193/000119312524036431/d751537dsc13ga.htm'
            )
        ).toBe('0001193125-24-036431');
    });

    it('returns null for URLs without an accession folder', () => {
        expect(accessionFromFilingUrl('https://example.com/x')).toBeNull();
        expect(accessionFromFilingUrl(null)).toBeNull();
    });
});

describe('isLargeHolderForm', () => {
    it.each([
        'SC 13D',
        'SC 13D/A',
        'SC 13G',
        'SC 13G/A',
        'SCHEDULE 13D',
        'SCHEDULE 13G/A',
    ])('accepts %s', form => {
        expect(isLargeHolderForm(form)).toBe(true);
    });

    it.each(['4', '8-K', '13F-HR', 'SC 13E3', 'SC TO-T'])(
        'rejects %s',
        form => {
            expect(isLargeHolderForm(form)).toBe(false);
        }
    );
});

describe('indexSubmissions (real AAPL submissions, trimmed)', () => {
    const index = indexSubmissions(AAPL_SUBMISSIONS);

    it('maps the 13G accessions of both naming eras to their exact form', () => {
        expect(index.forms.get('0002100119-26-000139')).toBe('SCHEDULE 13G');
        expect(index.forms.get('0000102909-26-000630')).toBe('SCHEDULE 13G/A');
        expect(index.forms.get('0001193125-24-036431')).toBe('SC 13G/A');
    });

    it('does not map non-13D/G filings (Form 4)', () => {
        expect(index.forms.has('0001140361-26-039158')).toBe(false);
    });

    it('reports the oldest recent filing date and the older archive files', () => {
        expect(index.oldestFilingDate).toBeTypeOf('string');
        expect(index.extraFiles).toEqual([
            {
                name: 'CIK0000320193-submissions-001.json',
                filingFrom: '1994-01-26',
                filingTo: '2015-09-15',
            },
        ]);
    });

    it('returns an empty index for an unexpected shape', () => {
        expect(indexSubmissions(null).forms.size).toBe(0);
        expect(
            indexSubmissions({ filings: { recent: { accessionNumber: 'x' } } })
                .forms.size
        ).toBe(0);
    });

    it('skips archive file entries that are not objects with name and dates', () => {
        const index = indexSubmissions({
            filings: {
                files: [
                    null,
                    'x',
                    { name: 'a.json' },
                    {
                        name: 'CIK-submissions-001.json',
                        filingFrom: '2001-01-01',
                        filingTo: '2010-12-31',
                    },
                ],
            },
        });
        expect(index.extraFiles).toEqual([
            {
                name: 'CIK-submissions-001.json',
                filingFrom: '2001-01-01',
                filingTo: '2010-12-31',
            },
        ]);
    });
});

describe('indexSubmissionsFile', () => {
    it('reads the top-level column arrays of an archive file', () => {
        const file = {
            accessionNumber: ['0000000001-14-000001', '0000000001-14-000002'],
            filingDate: ['2014-02-01', '2014-03-01'],
            form: ['SC 13D/A', '10-K'],
        };
        const index = indexSubmissionsFile(file);
        expect([...index.forms]).toEqual([
            ['0000000001-14-000001', 'SC 13D/A'],
        ]);
        expect(index.oldestFilingDate).toBe('2014-02-01');
    });
});
