import { describe, expect, it } from 'vitest';
import { FakeCongressTradesProvider } from '@/shared/api/fmp/FakeCongressTradesProvider';

describe('FakeCongressTradesProvider', () => {
    const fake = new FakeCongressTradesProvider();

    describe('senate chamber', () => {
        it('returns the senate raw fixture with type Purchase', async () => {
            const rows = await fake.getTrades('AAPL', 'senate', 10);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.type).toBe('Purchase');
        });

        it('exposes deterministic RawCongressTrade values', async () => {
            const rows = await fake.getTrades('AAPL', 'senate', 10);
            expect(rows[0]).toEqual({
                senateID: 'C001047',
                disclosureDate: '2026-05-07',
                transactionDate: '2026-04-17',
                firstName: 'Shelley',
                lastName: 'Capito',
                office: 'Shelley Capito',
                district: 'WV',
                owner: 'Spouse',
                assetDescription: 'Apple Inc',
                assetType: 'Stock',
                type: 'Purchase',
                amount: '$1,001 - $15,000',
                capitalGainsOver200USD: 'False',
                link: 'https://efdsearch.senate.gov/x',
            });
        });

        it('amount is a string (RAW shape — not parsed)', async () => {
            const rows = await fake.getTrades('AAPL', 'senate', 10);
            expect(typeof rows[0]?.amount).toBe('string');
        });

        it('does NOT contain normalized `side` field', async () => {
            const rows = await fake.getTrades('AAPL', 'senate', 10);
            expect('side' in (rows[0] ?? {})).toBe(false);
        });

        it('respects limit', async () => {
            const rows = await fake.getTrades('AAPL', 'senate', 0);
            expect(rows).toHaveLength(0);
        });
    });

    describe('house chamber', () => {
        it('returns the house raw fixture with type Sale (Partial)', async () => {
            const rows = await fake.getTrades('AAPL', 'house', 10);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.type).toBe('Sale (Partial)');
        });

        it('exposes deterministic RawCongressTrade values', async () => {
            const rows = await fake.getTrades('AAPL', 'house', 10);
            expect(rows[0]).toEqual({
                senateID: null,
                disclosureDate: '2026-06-04',
                transactionDate: '2025-02-07',
                firstName: 'Tim',
                lastName: 'Walberg',
                office: 'Tim Walberg',
                district: '',
                owner: 'Joint',
                assetDescription: 'Apple Inc',
                assetType: 'Stock',
                type: 'Sale (Partial)',
                amount: '$15,001 - $50,000',
                capitalGainsOver200USD: 'False',
                link: 'https://disclosures-clerk.house.gov/x.pdf',
            });
        });

        it('does NOT contain normalized `side` field', async () => {
            const rows = await fake.getTrades('AAPL', 'house', 10);
            expect('side' in (rows[0] ?? {})).toBe(false);
        });

        it('respects limit', async () => {
            const rows = await fake.getTrades('AAPL', 'house', 0);
            expect(rows).toHaveLength(0);
        });
    });

    describe('EMPTYX symbol', () => {
        it('returns [] for senate chamber', async () => {
            const rows = await fake.getTrades('EMPTYX', 'senate', 10);
            expect(rows).toEqual([]);
        });

        it('returns [] for house chamber', async () => {
            const rows = await fake.getTrades('EMPTYX', 'house', 10);
            expect(rows).toEqual([]);
        });

        it('is case-insensitive (emptyx → [])', async () => {
            const rows = await fake.getTrades('emptyx', 'senate', 10);
            expect(rows).toEqual([]);
        });
    });

    describe('determinism', () => {
        it('senate fixture is symbol-agnostic (same result for any non-EMPTYX symbol)', async () => {
            const aapl = await fake.getTrades('AAPL', 'senate', 10);
            const msft = await fake.getTrades('MSFT', 'senate', 10);
            expect(aapl).toEqual(msft);
        });

        it('house fixture is symbol-agnostic', async () => {
            const aapl = await fake.getTrades('AAPL', 'house', 10);
            const tsla = await fake.getTrades('TSLA', 'house', 10);
            expect(aapl).toEqual(tsla);
        });
    });
});

// NOTE: getCongressTradesProvider factory singleton + E2E branch is not unit-tested
// here because vitest's ESM runner cannot resolve CJS `require()` relative paths.
// This matches the pattern in getFinancialStatementsProvider.test.ts. The E2E path
// is exercised by Playwright E2E tests running with E2E_TEST=1.
