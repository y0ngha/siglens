import { cache } from 'react';
import { normalizeFinancialsSnapshot } from '@y0ngha/siglens-core';
import type { FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { cacheNonEmpty } from '@/shared/cache/cacheNonEmpty';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { ANNUAL_LIMIT } from '../lib/financialsSnapshot';

/**
 * per-symbol Next data cache 태그 — `revalidateTag('financials:AAPL')`로
 * 그룹 무효화가 가능하다. staticSymbolCache의 `symbol:${symbol}` 태그와 함께
 * 두 수준의 무효화(심볼 전체 / 재무 그룹)를 지원한다.
 */
const financialsTag = (symbol: string): string[] => [
    `financials:${symbol.toUpperCase()}`,
];

/**
 * 6종 재무제표(income·balance·cashflow + 3×growth)를 병렬로 fetch해
 * core의 `normalizeFinancialsSnapshot`으로 정규화한 `FinancialsSnapshot`을 반환한다.
 *
 * 소비자: app의 `/[symbol]/financials` 데이터 로더, quarter Server Action
 * (`getFinancialsQuarterAction`), analysis entity의 종합 분석. 6-fetch+normalize의
 * 단일 구현이라 cache key(`['financials:income', symbol, period]` 등)와 tag
 * (`financials:${SYMBOL}`)가 여기서만 정의되고, 호출 경로와 무관하게 같은 Next data
 * cache 엔트리를 재사용한다. 서버 전용(I/O) 모듈이다.
 *
 * 각 fetch는 `cacheNonEmpty`로 Next data cache에 저장된다(24h revalidate,
 * `symbol:${SYMBOL}` + `financials:${SYMBOL}` 태그). 빈 결과는 캐싱하지 않아 FMP
 * 일시 장애가 캐시를 오염시키지 않는다.
 *
 * **React.cache로 감싸 per-request 메모이즈**한다(같은 인자 → 1회 실행). 한 요청에서
 * `generateMetadata`와 페이지 렌더가 둘 다 호출해도 두 번째는 즉시 반환된다 — 특히
 * 빈 스냅샷 경로(`cacheNonEmpty`가 Next data cache를 우회)에서도 6개 FMP 엔드포인트
 * × 2회 호출이 Redis 1회 조회로 줄어든다(빈 경로의 cross-request dedup은
 * CachedFinancialStatementsProvider의 Redis 계층이 담당).
 *
 * provider가 빈 배열을 반환하면(데이터 없는 심볼 / FMP throw swallow) 정규화된
 * snapshot의 각 섹션도 빈 배열이 된다 — 호출 측에서 `isEmptyFinancialsSnapshot`로
 * 실패를 판정한다.
 */
export const getFinancialsSnapshot = cache(
    async (
        symbol: string,
        period: StatementPeriod = 'annual',
        limit = ANNUAL_LIMIT
    ): Promise<FinancialsSnapshot> => {
        const provider = getFinancialStatementsProvider(symbol);
        const extraTags = financialsTag(symbol);
        function cached<T>(
            keyPrefix: string,
            fetcher: () => Promise<T[]>
        ): Promise<T[]> {
            return cacheNonEmpty(
                [keyPrefix, symbol, period],
                symbol,
                fetcher,
                extraTags,
                SECONDS_PER_DAY
            );
        }

        const [
            income,
            balance,
            cashFlow,
            incomeGrowth,
            financialGrowth,
            cashFlowGrowth,
        ] = await Promise.all([
            cached('financials:income', () =>
                provider.getIncomeStatements(symbol, period, limit)
            ),
            cached('financials:balance', () =>
                provider.getBalanceSheets(symbol, period, limit)
            ),
            cached('financials:cashflow', () =>
                provider.getCashFlowStatements(symbol, period, limit)
            ),
            cached('financials:income-growth', () =>
                provider.getIncomeStatementGrowths(symbol, period, limit)
            ),
            cached('financials:financial-growth', () =>
                provider.getFinancialGrowths(symbol, period, limit)
            ),
            cached('financials:cashflow-growth', () =>
                provider.getCashFlowGrowths(symbol, period, limit)
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
);
