import type {
    EarningsReport,
    FundamentalAnalystEstimateInput,
    FundamentalCashFlowInput,
    FundamentalDataProvider,
    FundamentalFinancialScoresInput,
    FundamentalGradesConsensusInput,
    FundamentalGrowthInput,
    FundamentalPeerInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
    FundamentalProfile,
    FundamentalRatiosInput,
    FundamentalSectorHistoricalInput,
    FundamentalSectorPerformanceInput,
    FundamentalValuationMetrics,
    GradesEvent,
} from '@y0ngha/siglens-core';
import type { FmpEarningsReportItem } from './fundamentalClient';

/**
 * E2E-only `FundamentalDataProvider` returning deterministic, non-throwing
 * fixture data instead of calling FMP. Reached only when E2E_TEST=1 (see
 * getFundamentalDataProvider). Reads NO env keys and performs NO network I/O.
 *
 * The shape is intentionally minimal: a small valid `getProfile` so the
 * fundamental/news page headings + profile card render, plus `null`/`[]` for
 * the remaining methods (the port permits both). It also implements the two
 * siglens-specific extras (`getGrades`, `getEarningsReports`) that some
 * injection points call directly on the concrete `FmpFundamentalClient`.
 */
export class FakeFundamentalDataProvider implements FundamentalDataProvider {
    async getProfile(symbol: string): Promise<FundamentalProfile | null> {
        return {
            symbol: symbol.toUpperCase(),
            companyName: `${symbol} Test Corp`,
            sector: 'Technology',
            industry: 'Consumer Electronics',
            marketCap: 3_000_000_000_000,
            ceo: 'Jane Doe',
            website: 'https://example.com',
            description: `${symbol} is a deterministic E2E fixture company.`,
        };
    }

    async getKeyMetricsTtm(
        _symbol: string
    ): Promise<FundamentalValuationMetrics | null> {
        return null;
    }

    async getRatiosTtm(
        _symbol: string
    ): Promise<FundamentalRatiosInput | null> {
        return null;
    }

    async getCashFlowStatement(
        _symbol: string
    ): Promise<FundamentalCashFlowInput | null> {
        return null;
    }

    async getIncomeStatementGrowth(
        _symbol: string
    ): Promise<FundamentalGrowthInput | null> {
        return null;
    }

    async getFinancialScores(
        _symbol: string
    ): Promise<FundamentalFinancialScoresInput | null> {
        return null;
    }

    async getStockPeers(_symbol: string): Promise<FundamentalPeerInput[]> {
        return [];
    }

    async getAnalystEstimates(
        _symbol: string
    ): Promise<FundamentalAnalystEstimateInput | null> {
        return null;
    }

    async getGrades(_symbol: string): Promise<GradesEvent[]> {
        return [];
    }

    async getGradesConsensus(
        _symbol: string
    ): Promise<FundamentalGradesConsensusInput | null> {
        return null;
    }

    async getPriceTargetConsensus(
        _symbol: string
    ): Promise<FundamentalPriceTargetConsensusInput | null> {
        return null;
    }

    async getPriceTargetSummary(
        _symbol: string
    ): Promise<FundamentalPriceTargetSummaryInput | null> {
        return null;
    }

    async getSectorPerformanceSnapshot(
        _date: string
    ): Promise<FundamentalSectorPerformanceInput[]> {
        return [];
    }

    async getHistoricalSectorPerformance(
        _sector: string
    ): Promise<FundamentalSectorHistoricalInput[]> {
        return [];
    }

    async getEarningsReport(_symbol: string): Promise<EarningsReport | null> {
        return null;
    }

    /**
     * Siglens-specific extra (not on the core port) — some injection points
     * (newsData.ts, earnings-report의 api.ts getNextEarningsReport) call it on the concrete client.
     * Returning an empty list keeps the earnings-report DB upsert a no-op.
     */
    async getEarningsReports(
        _symbol: string,
        _limit?: number
    ): Promise<FmpEarningsReportItem[]> {
        return [];
    }
}
