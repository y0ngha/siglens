/**
 * Delegation wiring tests for fundamentalData.ts.
 *
 * Purpose: assert that each thin-delegation export calls the CORRECT provider
 * method with the symbol passed through, and that NO OTHER provider method is
 * called (catches mis-wiring such as getProfile accidentally calling
 * getKeyMetricsTtm).
 *
 * The module obtains its provider at import time via a top-level const:
 *   const fundamentalClient = getFundamentalDataProvider();
 *
 * `vi.mock` is hoisted by Vitest so the factory runs before the module-level
 * `getFundamentalDataProvider()` call, ensuring the mock is in place from the
 * first import. A stable mock object is shared via `vi.hoisted` so both the
 * factory and the test body reference the same vi.fn() instances.
 *
 * `getProfileDescriptionKo` is intentionally excluded — it has DB + translation
 * logic that is orthogonal to provider delegation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Stable mock provider — created before any module-level code runs (hoisted).
// ---------------------------------------------------------------------------
const mockProvider = vi.hoisted(() => ({
    getProfile: vi.fn(),
    getKeyMetricsTtm: vi.fn(),
    getStockPeers: vi.fn(),
    getRatiosTtm: vi.fn(),
    getIncomeStatementGrowth: vi.fn(),
    getFinancialScores: vi.fn(),
    getCashFlowStatement: vi.fn(),
    getAnalystEstimates: vi.fn(),
    getGradesConsensus: vi.fn(),
    getPriceTargetConsensus: vi.fn(),
    getPriceTargetSummary: vi.fn(),
    // extras required by FundamentalProvider interface
    getGrades: vi.fn(),
    getEarningsReports: vi.fn(),
    getEarningsReport: vi.fn(),
    getSectorPerformanceSnapshot: vi.fn(),
    getHistoricalSectorPerformance: vi.fn(),
}));

// Hoist the mock before the fundamentalData module runs its top-level import.
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: () => mockProvider,
}));

// React.cache is a no-op in test environments — unwrap it so the delegating
// functions are callable without RSC context.
vi.mock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return {
        ...actual,
        cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
    };
});

// DB / entity mocks — required so the module parses, but these paths are not
// exercised in this test file (getProfileDescriptionKo is excluded).
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));
vi.mock('@/entities/ticker', () => ({
    DrizzleProfileDescriptionTranslationRepository: vi.fn(),
    translateCompanyDescription: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are in place.
// ---------------------------------------------------------------------------
import {
    getProfile,
    getKeyMetricsTtm,
    getStockPeers,
    getRatiosTtm,
    getIncomeStatementGrowth,
    getFinancialScores,
    getCashFlowStatement,
    getAnalystEstimates,
    getGradesConsensus,
    getPriceTargetConsensus,
    getPriceTargetSummary,
} from '@/app/[symbol]/fundamental/fundamentalData';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All provider methods tracked in mockProvider. */
const allMethods = Object.keys(mockProvider) as (keyof typeof mockProvider)[];

/**
 * Assert that exactly one provider method was called (with the given symbol),
 * and that every other provider method remained un-called.
 */
function assertOnlyMethodCalled(
    calledMethod: keyof typeof mockProvider,
    symbol: string
): void {
    expect(mockProvider[calledMethod]).toHaveBeenCalledWith(symbol);
    for (const m of allMethods) {
        if (m === calledMethod) continue;
        expect(mockProvider[m]).not.toHaveBeenCalled();
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fundamentalData delegation wiring', () => {
    beforeEach(() => {
        // Reset all mocks before each test so call counts don't leak between cases.
        for (const m of allMethods) {
            mockProvider[m].mockReset();
            // Default return values — prevents unhandled promise rejections in
            // the rare case a method returns before the assertion runs.
            (mockProvider[m] as ReturnType<typeof vi.fn>).mockResolvedValue(
                null
            );
        }
    });

    it('getProfile delegates to provider.getProfile only', async () => {
        mockProvider.getProfile.mockResolvedValue({ symbol: 'AAPL' });
        const result = await getProfile('AAPL');
        expect(result).toEqual({ symbol: 'AAPL' });
        assertOnlyMethodCalled('getProfile', 'AAPL');
    });

    it('getKeyMetricsTtm delegates to provider.getKeyMetricsTtm only', async () => {
        const metrics = { peRatioTTM: 25, priceToSalesRatioTTM: 7 };
        mockProvider.getKeyMetricsTtm.mockResolvedValue(metrics);
        const result = await getKeyMetricsTtm('MSFT');
        expect(result).toEqual(metrics);
        assertOnlyMethodCalled('getKeyMetricsTtm', 'MSFT');
    });

    it('getStockPeers delegates to provider.getStockPeers only', async () => {
        const peers = [
            { symbol: 'GOOG', companyName: 'Alphabet', marketCap: 2_000_000 },
        ];
        mockProvider.getStockPeers.mockResolvedValue(peers);
        const result = await getStockPeers('AAPL');
        expect(result).toEqual(peers);
        assertOnlyMethodCalled('getStockPeers', 'AAPL');
    });

    it('getRatiosTtm delegates to provider.getRatiosTtm only', async () => {
        const ratios = { returnOnEquityTTM: 0.4, netProfitMarginTTM: 0.2 };
        mockProvider.getRatiosTtm.mockResolvedValue(ratios);
        const result = await getRatiosTtm('NVDA');
        expect(result).toEqual(ratios);
        assertOnlyMethodCalled('getRatiosTtm', 'NVDA');
    });

    it('getIncomeStatementGrowth delegates to provider.getIncomeStatementGrowth only', async () => {
        const growth = { growthRevenue: 0.12, growthEPS: 0.08 };
        mockProvider.getIncomeStatementGrowth.mockResolvedValue(growth);
        const result = await getIncomeStatementGrowth('TSLA');
        expect(result).toEqual(growth);
        assertOnlyMethodCalled('getIncomeStatementGrowth', 'TSLA');
    });

    it('getFinancialScores delegates to provider.getFinancialScores only', async () => {
        const scores = { altmanZScore: 3.1, piotroskiScore: 7 };
        mockProvider.getFinancialScores.mockResolvedValue(scores);
        const result = await getFinancialScores('AMZN');
        expect(result).toEqual(scores);
        assertOnlyMethodCalled('getFinancialScores', 'AMZN');
    });

    it('getCashFlowStatement delegates to provider.getCashFlowStatement only', async () => {
        const cf = { operatingCashFlow: 100_000_000 };
        mockProvider.getCashFlowStatement.mockResolvedValue(cf);
        const result = await getCashFlowStatement('META');
        expect(result).toEqual(cf);
        assertOnlyMethodCalled('getCashFlowStatement', 'META');
    });

    it('getAnalystEstimates delegates to provider.getAnalystEstimates only', async () => {
        const estimates = {
            estimatedEpsAvg: 5.2,
            estimatedRevenueAvg: 90_000_000_000,
        };
        mockProvider.getAnalystEstimates.mockResolvedValue(estimates);
        const result = await getAnalystEstimates('AAPL');
        expect(result).toEqual(estimates);
        assertOnlyMethodCalled('getAnalystEstimates', 'AAPL');
    });

    it('getGradesConsensus delegates to provider.getGradesConsensus only', async () => {
        const consensus = {
            strongBuy: 10,
            buy: 15,
            hold: 5,
            sell: 1,
            strongSell: 0,
        };
        mockProvider.getGradesConsensus.mockResolvedValue(consensus);
        const result = await getGradesConsensus('AAPL');
        expect(result).toEqual(consensus);
        assertOnlyMethodCalled('getGradesConsensus', 'AAPL');
    });

    it('getPriceTargetConsensus delegates to provider.getPriceTargetConsensus only', async () => {
        const pt = {
            targetHigh: 250,
            targetLow: 180,
            targetMedian: 215,
            targetConsensus: 210,
        };
        mockProvider.getPriceTargetConsensus.mockResolvedValue(pt);
        const result = await getPriceTargetConsensus('AAPL');
        expect(result).toEqual(pt);
        assertOnlyMethodCalled('getPriceTargetConsensus', 'AAPL');
    });

    it('getPriceTargetSummary delegates to provider.getPriceTargetSummary only', async () => {
        const summary = {
            lastMonth: { avgPriceTarget: 205 },
            lastQuarter: { avgPriceTarget: 200 },
            lastYear: { avgPriceTarget: 195 },
        };
        mockProvider.getPriceTargetSummary.mockResolvedValue(summary);
        const result = await getPriceTargetSummary('AAPL');
        expect(result).toEqual(summary);
        assertOnlyMethodCalled('getPriceTargetSummary', 'AAPL');
    });
});
