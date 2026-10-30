import {
    buildInsiderStats,
    buildInsiderTransactions,
} from '../../../lib/snapshot/insider';
import { buildLargeHolders } from '../../../lib/snapshot/largeHolders';

const trade = (
    transactionDate: string,
    filingDate: string,
    reportingName: string
) => ({
    symbol: 'AAPL',
    filingDate,
    transactionDate,
    transactionType: 'S-Sale',
    reportingName,
    typeOfOwner: 'officer',
    securitiesTransacted: 10,
    price: 1,
    url: 'https://www.sec.gov/x',
});

describe('buildInsiderTransactions ordering', () => {
    it('breaks same-day ties by newest filing date', () => {
        const out = buildInsiderTransactions([
            trade('2026-10-06', '2026-10-07', 'early'),
            trade('2026-10-06', '2026-10-09', 'late'),
        ]);
        expect(out.map(t => t.name)).toEqual(['late', 'early']);
    });

    it('keeps input order when both dates tie', () => {
        const out = buildInsiderTransactions([
            trade('2026-10-06', '2026-10-07', 'first'),
            trade('2026-10-06', '2026-10-07', 'second'),
        ]);
        expect(out.map(t => t.name)).toEqual(['first', 'second']);
    });
});

describe('buildInsiderStats ordering', () => {
    it('returns the newest eight quarters oldest first', () => {
        const rows = Array.from({ length: 10 }, (_, i) => ({
            symbol: 'AAPL',
            year: 2024 + Math.floor(i / 4),
            quarter: (i % 4) + 1,
            acquiredTransactions: 1,
            disposedTransactions: 1,
            totalAcquired: 1,
            totalDisposed: 1,
        }));
        const out = buildInsiderStats(rows);
        expect(out.map(s => s.period)).toEqual([
            '2024-09-30',
            '2024-12-31',
            '2025-03-31',
            '2025-06-30',
            '2025-09-30',
            '2025-12-31',
            '2026-03-31',
            '2026-06-30',
        ]);
    });
});

describe('buildLargeHolders ordering', () => {
    it('sorts newest filing first and keeps input order on ties', () => {
        const filing = (filingDate: string, nameOfReportingPerson: string) => ({
            symbol: 'AAPL',
            filingDate,
            nameOfReportingPerson,
            form: 'SC 13G',
            percentOfClass: '5',
            amountBeneficiallyOwned: '100',
            url: 'https://www.sec.gov/x',
        });
        const out = buildLargeHolders(
            [
                filing('2026-09-01', 'old'),
                filing('2026-10-01', 'tie-a'),
                filing('2026-10-01', 'tie-b'),
            ],
            '2026-10-15'
        );
        expect(out.map(h => h.filer)).toEqual(['tie-a', 'tie-b', 'old']);
    });
});
