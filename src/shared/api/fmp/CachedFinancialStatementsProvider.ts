import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
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

const TTL = FMP_STATEMENTS_REVALIDATE_SECONDS;
const sym = (s: string): string => s.toUpperCase();

/**
 * `FinancialStatementsProvider`를 감싸 메서드별 Redis 캐싱을 주입하는 데코레이터.
 *
 * 재무제표(income/balance/cashflow) 및 성장률 시계열은 분기(~45일) 단위로 갱신되므로
 * 24 h TTL로 FMP 호출 빈도를 억제한다. 각 메서드는 `React.cache`로 RSC 요청 스코프
 * dedup + `getOrSetCache`로 cross-request Redis 캐싱을 적용한다.
 *
 * inner throw(FMP 장애)는 빈 배열 `[]`로 graceful fallback해 페이지 렌더를 막지 않는다.
 * 장애 결과는 캐싱되지 않는다(`getOrSetCache`는 fetcher가 throw하면 set을 건너뜀) —
 * 이후 요청에서 재시도할 수 있다.
 *
 * 키 스킴: `financials:<type>:<SYM>:<period>` — 예) `financials:income:AAPL:annual`.
 * symbol은 항상 대문자로 정규화해 대소문자 차이로 캐시가 분리되는 것을 막는다.
 */
export class CachedFinancialStatementsProvider implements FinancialStatementsProvider {
    constructor(private readonly inner: FinancialStatementsProvider) {}

    getIncomeStatements = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<IncomeStatementRow[]> =>
            getOrSetCache(
                `financials:income:${sym(symbol)}:${period}`,
                TTL,
                () => this.inner.getIncomeStatements(symbol, period, limit)
            ).catch(error => {
                console.error('[CachedFinancials] income failed:', error);
                return [];
            })
    );

    getBalanceSheets = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<BalanceSheetRow[]> =>
            getOrSetCache(
                `financials:balance:${sym(symbol)}:${period}`,
                TTL,
                () => this.inner.getBalanceSheets(symbol, period, limit)
            ).catch(error => {
                console.error('[CachedFinancials] balance failed:', error);
                return [];
            })
    );

    getCashFlowStatements = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<CashFlowRow[]> =>
            getOrSetCache(
                `financials:cashflow:${sym(symbol)}:${period}`,
                TTL,
                () => this.inner.getCashFlowStatements(symbol, period, limit)
            ).catch(error => {
                console.error('[CachedFinancials] cashflow failed:', error);
                return [];
            })
    );

    getIncomeStatementGrowths = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<IncomeGrowthRow[]> =>
            getOrSetCache(
                `financials:income-growth:${sym(symbol)}:${period}`,
                TTL,
                () =>
                    this.inner.getIncomeStatementGrowths(symbol, period, limit)
            ).catch(error => {
                console.error(
                    '[CachedFinancials] income-growth failed:',
                    error
                );
                return [];
            })
    );

    getFinancialGrowths = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<FinancialGrowthRow[]> =>
            getOrSetCache(
                `financials:financial-growth:${sym(symbol)}:${period}`,
                TTL,
                () => this.inner.getFinancialGrowths(symbol, period, limit)
            ).catch(error => {
                console.error(
                    '[CachedFinancials] financial-growth failed:',
                    error
                );
                return [];
            })
    );

    getCashFlowGrowths = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<CashFlowGrowthRow[]> =>
            getOrSetCache(
                `financials:cashflow-growth:${sym(symbol)}:${period}`,
                TTL,
                () => this.inner.getCashFlowGrowths(symbol, period, limit)
            ).catch(error => {
                console.error(
                    '[CachedFinancials] cashflow-growth failed:',
                    error
                );
                return [];
            })
    );
}
