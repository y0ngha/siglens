import 'server-only';
import { revalidateTag } from 'next/cache';
import { runNewsCardAnalysis, type NewsItem } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import type { MarketNewsItem } from '../lib/marketNewsClientPort';
import {
    LLM_PARALLEL_LIMIT,
    MARKET_NEWS_CACHE_TAG_PREFIX,
    MARKET_NEWS_LOOKBACK_MS,
} from '../lib/marketNewsConstants';
import { selectAnalysisCandidates } from '../lib/selectAnalysisCandidates';
import { getMarketNewsClient } from './getMarketNewsClient';
import { isRecentlyFetched, markFetched } from './marketNewsRefreshFlags';
import { DrizzleMarketNewsRepository } from './marketNewsRepository';

/** 절반 초과 실패 판정의 나눗수 — 적재는 upsert가 절반을 넘게 실패하면 중단하고, 보강은 같은 기준으로 로그만 남긴다. */
const MAJORITY_DIVISOR = 2;

export interface IngestMarketNewsCategoryOptions {
    /**
     * 한 번에 보강(카드 AI 분석)할 최대 기사 수. 생략하면 이번 피드의 미보강 기사 전부.
     *
     * 크론은 상한을 건다 — 허브 대상 하나에는 `HUB_UNIT_TIMEOUT_MS`(45초) 유닛 상한이
     * 있어, 백로그 50건(동시 8 → 7청크 × 왕복 4~13초)을 한 번에 돌리면 그 안에 못 끝난다.
     * 남은 기사는 다음 적재 때 다시 후보가 된다 — 피드는 델타가 아니라 7일 창 전체를
     * 매번 돌려주고, 후보는 "DB에서 아직 미보강"으로 고르기 때문이다(자기 회복). 남은
     * 수는 결과의 `pending`으로 돌려준다.
     */
    readonly analyzeLimit?: number;
    /** 로그 접두. 방문자 경로와 크론 경로를 로그에서 가르기 위함. */
    readonly logLabel: string;
}

/**
 * 적재 결과. 크론은 로그에 남기고, `ok`일 때 `pending`·`enriched`로 3시간 간격 플래그를
 * 세울지 정한다(`hubs.ts` `ingestCategoryBeforeDigest`). 실패해도 다이제스트는 DB에 이미
 * 있는 기사로 계속 진행한다(fail-open, `prewarmNews`와 같은 정책).
 */
export type IngestMarketNewsCategoryResult =
    | { readonly status: 'recently-fetched' }
    | { readonly status: 'fetch-failed' }
    | { readonly status: 'write-failed' }
    | {
          readonly status: 'ok';
          readonly fetched: number;
          readonly changed: number;
          readonly analyzed: number;
          /**
           * `analyzeLimit`에 잘려 이번에 보강하지 못한 미보강 기사 수. 0이면 백로그가
           * 비었다는 뜻이다.
           */
          readonly pending: number;
          /**
           * 이번 실행이 끝난 시점에 조회 창(7일) 안에서 **보강이 끝난** 기사 수.
           * 피드가 비었거나 E2E 단락처럼 DB를 읽지 않은 경로는 0이다(그때는 `pending`도
           * 0이라 크론 판정에 영향이 없다).
           *
           * 크론이 "백로그를 더 비울지"를 정할 때 `pending`과 함께 본다. `pending`만 보면
           * 빠른 피드에서는 영원히 끝나지 않는다 — `stock`·`crypto`는 10분마다 새 기사가
           * 10~50건 들어오는데 회당 상한은 8건이라 `pending`이 0이 되는 순간이 없다
           * (2026-10-01 운영 실측: 한 시간 내내 26~42). 다이제스트·목록에 쓸 만큼 보강된
           * 기사가 이미 있으면 거기서 멈추는 게 맞다.
           */
          readonly enriched: number;
      };

/**
 * Run per-card AI analysis for a single item and persist the result to DB.
 *
 * Caller guarantees that `item` has not been analyzed yet (analyzedAt === null).
 * `runNewsCardAnalysis` returns `{ status: 'done', result }` directly — no polling.
 *
 * 추론 on/off는 여기서 정하지 않는다 — `runNewsCardAnalysis`가 use-case 정책으로
 * `reasoning: false`를 고정한다.
 *
 * @returns 실제로 저장했으면 true. 빈 분석(core normalizer의 crash-safe fallback)은
 *   저장하지 않고 false — 저장하면 `analyzedAt`이 세팅되어 재분석 대상에서 영구히
 *   빠지고 sentiment/category가 기본값으로 고착한다(심볼 뉴스·경제 이벤트 경로와
 *   같은 skip 정책).
 */
async function analyzeAndPersist(
    item: NewsItem,
    repo: DrizzleMarketNewsRepository,
    logLabel: string
): Promise<boolean> {
    const analyzed = await runNewsCardAnalysis({ item });
    const { titleKo, summaryKo } = analyzed.result;
    if (titleKo.trim() === '' && summaryKo.trim() === '') {
        console.warn(
            `[${logLabel}] empty card analysis — skipping persist for ${item.id}`
        );
        return false;
    }
    await repo.attachAnalysis(item.id, analyzed.result, new Date());
    return true;
}

interface UpsertOutcome {
    /** upsert가 성공해 DB 행이 있는 기사 id. */
    readonly upsertedIds: ReadonlySet<string>;
    /** 행이 실제로 새로 들어갔거나 내용이 바뀐 수. */
    readonly changed: number;
    /** 절반 넘게 실패해 이번 적재를 중단해야 하는가. */
    readonly majorityFailed: boolean;
}

/**
 * 피드 전체를 upsert한다 — 보강보다 먼저 해서 `attachAnalysis` 시점에 DB 행이 있게
 * 한다. upsert와 보강을 트랜잭션으로 묶지 않는다: LLM 호출이 수 초 걸려 커넥션 풀
 * 슬롯을 쥐게 되기 때문이다(종목 뉴스와 같은 근거).
 *
 * 실패는 개별 행 단위로 `logActionError`에 남긴다 — Drizzle 오류 메시지는 바인딩된
 * 값(기사 본문)을 담는다.
 */
async function upsertFeed(
    repo: DrizzleMarketNewsRepository,
    fresh: readonly MarketNewsItem[],
    logLabel: string
): Promise<UpsertOutcome> {
    const settled = await Promise.allSettled(
        fresh.map(item => repo.upsertMarketNewsItem(item))
    );
    const failures = settled.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
        console.error(
            `[${logLabel}] ${failures.length}/${fresh.length} upserts failed`
        );
        for (const failure of failures) {
            logActionError(`[${logLabel}] upsert failed`, failure.reason);
        }
    }
    const majorityFailed = failures.length > fresh.length / MAJORITY_DIVISOR;
    if (majorityFailed) {
        console.error(
            `[${logLabel}] majority upsert failure (${failures.length}/${fresh.length}) — aborting`
        );
    }

    return {
        // `upsertMarketNewsItem`은 내용이 실제로 바뀐 경우에만 true를 돌려준다(setWhere).
        changed: settled.filter(r => r.status === 'fulfilled' && r.value)
            .length,
        majorityFailed,
        upsertedIds: new Set(
            settled.flatMap((r, i) =>
                r.status === 'fulfilled' ? [fresh[i].id] : []
            )
        ),
    };
}

/**
 * 고른 기사를 청크 병렬로 카드 분석·저장하고 실제로 저장한 수를 돌려준다. 기사 50건을
 * 한꺼번에 `Promise.allSettled`하면 워커 큐가 몰리므로 `LLM_PARALLEL_LIMIT`씩 끊는다.
 * 개별 실패는 로그만 남기고 던지지 않는다.
 */
async function analyzeSelected(
    repo: DrizzleMarketNewsRepository,
    selected: readonly MarketNewsItem[],
    logLabel: string
): Promise<number> {
    const settled = await withConcurrencyLimit(
        selected,
        LLM_PARALLEL_LIMIT,
        item => analyzeAndPersist(item, repo, logLabel)
    );
    const failures = settled.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
        console.error(
            `[${logLabel}] ${failures.length}/${selected.length} analyzeAndPersist failed`,
            failures.map(f => f.reason)
        );
    }
    if (failures.length > selected.length / MAJORITY_DIVISOR) {
        console.error(
            `[${logLabel}] majority analyzeAndPersist failure (${failures.length}/${selected.length})`
        );
    }
    return settled.filter(r => r.status === 'fulfilled' && r.value).length;
}

/**
 * 시장 뉴스 카테고리 하나를 **적재 → 목록 캐시 무효화 → 카드 보강**한다.
 *
 * 소스(FMP / 네이버)는 카테고리가 정한다(`CATEGORY_CONFIG[category].source`).
 * 방문자 경로(`ensureMarketNewsCardsAnalyzedAction`)와 허브 프리웜 크론
 * (`app/api/cron/seo-prewarm/hubs.ts`)이 이 함수를 공유한다.
 *
 * ## 왜 크론도 적재하는가
 *
 * 예전에는 방문자 브라우저가 카테고리 페이지를 열 때만 적재했다. 그래서 찾는 사람이
 * 적은 카테고리(`forex`·`articles`)는 몇 주씩 비었고(2026-09-17 운영 크롤에서
 * `/news/forex` 마지막 기사 3주 전), 비면 noindex·sitemap 제외로 유입마저 끊기는
 * 자기강화 루프에 갇혔다. 허브 프리웜은 DB만 읽어 다이제스트를 굽고 있어서, 기사가
 * 들어온 직후엔 "다이제스트는 있는데 목록은 비어 있는" 화면도 나왔다. 종목 뉴스
 * 프리웜(`prewarmNews`)이 이미 같은 이유로 적재를 먼저 한다.
 *
 * ## 무효화 시점
 *
 * 두 번 턴다. 행이 실제로 바뀌었을 때 한 번(기존 동작), 그리고 보강을 하나라도
 * 저장했으면 끝난 뒤 한 번 더. 두 번째가 없으면 첫 무효화 직후 다시 렌더된 목록이
 * **미보강 카드**(번역·요약 없음)로 `staticSymbolCache` 12시간을 버틴다 — 방문자는
 * 클라이언트 폴링으로 곧 채워지지만, 크론 경로는 지켜보는 사람이 없어 SSR이 그대로
 * 굳는다.
 *
 * DB-first: items already with `analyzedAt` set are skipped. Per-item errors
 * are logged and never thrown; other items continue normally. 피드·적재 실패는
 * `status`로 돌려주지만, 그 밖의 예외(예: `listAnalyzedIds` DB 읽기 실패)는 그대로
 * 올라간다 — 호출부가 각자의 격리 단위로 잡는다(액션: try/catch, 크론: 대상 단위 catch).
 */
export async function ingestMarketNewsCategory(
    category: NewsFeedCategoryId,
    { analyzeLimit, logLabel }: IngestMarketNewsCategoryOptions
): Promise<IngestMarketNewsCategoryResult> {
    const { sentinel } = CATEGORY_CONFIG[category];
    const cacheTag = `${MARKET_NEWS_CACHE_TAG_PREFIX}:${sentinel}`;

    if (await isRecentlyFetched(sentinel)) {
        return { status: 'recently-fetched' };
    }

    // 비동기 fetch보다 먼저 표시한다 — 이 시점 이후 플래그를 읽는 동시 호출자가
    // 외부 왕복을 건너뛴다.
    await markFetched(sentinel);

    const { db } = getDatabaseClient();
    const repo = new DrizzleMarketNewsRepository(db);

    const fresh = await getMarketNewsClient(category)
        .fetchCategoryNews(category, MARKET_NEWS_LOOKBACK_MS)
        .catch((err: unknown) => {
            console.error(`[${logLabel}] feed fetch failed:`, err);
            return null;
        });
    if (fresh === null) return { status: 'fetch-failed' };

    const { upsertedIds, changed, majorityFailed } = await upsertFeed(
        repo,
        fresh,
        logLabel
    );
    if (majorityFailed) return { status: 'write-failed' };

    if (fresh.length === 0) {
        return {
            status: 'ok',
            fetched: 0,
            changed: 0,
            analyzed: 0,
            pending: 0,
            enriched: 0,
        };
    }

    // 행이 실제로 들어가거나 바뀐 경우에만 무효화한다. `market-news:<sentinel>` 태그라
    // 이 카테고리의 ISR 캐시만 깨지고 종목 페이지의 bars/profile/analysis 캐시는
    // 그대로다. `revalidateTag(tag, 'max')`는 즉시 무효화한다(Next.js 16.2 시그니처).
    if (changed > 0) {
        revalidateTag(cacheTag, 'max');
    }

    if (isE2E()) {
        return {
            status: 'ok',
            fetched: fresh.length,
            changed,
            analyzed: 0,
            pending: 0,
            enriched: 0,
        };
    }

    // `fresh`는 외부 피드라 `analyzedAt`이 없다 — DB를 다시 읽어 이미 보강된 기사를
    // 건너뛰어야 LLM 중복 제출을 피한다. 필요한 건 "이미 분석됨" 집합뿐이라 id만 읽는다
    // (전 컬럼을 읽으면 본문까지 받아서 그대로 버린다).
    const analyzedIds = await repo.listAnalyzedIds(
        sentinel,
        MARKET_NEWS_LOOKBACK_MS
    );
    const { selected, pending } = selectAnalysisCandidates({
        fresh,
        upsertedIds,
        analyzedIds,
        analyzeLimit,
    });

    if (selected.length === 0) {
        return {
            status: 'ok',
            fetched: fresh.length,
            changed,
            analyzed: 0,
            pending: 0,
            // 이번엔 보강한 게 없으므로 창 안의 기존 보강 수 그대로다.
            enriched: analyzedIds.size,
        };
    }

    const analyzed = await analyzeSelected(repo, selected, logLabel);
    if (analyzed > 0) {
        // 보강 결과를 SSR 목록에 반영한다 — JSDoc "무효화 시점" 참고.
        revalidateTag(cacheTag, 'max');
    }

    return {
        status: 'ok',
        fetched: fresh.length,
        changed,
        analyzed,
        pending,
        // 실행 전 창 안의 보강 수 + 이번에 저장한 수. 후보는 미보강 기사에서만 뽑으므로
        // 둘이 겹치지 않는다.
        enriched: analyzedIds.size + analyzed,
    };
}
