import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { normalizeFinancialsSnapshot } from '@y0ngha/siglens-core';
import type { FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';

/** annual 데이터 기본 limit (5년). */
export const ANNUAL_LIMIT = 5;

/** quarter 데이터 기본 limit (8분기 ≈ 2년). */
export const QUARTER_LIMIT = 8;

/**
 * per-symbol Next data cache 태그 — `revalidateTag('financials:AAPL')`로
 * 그룹 무효화가 가능하다. staticSymbolCache의 `symbol:${symbol}` 태그와 함께
 * 두 수준의 무효화(심볼 전체 / 재무 그룹)를 지원한다.
 *
 * 이 entity lib이 6-fetch+normalize의 단일 source다. app 레이어의
 * `app/[symbol]/financials/financialData.ts`와 quarter Server Action
 * (`getFinancialsQuarterAction`)이 모두 이 함수에 위임하므로 cache key·tag가
 * 한 곳에서만 정의되어 Next data cache 엔트리를 공유한다.
 */
const tag = (s: string): string[] => [`financials:${s.toUpperCase()}`];

/**
 * 6종 재무제표(income·balance·cashflow + 3×growth)를 병렬로 fetch해
 * core의 `normalizeFinancialsSnapshot`으로 정규화한 `FinancialsSnapshot`을 반환한다.
 *
 * 6-fetch+normalize의 단일 구현(single source) — app 레이어와 quarter Server
 * Action이 이 함수에 위임한다. cache key 형태(`['financials:income', symbol, period]`
 * 등)와 tag(`financials:${SYMBOL}`)가 여기서만 정의되므로 호출 경로와 무관하게
 * 동일한 Next data cache 엔트리를 재사용한다.
 *
 * 각 fetch는 `staticSymbolCache`로 Next data cache에 저장된다(ISR revalidate=1h,
 * `symbol:${SYMBOL}` + `financials:${SYMBOL}` 태그). CachedFinancialStatementsProvider가
 * Redis cross-request dedup을 담당하므로 이 파일에서 중복 캐싱 레이어를 추가하지 않는다.
 *
 * provider가 빈 배열을 반환하면(데이터 없는 심볼 / FMP throw swallow) 정규화된
 * snapshot의 각 섹션도 빈 배열이 된다 — 호출 측에서 all-empty 여부로 실패를 판정한다.
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
