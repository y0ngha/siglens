import { cache } from 'react';
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
 * `cacheNonEmpty`가 빈 결과를 캐싱 우회용으로 throw할 때 쓰는 내부 sentinel.
 * 메시지 문자열 비교 대신 전용 클래스를 써서, 외부 라이브러리가 우연히 같은
 * 메시지로 throw해도 sentinel로 오인하지 않도록 `instanceof`로 분기한다.
 */
class EmptyResultError extends Error {}

/**
 * `staticSymbolCache`로 fetch를 정적화하되 **빈 배열 결과는 캐싱하지 않는다.**
 *
 * `CachedFinancialStatementsProvider`는 FMP 일시 장애(throw)를 swallow하고 `[]`를
 * *resolve*한다. 그 `[]`를 그대로 `unstable_cache`에 통과시키면 revalidate(1h)까지
 * 빈 데이터가 고정돼, FMP가 복구된 뒤에도 최대 1h 동안 all-empty 스냅샷을 서빙한다.
 * `unstable_cache`는 fetcher가 throw하면 set을 건너뛰므로, 빈 결과일 때 fetcher 안에서
 * throw해 캐싱을 막고 바깥에서 catch해 `[]`로 graceful degrade한다.
 *
 * 트레이드오프: 실제로 데이터가 없는 심볼(일부 ETF/Index)은 매 요청 재fetch하지만,
 * FMP가 빈 배열을 즉시 반환하므로 비용은 미미하다. 대신 일시 장애가 1h 캐시를
 * 오염시키는 문제(self-healing이지만 그 사이 잘못된 색인·표시)를 제거한다.
 */
async function cacheNonEmpty<T>(
    keyParts: readonly string[],
    symbol: string,
    fetcher: () => Promise<T[]>,
    extraTags: readonly string[]
): Promise<T[]> {
    try {
        return await staticSymbolCache(
            keyParts,
            symbol,
            async () => {
                const rows = await fetcher();
                if (rows.length === 0) {
                    throw new EmptyResultError();
                }
                return rows;
            },
            extraTags
        );
    } catch (err) {
        // sentinel(의도적 빈 결과)은 무음. 그 외(staticSymbolCache/fetcher의
        // 예상치 못한 throw)는 로깅해 프로덕션 캐시 장애를 추적 가능하게 한다.
        if (!(err instanceof EmptyResultError)) {
            console.error('[cacheNonEmpty] unexpected cache error:', err);
        }
        return [];
    }
}

/**
 * statement 3섹션(income/balance/cashFlow)이 모두 비어 있으면 true.
 *
 * `CachedFinancialStatementsProvider`가 FMP 장애를 swallow해 `[]`를 반환하면 정규화
 * 결과도 all-empty가 된다. 호출 측(page RSC / quarter 토글)은 이 값으로 "데이터 없음/
 * 일시 실패"를 판정해 degrade UI로 전환하고 색인을 막는다(scorecard가 전 축 F로
 * 오인 렌더되어 색인되는 것을 방지).
 */
export function isEmptyFinancialsSnapshot(
    snapshot: FinancialsSnapshot
): boolean {
    return (
        snapshot.income.length === 0 &&
        snapshot.balance.length === 0 &&
        snapshot.cashFlow.length === 0
    );
}

/**
 * 6종 재무제표(income·balance·cashflow + 3×growth)를 병렬로 fetch해
 * core의 `normalizeFinancialsSnapshot`으로 정규화한 `FinancialsSnapshot`을 반환한다.
 *
 * 6-fetch+normalize의 단일 구현(single source) — app 레이어와 quarter Server
 * Action이 이 함수에 위임한다. cache key 형태(`['financials:income', symbol, period]`
 * 등)와 tag(`financials:${SYMBOL}`)가 여기서만 정의되므로 호출 경로와 무관하게
 * 동일한 Next data cache 엔트리를 재사용한다.
 *
 * 각 fetch는 `cacheNonEmpty`로 Next data cache에 저장된다(ISR revalidate=1h,
 * `symbol:${SYMBOL}` + `financials:${SYMBOL}` 태그). 빈 결과는 캐싱하지 않아 FMP
 * 일시 장애가 캐시를 오염시키지 않는다.
 *
 * **React.cache로 감싸 per-request 메모이즈**한다(같은 인자 → 1회 실행). 한 요청에서
 * `generateMetadata`와 페이지 렌더가 둘 다 호출해도 두 번째는 즉시 반환된다 — 특히
 * 빈 스냅샷 경로(`cacheNonEmpty`가 Next data cache를 우회)에서도 6개 FMP 엔드포인트
 * × 2회 호출(generateMetadata + 페이지 렌더의 정상 흐름)이 Redis 1회 조회로 줄어든다
 * (빈 경로의 cross-request dedup은 여전히 CachedFinancialStatementsProvider의 Redis 계층이 담당).
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
            cacheNonEmpty(
                ['financials:income', symbol, period],
                symbol,
                () => p.getIncomeStatements(symbol, period, limit),
                extraTags
            ),
            cacheNonEmpty(
                ['financials:balance', symbol, period],
                symbol,
                () => p.getBalanceSheets(symbol, period, limit),
                extraTags
            ),
            cacheNonEmpty(
                ['financials:cashflow', symbol, period],
                symbol,
                () => p.getCashFlowStatements(symbol, period, limit),
                extraTags
            ),
            cacheNonEmpty(
                ['financials:income-growth', symbol, period],
                symbol,
                () => p.getIncomeStatementGrowths(symbol, period, limit),
                extraTags
            ),
            cacheNonEmpty(
                ['financials:financial-growth', symbol, period],
                symbol,
                () => p.getFinancialGrowths(symbol, period, limit),
                extraTags
            ),
            cacheNonEmpty(
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
);
