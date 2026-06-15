'use server';

import type { FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';
import { normalizeFinancialsSnapshot } from '@y0ngha/siglens-core';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';

const QUARTER_LIMIT = 8;

/**
 * Server Action — lazily fetches the quarter-period financial snapshot on
 * demand. Called by `useFinancialsPeriod` when the user switches to the
 * quarterly view.
 *
 * Mirrors `getFinancialsSnapshot` from `app/[symbol]/financials/financialData.ts`
 * but lives in the `entities` layer so that the `widgets` layer can import it
 * without violating the FSD dependency rule (widgets → app is forbidden).
 */
export async function getFinancialsQuarterAction(
    symbol: string
): Promise<FinancialsSnapshot> {
    const p = getFinancialStatementsProvider();
    const period: StatementPeriod = 'quarter';
    const extraTags = [`financials:${symbol.toUpperCase()}`];

    const [
        income,
        balance,
        cashFlow,
        incomeGrowth,
        financialGrowth,
        cashFlowGrowth,
    ] = await Promise.all([
        staticSymbolCache(
            ['financials:income', symbol, period],
            symbol,
            () => p.getIncomeStatements(symbol, period, QUARTER_LIMIT),
            extraTags
        ),
        staticSymbolCache(
            ['financials:balance', symbol, period],
            symbol,
            () => p.getBalanceSheets(symbol, period, QUARTER_LIMIT),
            extraTags
        ),
        staticSymbolCache(
            ['financials:cashflow', symbol, period],
            symbol,
            () => p.getCashFlowStatements(symbol, period, QUARTER_LIMIT),
            extraTags
        ),
        staticSymbolCache(
            ['financials:income-growth', symbol, period],
            symbol,
            () => p.getIncomeStatementGrowths(symbol, period, QUARTER_LIMIT),
            extraTags
        ),
        staticSymbolCache(
            ['financials:financial-growth', symbol, period],
            symbol,
            () => p.getFinancialGrowths(symbol, period, QUARTER_LIMIT),
            extraTags
        ),
        staticSymbolCache(
            ['financials:cashflow-growth', symbol, period],
            symbol,
            () => p.getCashFlowGrowths(symbol, period, QUARTER_LIMIT),
            extraTags
        ),
    ]);

    return normalizeFinancialsSnapshot({
        income,
        balance,
        cashFlow,
        incomeGrowth,
        financialGrowth,
        cashFlowGrowth,
    });
}
