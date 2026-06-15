import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { normalizeFinancialsSnapshot } from '@y0ngha/siglens-core';
import type { FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';

const ANNUAL_LIMIT = 5;

/**
 * per-symbol Next data cache 태그 — `revalidateTag('financials:AAPL')`로
 * 그룹 무효화가 가능하다. staticSymbolCache의 `symbol:${symbol}` 태그와 함께
 * 두 수준의 무효화(심볼 전체 / 재무 그룹)를 지원한다.
 *
 * `app/[symbol]/financials/financialData.ts`의 동일 구현과 태그 네임스페이스를
 * 공유해 같은 Next data cache 엔트리를 재사용한다.
 */
const tag = (s: string): string[] => [`financials:${s.toUpperCase()}`];

/**
 * 6종 재무제표(income·balance·cashflow + 3×growth)를 병렬로 fetch해
 * core의 `normalizeFinancialsSnapshot`으로 정규화한 `FinancialsSnapshot`을 반환한다.
 *
 * entities 레이어에서 사용 가능한 버전 — app 레이어 의존 없이 shared 레이어만 사용한다.
 * `app/[symbol]/financials/financialData.ts`와 동일한 캐시 키를 사용하므로
 * Next data cache를 공유한다.
 */
export async function getFinancialsSnapshot(
    symbol: string,
    period: StatementPeriod = 'annual',
    limit = ANNUAL_LIMIT
): Promise<FinancialsSnapshot> {
    const p = getFinancialStatementsProvider();
    const extraTags = tag(symbol);

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
            () => p.getIncomeStatements(symbol, period, limit),
            extraTags
        ),
        staticSymbolCache(
            ['financials:balance', symbol, period],
            symbol,
            () => p.getBalanceSheets(symbol, period, limit),
            extraTags
        ),
        staticSymbolCache(
            ['financials:cashflow', symbol, period],
            symbol,
            () => p.getCashFlowStatements(symbol, period, limit),
            extraTags
        ),
        staticSymbolCache(
            ['financials:income-growth', symbol, period],
            symbol,
            () => p.getIncomeStatementGrowths(symbol, period, limit),
            extraTags
        ),
        staticSymbolCache(
            ['financials:financial-growth', symbol, period],
            symbol,
            () => p.getFinancialGrowths(symbol, period, limit),
            extraTags
        ),
        staticSymbolCache(
            ['financials:cashflow-growth', symbol, period],
            symbol,
            () => p.getCashFlowGrowths(symbol, period, limit),
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
