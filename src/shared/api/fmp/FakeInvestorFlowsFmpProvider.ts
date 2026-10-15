import type {
    InvestorFlowsFmpProvider,
    RawBeneficialOwnership,
    RawInsiderStatistic,
    RawInsiderTrade,
    RawSharesFloat,
} from './investorFlowsProvider.types';

/**
 * E2E-only `InvestorFlowsFmpProvider`: deterministic, non-throwing fixtures instead of FMP.
 * Reached only when E2E_TEST=1 (see `getInvestorFlowsFmpProvider`). Reads NO env keys and does NO
 * network I/O. `EMPTYX` returns empty data so E2E can test the empty-state UI.
 */

const INSIDER_FIXTURE: RawInsiderTrade[] = [
    {
        symbol: 'AAPL',
        filingDate: '2026-10-08',
        transactionDate: '2026-10-06',
        reportingCik: '0001780525',
        transactionType: 'S-Sale',
        securitiesOwned: 39593,
        reportingName: 'Fixture Officer',
        typeOfOwner: 'officer: SVP, GC',
        acquisitionOrDisposition: 'D',
        formType: '4',
        securitiesTransacted: 2399,
        price: 332.01,
        securityName: 'Common Stock',
        url: 'https://www.sec.gov/Archives/edgar/data/320193/000114036126039158/0001140361-26-039158-index.htm',
    },
    {
        symbol: 'AAPL',
        filingDate: '2026-09-20',
        transactionDate: '2026-09-18',
        reportingCik: '0001214156',
        transactionType: 'P-Purchase',
        securitiesOwned: 3455921,
        reportingName: 'Fixture Director',
        typeOfOwner: 'director',
        acquisitionOrDisposition: 'A',
        formType: '4',
        securitiesTransacted: 1000,
        price: 300,
        securityName: 'Common Stock',
        url: 'https://www.sec.gov/Archives/edgar/data/320193/000114036126038000/0001140361-26-038000-index.htm',
    },
];

const STATISTICS_FIXTURE: RawInsiderStatistic[] = [
    {
        symbol: 'AAPL',
        year: 2026,
        quarter: 4,
        acquiredTransactions: 5,
        disposedTransactions: 19,
        totalAcquired: 774053,
        totalDisposed: 1221010,
        totalPurchases: 1,
        totalSales: 11,
    },
];

const BENEFICIAL_FIXTURE: RawBeneficialOwnership[] = [
    {
        symbol: 'AAPL',
        cik: '0000320193',
        form: 'SCHEDULE 13G',
        filingDate: '2026-04-29',
        nameOfReportingPerson: 'Fixture Capital Management',
        amountBeneficiallyOwned: '1099168953',
        percentOfClass: '7.48',
        url: 'https://www.sec.gov/Archives/edgar/data/320193/000210011926000139/xslSCHEDULE_13G_X02/primary_doc.xml',
    },
];

const FLOAT_FIXTURE: RawSharesFloat = {
    symbol: 'AAPL',
    floatShares: 14576876685,
    outstandingShares: 14594180000,
};

const isEmpty = (symbol: string): boolean => symbol.toUpperCase() === 'EMPTYX';

export class FakeInvestorFlowsFmpProvider implements InvestorFlowsFmpProvider {
    async getInsiderTrades(symbol: string): Promise<RawInsiderTrade[]> {
        return isEmpty(symbol) ? [] : INSIDER_FIXTURE;
    }

    async getInsiderStatistics(symbol: string): Promise<RawInsiderStatistic[]> {
        return isEmpty(symbol) ? [] : STATISTICS_FIXTURE;
    }

    async getBeneficialOwnership(
        symbol: string,
        limit: number
    ): Promise<RawBeneficialOwnership[]> {
        return isEmpty(symbol) ? [] : BENEFICIAL_FIXTURE.slice(0, limit);
    }

    async getSharesFloat(symbol: string): Promise<RawSharesFloat | null> {
        return isEmpty(symbol) ? null : FLOAT_FIXTURE;
    }
}
