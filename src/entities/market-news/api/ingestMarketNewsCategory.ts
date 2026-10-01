import 'server-only';
import { revalidateTag } from 'next/cache';
import { runNewsCardAnalysis, type NewsItem } from '@y0ngha/siglens-core';
import { getDatabaseClient } from '@/shared/db/client';
import { isE2E } from '@/shared/api/e2eEnv';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import {
    DrizzleMarketNewsRepository,
    isRecentlyFetched,
    markFetched,
} from './marketNewsRepository';
import { getMarketNewsClient } from '../lib/getMarketNewsClient';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import {
    MARKET_NEWS_LOOKBACK_MS,
    MARKET_NEWS_CACHE_TAG_PREFIX,
    LLM_PARALLEL_LIMIT,
} from '../lib/marketNewsConstants';

/** Divisor for the upsert-majority-failure threshold: if more than half of fetched items fail to upsert, abort. */
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
 * 적재 결과. 크론은 이 값을 로그에만 쓴다 — 실패해도 다이제스트는 DB에 이미 있는
 * 기사로 계속 진행한다(fail-open, `prewarmNews`와 같은 정책).
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
           * `analyzeLimit`에 잘려 이번에 보강하지 못한 미보강 기사 수. 크론은 이 값이
           * 0일 때만 3시간 간격 플래그를 세운다 — 남아 있으면 다음 tick에 이어서 비운다.
           */
          readonly pending: number;
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

    // Mark before the async fetch so that a second concurrent caller that
    // reads the flag after this point will skip the upstream round-trip.
    await markFetched(sentinel);

    const newsClient = getMarketNewsClient(category);
    const { db } = getDatabaseClient();
    const repo = new DrizzleMarketNewsRepository(db);

    const fresh = await newsClient
        .fetchCategoryNews(category, MARKET_NEWS_LOOKBACK_MS)
        .catch((err: unknown) => {
            console.error(`[${logLabel}] feed fetch failed:`, err);
            return null;
        });
    if (fresh === null) return { status: 'fetch-failed' };

    // Upsert all items first so the DB row exists before attachAnalysis runs.
    // We do NOT wrap upsert + analyze in a transaction — LLM polling can take
    // seconds and would hold connection-pool slots (same rationale as per-symbol).
    const upsertSettled = await Promise.allSettled(
        fresh.map(item => repo.upsertMarketNewsItem(item))
    );
    const upsertFailures = upsertSettled.filter(r => r.status === 'rejected');
    if (upsertFailures.length > 0) {
        console.error(
            `[${logLabel}] ${upsertFailures.length}/${fresh.length} upserts failed`,
            upsertFailures.map(f => (f.status === 'rejected' ? f.reason : null))
        );
    }
    if (upsertFailures.length > fresh.length / MAJORITY_DIVISOR) {
        console.error(
            `[${logLabel}] majority upsert failure (${upsertFailures.length}/${fresh.length}) — aborting`
        );
        return { status: 'write-failed' };
    }

    if (fresh.length === 0) {
        return {
            status: 'ok',
            fetched: 0,
            changed: 0,
            analyzed: 0,
            pending: 0,
        };
    }

    // Only revalidate when at least one row was actually inserted or changed.
    // `upsertMarketNewsItem` returns true only on genuine content change (setWhere).
    const changed = upsertSettled.filter(
        r => r.status === 'fulfilled' && r.value === true
    ).length;
    if (changed > 0) {
        // Use 'market-news:<sentinel>' tag so only the category's ISR cache is
        // busted — bars/profile/analysis caches for per-symbol pages are untouched.
        // See Next.js 16.2 revalidateTag(tag, profile?) signature — 'max' busts immediately.
        revalidateTag(cacheTag, 'max');
    }

    if (isE2E()) {
        return {
            status: 'ok',
            fetched: fresh.length,
            changed,
            analyzed: 0,
            pending: 0,
        };
    }

    // `fresh` comes from the upstream feed and has no `analyzedAt`; re-read DB to skip items
    // that a previous run already analyzed — avoids duplicate LLM submissions.
    // 필요한 건 "이미 분석됨" 집합뿐이라 id만 읽는다 — 전 컬럼을 읽으면 본문까지
    // 받아서 그대로 버린다(감사: 비용 라운드 15).
    const analyzedIds = await repo.listAnalyzedIds(
        sentinel,
        MARKET_NEWS_LOOKBACK_MS
    );
    // Only send items whose DB row was successfully upserted to LLM —
    // if upsert failed, `attachAnalysis` would error with "row not found",
    // wasting LLM credits. The majority-failure guard above already handles
    // bulk failures; this filters the surviving minority rejects.
    const upsertedIds = new Set(
        upsertSettled.flatMap((r, i) =>
            r.status === 'fulfilled' ? [fresh[i].id] : []
        )
    );
    const candidates = fresh.filter(
        item => upsertedIds.has(item.id) && !analyzedIds.has(item.id)
    );
    const unanalyzed =
        analyzeLimit === undefined
            ? candidates
            : candidates.slice(0, analyzeLimit);
    const pending = candidates.length - unanalyzed.length;

    if (unanalyzed.length === 0) {
        return {
            status: 'ok',
            fetched: fresh.length,
            changed,
            analyzed: 0,
            pending: 0,
        };
    }

    // Chunked-parallel: submit card analyses in batches of LLM_PARALLEL_LIMIT.
    // Unbounded Promise.allSettled(50 items) risks a worker-queue stampede.
    const analyzeSettled = await withConcurrencyLimit(
        unanalyzed,
        LLM_PARALLEL_LIMIT,
        item => analyzeAndPersist(item, repo, logLabel)
    );
    const analyzeFailures = analyzeSettled.filter(r => r.status === 'rejected');
    if (analyzeFailures.length > 0) {
        console.error(
            `[${logLabel}] ${analyzeFailures.length}/${unanalyzed.length} analyzeAndPersist failed`,
            analyzeFailures.map(f =>
                f.status === 'rejected' ? f.reason : null
            )
        );
    }
    if (analyzeFailures.length > unanalyzed.length / MAJORITY_DIVISOR) {
        console.error(
            `[${logLabel}] majority analyzeAndPersist failure (${analyzeFailures.length}/${unanalyzed.length})`
        );
    }

    const analyzed = analyzeSettled.filter(
        r => r.status === 'fulfilled' && r.value
    ).length;
    if (analyzed > 0) {
        // 보강 결과를 SSR 목록에 반영한다 — JSDoc "무효화 시점" 참고.
        revalidateTag(cacheTag, 'max');
    }

    return { status: 'ok', fetched: fresh.length, changed, analyzed, pending };
}
