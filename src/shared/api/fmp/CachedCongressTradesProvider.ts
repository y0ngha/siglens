import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { CONGRESS_REVALIDATE_SECONDS } from '@/shared/config/time';
import type {
    Chamber,
    CongressTradesProvider,
    RawCongressTrade,
} from '@y0ngha/siglens-core';

const TTL = CONGRESS_REVALIDATE_SECONDS;
const sym = (s: string): string => s.toUpperCase();

/**
 * Cold-cache fetch는 항상 이 고정 상한으로 inner를 호출하고 전체 배열을 캐싱한다.
 * 호출자의 `limit`은 캐시된 배열을 읽을 때 `.slice(0, limit)`으로 적용한다.
 *
 * 이렇게 하지 않고 호출자의 `limit`을 그대로 inner에 넘기면, 키에 `limit`이 없으므로
 * cold `limit=2` 호출이 2행만 캐싱하고 이후 `limit=10` 호출이 그 2행만 받는 truncation
 * 버그가 생긴다. FMP는 chamber당 최대 ~100건을 반환하므로 100이 안전한 상한이다.
 * CachedFinancialStatementsProvider의 MAX_STATEMENT_LIMIT 패턴을 미러링한다.
 */
const CONGRESS_MAX_TRADES = 100;

/**
 * `CongressTradesProvider`를 감싸 per-chamber Redis 캐싱을 주입하는 데코레이터.
 *
 * 의회 거래 공시는 ~45일 지연 공시이므로 24 h TTL로 FMP 호출 빈도를 억제한다.
 * `React.cache`로 RSC 요청 스코프 dedup + `getOrSetCache`로 cross-request Redis
 * 캐싱을 적용한다.
 *
 * **CachedFinancialStatementsProvider와의 결정적 차이:**
 * inner throw(FMP 장애)는 `.catch(() => [])` 없이 그대로 전파된다.
 * Task B4의 resilient 래퍼가 "throw = 인프라 장애"와 "[] = 0건(정상)"을
 * 구분해 noindex 여부를 결정해야 하기 때문이다.
 * - inner → `[]` 반환(0건, 정상) → 캐시하고 반환
 * - inner → throw(FMP 장애) → getOrSetCache가 set을 건너뛰고 rethrow → 호출자에게 전파
 *
 * 키 스킴: `congress:<chamber>:<SYM>` — 예) `congress:senate:AAPL`.
 * chamber별로 독립 키 2개를 사용해 상원/하원 데이터를 분리 캐싱한다.
 * symbol은 항상 대문자로 정규화한다.
 * `limit`은 캐시 키에 포함하지 않는다 — 대신 항상 `CONGRESS_MAX_TRADES`로 fetch·캐싱하고
 * 호출자의 `limit`은 읽을 때 slice로 적용한다(상세는 `CONGRESS_MAX_TRADES` JSDoc 참고).
 */
export class CachedCongressTradesProvider implements CongressTradesProvider {
    constructor(private readonly inner: CongressTradesProvider) {}

    getTrades = cache(
        async (
            symbol: string,
            chamber: Chamber,
            limit: number
        ): Promise<RawCongressTrade[]> => {
            const cached = await getOrSetCache(
                `congress:${chamber}:${sym(symbol)}`,
                TTL,
                () => this.inner.getTrades(symbol, chamber, CONGRESS_MAX_TRADES)
            );
            return cached.slice(0, limit);
        }
    );
}
