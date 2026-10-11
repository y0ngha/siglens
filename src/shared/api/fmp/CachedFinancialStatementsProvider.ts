import 'server-only';
import { cache } from 'react';
import { sym } from './symKey';
import { cachedListWithLimit } from './cachedListWithLimit';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { FMP_STATEMENTS_CACHE_TTL_SECONDS } from '@/shared/config/time';
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

const TTL = FMP_STATEMENTS_CACHE_TTL_SECONDS;

/**
 * Cold-cache fetch는 항상 이 고정 상한으로 inner를 호출하고 전체 배열을 캐싱한다.
 * 호출자의 `limit`은 캐시된 배열을 읽을 때 `.slice(0, limit)`로 적용한다.
 *
 * 이렇게 하지 않고 호출자의 `limit`을 그대로 inner에 넘기면, 키에 `limit`이 없으므로
 * cold `limit=2` 호출이 2행만 캐싱하고 이후 `limit=10` 호출이 그 2행만 받는 truncation
 * 버그가 생긴다. `limit`을 키에 포함하는 대안은 같은 심볼+기간에 대해 캐시 엔트리가
 * limit별로 쪼개져(캐시 키 폭증) FMP 호출 절감 효과가 떨어진다. 최대치를 한 번 fetch해
 * 단일 엔트리에 캐싱하고 읽을 때 slice하는 쪽이 키 스킴(`:<SYM>:<period>`)을 유지하면서
 * 모든 limit을 만족시킨다.
 *
 * 40은 분기 데이터 ~10년(40분기) 또는 연간 데이터 40년을 커버한다 — UI가 표시하는
 * 5~10행보다 충분히 크고, FMP가 무료 플랜에서 돌려주는 행 수 상한과도 정합적이다.
 */
const MAX_STATEMENT_LIMIT = 40;

const cashFlowKey = (symbol: string, period: StatementPeriod): string =>
    `financials:cashflow:${sym(symbol)}:${period}`;

const incomeGrowthKey = (symbol: string, period: StatementPeriod): string =>
    `financials:income-growth:${sym(symbol)}:${period}`;

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
 * `limit`은 캐시 키에 포함하지 않는다 — 대신 항상 `MAX_STATEMENT_LIMIT`로 fetch·캐싱하고
 * 호출자의 `limit`은 읽을 때 slice로 적용한다(상세는 `MAX_STATEMENT_LIMIT` JSDoc 참고).
 */
export class CachedFinancialStatementsProvider implements FinancialStatementsProvider {
    constructor(private readonly inner: FinancialStatementsProvider) {}

    getIncomeStatements = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<IncomeStatementRow[]> =>
            cachedListWithLimit(
                `financials:income:${sym(symbol)}:${period}`,
                TTL,
                limit,
                () =>
                    this.inner.getIncomeStatements(
                        symbol,
                        period,
                        MAX_STATEMENT_LIMIT
                    ),
                {
                    onError: 'empty',
                    logPrefix: '[CachedFinancials] income failed:',
                }
            )
    );

    getBalanceSheets = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<BalanceSheetRow[]> =>
            cachedListWithLimit(
                `financials:balance:${sym(symbol)}:${period}`,
                TTL,
                limit,
                () =>
                    this.inner.getBalanceSheets(
                        symbol,
                        period,
                        MAX_STATEMENT_LIMIT
                    ),
                {
                    onError: 'empty',
                    logPrefix: '[CachedFinancials] balance failed:',
                }
            )
    );

    getCashFlowStatements = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<CashFlowRow[]> =>
            cachedListWithLimit(
                cashFlowKey(symbol, period),
                TTL,
                limit,
                () =>
                    this.inner.getCashFlowStatements(
                        symbol,
                        period,
                        MAX_STATEMENT_LIMIT
                    ),
                {
                    onError: 'empty',
                    logPrefix: '[CachedFinancials] cashflow failed:',
                }
            )
    );

    getIncomeStatementGrowths = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<IncomeGrowthRow[]> =>
            cachedListWithLimit(
                incomeGrowthKey(symbol, period),
                TTL,
                limit,
                () =>
                    this.inner.getIncomeStatementGrowths(
                        symbol,
                        period,
                        MAX_STATEMENT_LIMIT
                    ),
                {
                    onError: 'empty',
                    logPrefix: '[CachedFinancials] income-growth failed:',
                }
            )
    );

    getFinancialGrowths = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<FinancialGrowthRow[]> =>
            cachedListWithLimit(
                `financials:financial-growth:${sym(symbol)}:${period}`,
                TTL,
                limit,
                () =>
                    this.inner.getFinancialGrowths(
                        symbol,
                        period,
                        MAX_STATEMENT_LIMIT
                    ),
                {
                    onError: 'empty',
                    logPrefix: '[CachedFinancials] financial-growth failed:',
                }
            )
    );

    getCashFlowGrowths = cache(
        (
            symbol: string,
            period: StatementPeriod,
            limit: number
        ): Promise<CashFlowGrowthRow[]> =>
            cachedListWithLimit(
                `financials:cashflow-growth:${sym(symbol)}:${period}`,
                TTL,
                limit,
                () =>
                    this.inner.getCashFlowGrowths(
                        symbol,
                        period,
                        MAX_STATEMENT_LIMIT
                    ),
                {
                    onError: 'empty',
                    logPrefix: '[CachedFinancials] cashflow-growth failed:',
                }
            )
    );

    /**
     * 최신 연간 현금흐름표 한 행. 펀더멘털 탭(`CachedFundamentalProvider.getCashFlowStatement`)이
     * 쓴다 — 그 탭은 따로 `cash-flow-statement`를 받아 `fundamental:cash-flow` 키에 두었는데,
     * 그건 이 클래스가 `financials:cashflow:<SYM>:annual`에 이미 둔 응답의 첫 행과 같은
     * 데이터라 FMP 호출만 종목당 하루 한 번 더 났다. 그래서 같은 키를 같은 fetcher로 읽는다.
     *
     * 목록 메서드와 달리 **FMP 장애를 삼키지 않고 throw한다.** 펀더멘털 탭은 throw를 받아야
     * `staticSymbolCache`가 결과를 굽지 않고 ISR 주기를 줄인다(`degradeSection`). 빈 배열로
     * 바꾸면 장애가 "데이터 없음"으로 하루 동안 굳는다.
     */
    getLatestAnnualCashFlow = cache(
        async (symbol: string): Promise<CashFlowRow | null> => {
            const rows = await getOrSetCache(
                cashFlowKey(symbol, 'annual'),
                TTL,
                () =>
                    this.inner.getCashFlowStatements(
                        symbol,
                        'annual',
                        MAX_STATEMENT_LIMIT
                    )
            );
            return rows[0] ?? null;
        }
    );

    /**
     * 최신 연간 손익 성장률 한 행. {@link getLatestAnnualCashFlow}와 같은 이유로
     * `financials:income-growth:<SYM>:annual` 키를 공유하고, FMP 장애는 throw한다.
     */
    getLatestAnnualIncomeGrowth = cache(
        async (symbol: string): Promise<IncomeGrowthRow | null> => {
            const rows = await getOrSetCache(
                incomeGrowthKey(symbol, 'annual'),
                TTL,
                () =>
                    this.inner.getIncomeStatementGrowths(
                        symbol,
                        'annual',
                        MAX_STATEMENT_LIMIT
                    )
            );
            return rows[0] ?? null;
        }
    );
}
