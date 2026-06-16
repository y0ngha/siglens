import type {
    Chamber,
    CongressTradesProvider,
    RawCongressTrade,
} from '@y0ngha/siglens-core';

/**
 * E2E-only `CongressTradesProvider` returning deterministic, non-throwing
 * fixture data instead of calling FMP. Reached only when E2E_TEST=1 (see
 * getCongressTradesProvider). Reads NO env keys and performs NO network I/O.
 *
 * Senate fixture: type='Purchase' (buy), House fixture: type='Sale (Partial)' (sell).
 * This ensures a downstream normalized result contains one buy + one sell —
 * making E2E assertions on both trade directions possible.
 *
 * `EMPTYX` symbol returns [] (both chambers) so E2E can test the empty-state UI.
 * Returns RAW rows — `side`/normalized fields are NOT present (same contract as
 * `FmpCongressTradesClient`; normalization is core's responsibility).
 */

const SENATE_FIXTURE: RawCongressTrade[] = [
    {
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
    },
];

const HOUSE_FIXTURE: RawCongressTrade[] = [
    {
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
    },
];

export class FakeCongressTradesProvider implements CongressTradesProvider {
    async getTrades(
        symbol: string,
        chamber: Chamber,
        limit: number
    ): Promise<RawCongressTrade[]> {
        if (symbol.toUpperCase() === 'EMPTYX') return [];
        const src = chamber === 'senate' ? SENATE_FIXTURE : HOUSE_FIXTURE;
        return src.slice(0, limit);
    }
}
