import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import {
    computeFinancialsScorecard,
    normalizeFinancialsSnapshot,
} from '@y0ngha/siglens-core';
import type {
    FinancialsScorecard,
    FinancialsSnapshot,
    StatementPeriod,
} from '@y0ngha/siglens-core';

const ANNUAL_LIMIT = 5;
const QUARTER_LIMIT = 8;

/**
 * per-symbol Next data cache 태그 — `revalidateTag('financials:AAPL')`로
 * 그룹 무효화가 가능하다. staticSymbolCache의 `symbol:${symbol}` 태그와 함께
 * 두 수준의 무효화(심볼 전체 / 재무 그룹)를 지원한다.
 */
const tag = (s: string): string[] => [`financials:${s.toUpperCase()}`];

/**
 * 6종 재무제표(income·balance·cashflow + 3×growth)를 병렬로 fetch해
 * core의 `normalizeFinancialsSnapshot`으로 정규화한 `FinancialsSnapshot`을 반환한다.
 *
 * 각 fetch는 `staticSymbolCache`로 Next data cache에 저장된다(ISR revalidate=1h,
 * `symbol:${SYMBOL}` + `financials:${SYMBOL}` 태그). CachedFinancialStatementsProvider가
 * Redis cross-request dedup을 담당하므로 이 파일에서 중복 캐싱 레이어를 추가하지 않는다.
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

/**
 * `/[symbol]/financials` 페이지가 필요로 하는 데이터를 한 번의 호출로 반환한다.
 * `snapshot`(정규화된 재무제표)과 `scorecard`(5개 축 등급 + composite)를 포함한다.
 */
export async function getFinancialsPageData(symbol: string): Promise<{
    snapshot: FinancialsSnapshot;
    scorecard: FinancialsScorecard;
}> {
    const snapshot = await getFinancialsSnapshot(symbol);
    return { snapshot, scorecard: computeFinancialsScorecard(snapshot) };
}

/** 분기 데이터를 요청할 때 사용하는 기본 limit (8분기 ≈ 2년). */
export const QUARTER_STATEMENT_LIMIT = QUARTER_LIMIT;
