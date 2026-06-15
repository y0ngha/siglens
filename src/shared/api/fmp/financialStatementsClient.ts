import { fmpGet as fmpGetRaw } from './httpClient';
import { FMP_STATEMENTS_REVALIDATE_SECONDS } from '@/shared/config/time';
import type {
    BalanceSheetRow,
    CashFlowGrowthRow,
    CashFlowRow,
    FinancialGrowthRow,
    FinancialStatementsProvider,
    IncomeGrowthRow,
    IncomeStatementRow,
    StatementPeriod,
} from '@y0ngha/siglens-core';
import type {
    RawFmpBalanceSheet,
    RawFmpCashFlow,
    RawFmpCashFlowGrowth,
    RawFmpFinancialGrowth,
    RawFmpIncomeGrowth,
    RawFmpIncomeStatement,
} from './financialStatements.types';

/**
 * Thin fmpGet wrapper that injects the 24 h revalidate window shared by
 * both the Next Data Cache and the Redis TTL so the two cache layers'
 * freshness never diverges.
 */
function fmpGet<T>(
    path: string,
    query: Record<string, string> = {}
): Promise<T> {
    return fmpGetRaw<T>(path, query, {
        revalidate: FMP_STATEMENTS_REVALIDATE_SECONDS,
    });
}

/**
 * Coerce a raw FMP number to a finite number or null.
 * Matches the `toFiniteNumber` contract used throughout this adapter layer.
 */
const num = (v: number | undefined): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

/**
 * FMP adapter implementing core's `FinancialStatementsProvider` for the six
 * financial statement time-series endpoints.
 *
 * Mapping rules:
 * - All numeric fields are passed through `num()` — undefined/NaN/Infinity → null.
 * - Derived fields (grossMargin, operatingMargin, netMargin, currentRatio,
 *   fcfMargin) are left null; core's `normalizeFinancialsSnapshot` computes them.
 * - `epsgrowth` (FMP wire, lowercase) is mapped to `epsGrowth` (domain camelCase).
 */
export class FmpFinancialStatementsClient implements FinancialStatementsProvider {
    /**
     * Fetch income statements (revenue, profit, margins, EPS).
     * Margins are left null — core computes them during snapshot normalization.
     */
    async getIncomeStatements(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<IncomeStatementRow[]> {
        const arr = await fmpGet<RawFmpIncomeStatement[]>('income-statement', {
            symbol,
            period,
            limit: String(limit),
        });
        return arr.map(r => ({
            fiscalYear: r.fiscalYear ?? '',
            period: r.period ?? '',
            date: r.date ?? '',
            revenue: num(r.revenue),
            grossProfit: num(r.grossProfit),
            operatingIncome: num(r.operatingIncome),
            netIncome: num(r.netIncome),
            ebitda: num(r.ebitda),
            eps: num(r.eps),
            epsDiluted: num(r.epsDiluted),
            // Derived by core's normalizeFinancialsSnapshot — never set here.
            grossMargin: null,
            operatingMargin: null,
            netMargin: null,
        }));
    }

    /**
     * Fetch balance sheets (assets, liabilities, equity, net debt).
     * currentRatio is left null — core computes it during snapshot normalization.
     */
    async getBalanceSheets(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<BalanceSheetRow[]> {
        const arr = await fmpGet<RawFmpBalanceSheet[]>(
            'balance-sheet-statement',
            { symbol, period, limit: String(limit) }
        );
        return arr.map(r => ({
            fiscalYear: r.fiscalYear ?? '',
            period: r.period ?? '',
            date: r.date ?? '',
            totalAssets: num(r.totalAssets),
            totalCurrentAssets: num(r.totalCurrentAssets),
            totalLiabilities: num(r.totalLiabilities),
            totalCurrentLiabilities: num(r.totalCurrentLiabilities),
            cashAndShortTermInvestments: num(r.cashAndShortTermInvestments),
            totalDebt: num(r.totalDebt),
            netDebt: num(r.netDebt),
            totalStockholdersEquity: num(r.totalStockholdersEquity),
            // Derived by core — requires both current assets and liabilities.
            currentRatio: null,
        }));
    }

    /**
     * Fetch cash flow statements (operating cash flow, capex, free cash flow).
     * fcfMargin is left null — core computes it during snapshot normalization
     * using income.revenue for the same period.
     */
    async getCashFlowStatements(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<CashFlowRow[]> {
        const arr = await fmpGet<RawFmpCashFlow[]>('cash-flow-statement', {
            symbol,
            period,
            limit: String(limit),
        });
        return arr.map(r => ({
            fiscalYear: r.fiscalYear ?? '',
            period: r.period ?? '',
            date: r.date ?? '',
            operatingCashFlow: num(r.operatingCashFlow),
            capitalExpenditure: num(r.capitalExpenditure),
            freeCashFlow: num(r.freeCashFlow),
            dividendsPaid: num(r.dividendsPaid),
            // Derived by core — requires income.revenue cross-reference.
            fcfMargin: null,
        }));
    }

    /** Fetch income-statement growth (revenue, net income, EPS, operating income YoY). */
    async getIncomeStatementGrowths(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<IncomeGrowthRow[]> {
        const arr = await fmpGet<RawFmpIncomeGrowth[]>(
            'income-statement-growth',
            { symbol, period, limit: String(limit) }
        );
        return arr.map(r => ({
            fiscalYear: r.fiscalYear ?? '',
            period: r.period ?? '',
            growthRevenue: num(r.growthRevenue),
            growthNetIncome: num(r.growthNetIncome),
            growthEPS: num(r.growthEPS),
            growthOperatingIncome: num(r.growthOperatingIncome),
        }));
    }

    /**
     * Fetch the financial growth series (revenue/NI/EPS/FCF/debt growth plus
     * long-term per-share growth).
     *
     * **Field mapping note:** FMP returns `epsgrowth` (lowercase) on the wire;
     * this is mapped to the domain's `epsGrowth` (camelCase). All other field
     * names match exactly.
     */
    async getFinancialGrowths(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<FinancialGrowthRow[]> {
        const arr = await fmpGet<RawFmpFinancialGrowth[]>('financial-growth', {
            symbol,
            period,
            limit: String(limit),
        });
        return arr.map(r => ({
            fiscalYear: r.fiscalYear ?? '',
            period: r.period ?? '',
            revenueGrowth: num(r.revenueGrowth),
            netIncomeGrowth: num(r.netIncomeGrowth),
            // FMP wire: `epsgrowth` (all lowercase) → domain: `epsGrowth` (camelCase).
            epsGrowth: num(r.epsgrowth),
            freeCashFlowGrowth: num(r.freeCashFlowGrowth),
            operatingCashFlowGrowth: num(r.operatingCashFlowGrowth),
            assetGrowth: num(r.assetGrowth),
            debtGrowth: num(r.debtGrowth),
            threeYRevenueGrowthPerShare: num(r.threeYRevenueGrowthPerShare),
            fiveYRevenueGrowthPerShare: num(r.fiveYRevenueGrowthPerShare),
            tenYRevenueGrowthPerShare: num(r.tenYRevenueGrowthPerShare),
        }));
    }

    /** Fetch cash-flow growth (operating cash flow, free cash flow, capex YoY). */
    async getCashFlowGrowths(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<CashFlowGrowthRow[]> {
        const arr = await fmpGet<RawFmpCashFlowGrowth[]>(
            'cash-flow-statement-growth',
            { symbol, period, limit: String(limit) }
        );
        return arr.map(r => ({
            fiscalYear: r.fiscalYear ?? '',
            period: r.period ?? '',
            growthOperatingCashFlow: num(r.growthOperatingCashFlow),
            growthFreeCashFlow: num(r.growthFreeCashFlow),
            growthCapitalExpenditure: num(r.growthCapitalExpenditure),
        }));
    }
}
