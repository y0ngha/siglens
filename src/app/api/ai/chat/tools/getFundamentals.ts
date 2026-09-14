import 'server-only';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { getDescriptor } from '@/shared/config/marketProfile';
import { getNextEarningsReport } from '@/entities/earnings-report';
import { getDatabaseClient } from '@/shared/db/client';
import type { ToolExecutor } from './index';

function settledOrNull<T>(r: PromiseSettledResult<T>): T | null {
    return r.status === 'fulfilled' ? r.value : null;
}

/**
 * Compact valuation/profitability/growth/health/analyst snapshot for stocks
 * (US and Korean — crypto has no fundamental tab, gated the same way
 * `getOptionsSummaryTool` gates options). One `Promise.allSettled` fan-out so
 * a single failing FMP/yahoo endpoint only drops its own section instead of
 * the whole tool result.
 *
 * Dividend yield is not in the provider's exposed shapes
 * (`FundamentalValuationMetrics` carries no such field) — omitted rather
 * than guessed. Peers and the long-form profile description are omitted
 * too: the model-facing shape is numbers for valuation/health questions,
 * not the page's full content.
 *
 * `nextEarningsDate` goes through `getNextEarningsReport` — the same
 * DB-backed, 24h-staleness-gated loader the news/analysis paths already use
 * (`entities/earnings-report`) — rather than the provider's own
 * `getEarningsReport`, which is deliberately `no-store` at the FMP/yahoo
 * client (earnings-day real-time-ness matters there). Routing through it
 * here means this tool shares that cache instead of adding an uncached
 * FMP/yahoo call per turn.
 */
export const getFundamentalsTool: ToolExecutor = async args => {
    const symbol = String(args.symbol).toUpperCase();
    if (!(await isTabAllowedForSymbol(symbol, 'fundamental')))
        return { symbol, available: false, reason: 'tab_not_available' };

    const provider = getFundamentalDataProvider(symbol);
    const [
        profileR,
        keyMetricsR,
        ratiosR,
        growthR,
        scoresR,
        cashFlowR,
        gradesR,
        priceTargetR,
        estimatesR,
        earningsR,
    ] = await Promise.allSettled([
        provider.getProfile(symbol),
        provider.getKeyMetricsTtm(symbol),
        provider.getRatiosTtm(symbol),
        provider.getIncomeStatementGrowth(symbol),
        provider.getFinancialScores(symbol),
        provider.getCashFlowStatement(symbol),
        provider.getGradesConsensus(symbol),
        provider.getPriceTargetConsensus(symbol),
        provider.getAnalystEstimates(symbol),
        getNextEarningsReport(symbol, getDatabaseClient().db),
    ]);

    const profile = settledOrNull(profileR);
    if (!profile) return { symbol, available: false, reason: 'no_profile' };

    const marketProfile = await resolveMarketProfile(symbol);
    const currency = getDescriptor(marketProfile).priceFormat.currency;
    const keyMetrics = settledOrNull(keyMetricsR);
    const ratios = settledOrNull(ratiosR);
    const growth = settledOrNull(growthR);
    const scores = settledOrNull(scoresR);
    const cashFlow = settledOrNull(cashFlowR);
    const grades = settledOrNull(gradesR);
    const priceTarget = settledOrNull(priceTargetR);
    const estimates = settledOrNull(estimatesR);
    const earnings = settledOrNull(earningsR);

    return {
        asOf: new Date().toISOString(),
        source: 'fundamental data provider (cached)',
        symbol,
        available: true,
        profile: {
            name: profile.companyName,
            sector: profile.sector,
            industry: profile.industry,
            marketCap: profile.marketCap,
            currency,
        },
        valuation: keyMetrics && {
            pe: keyMetrics.peRatioTTM,
            pb: keyMetrics.pbRatioTTM,
            ps: keyMetrics.priceToSalesRatioTTM,
            evToEbitda: keyMetrics.enterpriseValueOverEBITDATTM,
        },
        profitability: ratios && {
            roe: ratios.returnOnEquityTTM,
            roa: ratios.returnOnAssetsTTM,
            operatingMargin: ratios.operatingProfitMarginTTM,
            netMargin: ratios.netProfitMarginTTM,
        },
        growth: growth && {
            revenueGrowth: growth.growthRevenue,
            epsGrowth: growth.growthEPS,
        },
        health: {
            altmanZScore: scores?.altmanZScore ?? null,
            piotroskiScore: scores?.piotroskiScore ?? null,
            debtRatio: ratios?.debtRatioTTM ?? null,
            currentRatio: ratios?.currentRatioTTM ?? null,
            operatingCashFlow: cashFlow?.operatingCashFlow ?? null,
        },
        analyst: {
            consensus: grades,
            priceTarget,
            nextQuarterEstimate: estimates,
            nextEarningsDate: earnings?.earningsDate ?? null,
        },
    };
};
