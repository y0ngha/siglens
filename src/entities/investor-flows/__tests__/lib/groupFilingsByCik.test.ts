import { groupFilingsByCik } from '../../lib/groupFilingsByCik';

const filing = (cik: string, filingDate: string, accession: string) => ({
    cik,
    filingDate,
    accession,
});

describe('groupFilingsByCik', () => {
    it('groups by cik in first-seen order', () => {
        const groups = groupFilingsByCik([
            filing('2', '2026-01-01', 'a'),
            filing('1', '2026-01-01', 'b'),
            filing('2', '2026-01-02', 'c'),
        ]);
        expect(groups.map(group => group.map(f => f.accession))).toEqual([
            ['a', 'c'],
            ['b'],
        ]);
    });

    it('orders a group by filing date then accession', () => {
        const [group] = groupFilingsByCik([
            filing('1', '2026-02-01', 'a'),
            filing('1', '2026-01-01', 'z'),
            filing('1', '2026-01-01', 'b'),
        ]);
        expect(group?.map(f => f.accession)).toEqual(['b', 'z', 'a']);
    });

    it('returns no groups for no filings', () => {
        expect(groupFilingsByCik([])).toEqual([]);
    });
});
