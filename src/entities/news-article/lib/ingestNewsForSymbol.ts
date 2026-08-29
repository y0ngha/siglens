import 'server-only';

import type { NewsItem } from '@y0ngha/siglens-core';
import type { DrizzleNewsRepository } from '../api';
import { getNewsClient } from './getNewsClient';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import { NEWS_LOOKBACK_MS } from './newsLookback';
import { markFetched } from './newsRefreshFlag';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import {
    getFmpUserFacingKey,
    isFmpPaymentRequiredError,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';

/**
 * Result of a single ingest pass, shaped so callers can reproduce the exact
 * control flow `ensureNewsCardsAnalyzedAction` used before this was extracted:
 * `fresh` (the FMP items fetched this call) and `upsertSettled` (per-item
 * upsert outcomes, index-aligned with `fresh`) drive downstream decisions
 * (revalidateTag gating via changedCount, DB-first unanalyzed filtering).
 */
export interface NewsIngestResult {
    fresh: NewsItem[];
    upsertSettled: PromiseSettledResult<boolean>[];
}

/**
 * 과반 upsert 실패(=DB 광역 장애로 추정)를 나타내는 전용 에러.
 *
 * 호출부가 "FMP에서 받아올 게 없었다"(→ null 반환, fail-open)와 "DB에 못 썼다"를
 * **반드시 구분**할 수 있어야 한다. 메시지 문자열 매칭 대신 타입으로 구분한다 —
 * pre-warm cron이 이걸 뭉뚱그려 삼키면, 쓰기 실패로 비어 있는 DB를 그대로 분석해
 * 빈약한 스냅샷을 `generatedAt=now`로 굳혀버려 다음 거래일 경계까지 재시도조차
 * 하지 않는다(감사 F2).
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
 * `upsertNewsItem`은 기사 1건당 Neon **HTTP** 쿼리 1회다. 사람 방문 경로에선
 * 한 번에 한 심볼이라 무제한 fan-out이 문제되지 않았지만, cron은 심볼을
 * `SYMBOL_CONCURRENCY`(3)개씩 동시에 돌리므로 상한이 없으면 (기사 수 × 3)만큼의
 * 동시 요청이 배치 데드라인을 갉아먹는다(감사 F5).
 */
const UPSERT_CONCURRENCY = 10;

/**
 * Fetches fresh FMP news for `symbol` and upserts it to DB. Extracted from
 * `ensureNewsCardsAnalyzedAction` (Task: SEO pre-warm news livelock fix) so
 * `prewarmNews` (entities/news-article/api.ts) can call the same ingest path —
 * previously only a human visit to the news tab ever populated the `news`
 * table, so `prewarmNews`'s `listBySymbol` read an empty array for any symbol
 * nobody had visited in the last 30 days (measured: 44/221 harvested symbols,
 * 20%, hit this — worst on low-traffic crypto altcoins, 11/~15 processed
 * cryptos got only `technical` out of 3 applicable tabs).
 *
 * `repo` is injected (not constructed internally via `getDatabaseClient()`)
 * to avoid a runtime circular import with `../api` (which will import this
 * function for `prewarmNews`) — `DrizzleNewsRepository` is only referenced
 * here as a type, which TypeScript erases at compile time. This mirrors the
 * existing `analyzeAndPersist(item, repo)` DI pattern in
 * `ensureNewsCardsAnalyzedAction.ts`.
 *
 * Returns `null` when the FMP fetch itself failed (network/429/402) — callers
 * treat that as "nothing new to ingest" and fall back to whatever is already
 * in the DB. Throws when a majority of upserts fail (likely a DB-wide outage)
 * so callers can distinguish "no new news" from "DB write failure".
 *
 * `profileId` is optional: when the caller already resolved the
 * `MarketProfileId` (e.g. `prewarmNews` needs it separately to derive
 * `assetClass`), pass it through here to skip a second `resolveMarketProfile`
 * → `getAssetInfo` Redis round-trip per symbol per night (PR #700 review).
 * When omitted, this function resolves it itself — `ensureNewsCardsAnalyzedAction`
 * relies on that default and is unaffected.
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

    // FMP 왕복 **전에** 표시한다. 뒤에서 표시하면 두 경로가 새는데, 둘 다 비싼
    // 쪽이다(감사: 비용 라운드 13).
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

    // Upsert all items first so the DB row exists before any downstream
    // analysis step runs. See ensureNewsCardsAnalyzedAction.ts's original
    // comment for why this deliberately isn't wrapped in a DB transaction
    // (the analysis step calls an external LLM worker that can take minutes).
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
        // Majority of upserts failed — almost certainly a DB-wide outage.
        // Throw so the caller knows to retry rather than silently proceeding
        // to analyze partial data.
        throw new NewsIngestWriteError(upsertFailures.length, fresh.length);
    }
    return { fresh, upsertSettled };
}
