import 'server-only';

import type { NewsItem } from '@y0ngha/siglens-core';
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import {
    getFmpUserFacingKey,
    isFmpPaymentRequiredError,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import type { DrizzleNewsRepository } from '../api';
import { getNewsClient } from '../server/getNewsClient';
import { markFetched } from '../server/newsRefreshFlag';
import { NEWS_LOOKBACK_MS } from './newsLookback';

/**
 * 적재 한 번의 결과. `fresh`(이번에 FMP에서 받은 기사)와 `upsertSettled`(기사별 upsert
 * 결과, `fresh`와 인덱스가 정렬됨)가 후속 판단을 이끈다 — `countChangedRows`로 보는
 * `revalidateTag` 게이트, DB 기준 미보강 선별이 그것이다.
 */
export interface NewsIngestResult {
    fresh: NewsItem[];
    upsertSettled: PromiseSettledResult<boolean>[];
}

/**
 * 이번 적재에서 실제로 삽입·변경된 행 수. `upsertNewsItem`은 값이 바뀐 행만
 * RETURNING하므로(`setWhere`) 같은 기사 재fetch는 `false`로 settle한다 — 그래서
 * 이 수가 0이면 news 캐시 태그를 무효화할 이유가 없다(방문마다 무효화하는 빈도 폭풍 방지).
 * 방문자·prewarm·챗 세 수급 경로가 모두 이 판단으로 `revalidateTag`를 건다.
 */
export function countChangedRows(result: NewsIngestResult): number {
    return result.upsertSettled.filter(
        r => r.status === 'fulfilled' && r.value === true
    ).length;
}

/**
 * 과반 upsert 실패(=DB 광역 장애로 추정)를 나타내는 전용 에러.
 *
 * 호출부가 "FMP에서 받아올 게 없었다"(→ null 반환, fail-open)와 "DB에 못 썼다"를
 * **반드시 구분**할 수 있어야 한다. 메시지 문자열 매칭 대신 타입으로 구분한다 —
 * pre-warm cron이 이걸 뭉뚱그려 삼키면, 쓰기 실패로 비어 있는 DB를 그대로 분석해
 * 빈약한 스냅샷을 `generatedAt=now`로 굳혀버려 다음 거래일 경계까지 재시도조차
 * 하지 않는다.
 */
export class NewsIngestWriteError extends Error {
    constructor(failed: number, total: number) {
        super(
            `[ingestNewsForSymbol] majority upsert failure (${failed}/${total})`
        );
        this.name = 'NewsIngestWriteError';
    }
}

/**
 * 한 심볼의 기사 upsert 동시 실행 상한.
 *
 * `upsertNewsItem`은 기사 1건당 DB 쿼리 1회다. 사람 방문 경로에선
 * 한 번에 한 심볼이라 무제한 fan-out이 문제되지 않지만, cron은 심볼을
 * `SYMBOL_CONCURRENCY`(3)개씩 동시에 돌리므로 상한이 없으면 (기사 수 × 3)만큼의
 * 동시 요청이 배치 데드라인을 갉아먹는다.
 */
const UPSERT_CONCURRENCY = 10;

/**
 * 한 심볼의 뉴스를 FMP(또는 시장 프로필의 뉴스 소스)에서 받아 DB에 upsert한다.
 * 방문자 액션(`ensureNewsCardsAnalyzedAction`)·SEO prewarm(`server/prewarmNews`)·챗
 * 수급(`server/ensureSymbolNewsFresh`)이 같은 적재 경로를 공유한다.
 *
 * **`lib/`에 두는 것은 의도된 예외다**(src/entities/CLAUDE.md#EN-1). 저장소를 인자로
 * 주입받아 부수효과를 호출자가 통제하는 파이프라인 단계이고, 세 호출자가 공유한다.
 * `repo`를 내부에서 `getDatabaseClient()`로 만들지 않고 주입받으므로 `../api`와의 런타임
 * 순환도 없다(`DrizzleNewsRepository`는 타입으로만 참조해 컴파일 시 지워진다).
 *
 * 소스 fetch 자체가 실패하면(네트워크·429·402) `null`을 돌려준다 — 호출부는 "새로
 * 적재할 것이 없다"로 보고 DB에 이미 있는 것으로 계속한다. 과반 upsert가 실패하면(DB
 * 광역 장애 추정) {@link NewsIngestWriteError}를 던져 "새 뉴스 없음"과 "DB 쓰기 실패"를
 * 구분하게 한다.
 *
 * @param lookbackMs - 조회 창. 소비자가 더 좁은 창만 읽으면 좁혀서 불필요한 upsert를
 *   줄인다.
 * @param profileId - 호출부가 이미 `MarketProfileId`를 resolve했으면 넘겨 심볼마다
 *   `resolveMarketProfile` → `getAssetInfo` Redis 왕복이 한 번 더 생기는 것을 막는다.
 *   생략하면 여기서 resolve한다.
 */
export async function ingestNewsForSymbol(
    symbol: string,
    repo: DrizzleNewsRepository,
    lookbackMs: number = NEWS_LOOKBACK_MS,
    profileId?: MarketProfileId
): Promise<NewsIngestResult | null> {
    const resolvedProfileId = profileId ?? (await resolveMarketProfile(symbol));
    const newsSource = getDescriptor(resolvedProfileId).newsSource;
    const newsClient = getNewsClient(newsSource);

    // 소스 왕복 **전에** 표시한다. 뒤에서 표시하면 두 경로가 새는데, 둘 다 비싼
    // 쪽이다.
    //  - 실패 경로: `fresh === null`로 빠져나가면 표시가 아예 안 된다 — 즉 유료 API가
    //    429/402로 거절하는 동안 스로틀이 없다. 재시도 예산까지 포함해 마운트당
    //    4콜이 무한 반복된다.
    //  - 동시성: 플래그를 읽은 시점과 쓰는 시점 사이(FMP 왕복 + N건 upsert)에 들어온
    //    마운트가 같은 패스를 통째로 중복 수행한다 — `analyzedAt`이 아직 안 찍혀
    //    같은 최신 25건을 두 번 분석한다.
    // 시장 뉴스 형제 경로가 같은 이유로 이미 앞에서 표시한다.
    await markFetched(symbol);

    const fresh = await newsClient
        .fetchNewsForPeriod(symbol, lookbackMs)
        .catch((err: unknown) => {
            logFmpPaymentRequiredError(err);
            if (
                getFmpUserFacingKey(err) === null &&
                !isFmpPaymentRequiredError(err)
            ) {
                console.error('[ingestNewsForSymbol] FMP fetch failed:', err);
            }
            return null;
        });
    if (fresh === null) return null;

    // 분석 단계가 DB 행을 전제하므로 먼저 전부 upsert한다. 트랜잭션으로 묶지 않는
    // 이유: 뒤따르는 분석 단계가 외부 LLM을 부르며 수 분이 걸릴 수 있다.
    // `withConcurrencyLimit`은 입력 순서대로 settled 결과를 돌려주므로
    // `Promise.allSettled`의 드롭인 대체다 — 동시 실행 수만 제한된다.
    const upsertSettled = await withConcurrencyLimit(
        fresh,
        UPSERT_CONCURRENCY,
        item => repo.upsertNewsItem(item)
    );
    const upsertFailures = upsertSettled.filter(r => r.status === 'rejected');
    if (upsertFailures.length > 0) {
        console.error(
            `[ingestNewsForSymbol] ${upsertFailures.length}/${fresh.length} upserts failed`,
            upsertFailures.map(f => (f.status === 'rejected' ? f.reason : null))
        );
    }
    if (upsertFailures.length > fresh.length / 2) {
        // 과반 실패는 거의 확실히 DB 광역 장애다. 던져서 호출부가 일부 데이터로
        // 조용히 분석을 진행하지 않고 재시도하게 한다.
        throw new NewsIngestWriteError(upsertFailures.length, fresh.length);
    }
    return { fresh, upsertSettled };
}
