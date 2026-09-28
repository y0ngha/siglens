import 'server-only';
import type { NewsItem } from '@y0ngha/siglens-core';
import {
    analyzeNewsCards,
    DrizzleNewsRepository,
    ingestNewsForSymbol,
    isRecentlyFetched,
    CHAT_SYNC_NEWS_CARD_LIMIT,
    NEWS_ANALYSIS_LOOKBACK_MS,
    selectUnanalyzed,
    VISITOR_NEWS_CARD_LIMIT,
} from '@/entities/news-article/api';
import { getDatabaseClient } from '@/shared/db/client';
import { revalidateTag } from 'next/cache';
import { after } from 'next/server';

/**
 * 챗 툴이 심볼 데이터를 읽기 **전에** 돌리는 수급 단계.
 *
 * ## 왜 필요한가
 *
 * 챗의 `get_news`는 `listCardsBySymbol`로 **DB만 읽었다**. 적재(ingest)를 트리거하는
 * 경로는 뉴스 탭 방문(`ensureNewsCardsAnalyzedAction`)과 prewarm cron 둘뿐이라,
 * 둘 다 안 돌면 DB가 며칠씩 정체된 채 그대로 답으로 나갔다.
 *
 * 실측(2026-09-21): 사용자가 LAES의 당일 보도자료를 물었을 때 FMP에는 그 기사가
 * **이미 있었는데** 챗은 "가장 최근 것이 2026-09-17(89시간 전)"이라고 답했다.
 * 뉴스가 없어서가 아니라 아무도 적재를 부르지 않아서였다.
 *
 * ## 왜 "무조건 최신화"가 아니라 게이트인가
 *
 * 질문마다 무조건 적재하면 FMP 왕복이 질문 수에 비례해 늘고, 같은 심볼을 연달아
 * 묻는 대화에서 그대로 증폭된다. 이미 같은 목적의 장치가 있다 —
 * `newsRefreshFlag`(Redis, TTL 10분). 뉴스 탭 방문 경로가 쓰는 바로 그 플래그이고,
 * 봇 연타 방어까지 이미 들어 있다. 챗만 이걸 안 쓰고 있었을 뿐이라 그대로 재사용한다.
 *
 * ## 계약
 *
 * - **절대 throw하지 않는다.** 수급 실패가 질문 자체를 죽이면 안 된다 — DB에 있는
 *   것으로 답하는 편이 낫다. 반환값은 진단용이며(지금은 테스트만 읽는다) 호출부
 *   `ToolRuntime.ensureSymbolData`는 이를 버리고 `void`로 접는다.
 * - **신규 기사 보강(LLM 번역·라벨)은 응답 전에 동기로 한다.** 건수는
 *   `CHAT_SYNC_NEWS_CARD_LIMIT`로 묶는다. 호출부(`get_news`)가 바로 다음에 DB를
 *   읽어 그 턴의 답을 만들기 때문에, 여기서 기다려야 방금 들어온 기사가 한국어
 *   제목·감성을 달고 나간다.
 * - **바깥 세계로 나가는 두 대기에 벽시계 예산이 붙는다** — 적재(FMP)와 보강(LLM).
 *   근거와 숫자는 `INGEST_BUDGET_MS` 주석에 있다. 예산을 넘긴 작업은 **버리지
 *   않고** 그대로 `after()`가 이어받는다 — 취소가 안 되므로 버려도 계속 돌고,
 *   다시 부르면 같은 값을 두 번 지불한다.
 *   나머지 두 왕복(`isRecentlyFetched` = Redis, `repo.listBySymbol` = Neon)은
 *   예산 없이 기다린다. 이 둘은 자체 재시도 사다리가 없어 꼬리가 짧고, 둘이
 *   막힐 정도면 툴 결과보다 큰 문제다 — 30초 천장에 남겨 둔 12초가 그 몫이다.
 * - **수급이 예산을 넘겨도 답은 나간다.** `listCardsBySymbol`이 미보강 행도
 *   돌려주므로 제목·발행일·링크는 즉시 보이고 감성·분류 라벨만 다음 읽기까지
 *   빈다. 이 열화가 툴 타임아웃(모델이 **아무것도** 못 받는다)보다 낫다는 판단이
 *   예산의 존재 이유다.
 */
export interface SymbolFreshnessResult {
    /** 이번 호출이 실제로 외부 수급을 돌렸는가(false = TTL 내라 건너뜀). */
    refreshed: boolean;
    /** 새로 적재/변경된 기사 수. `refreshed`가 false면 0. */
    changedCount: number;
    /**
     * 적재가 예산을 넘겨 `after()`로 넘어갔는가. 이때 `changedCount`는 **아직
     * 모르는 값**이라 0으로 둔다 — "변경 없음"과 구별하려면 이 플래그를 본다.
     */
    deferred?: true;
}

const SKIPPED: SymbolFreshnessResult = { refreshed: false, changedCount: 0 };
const DEFERRED: SymbolFreshnessResult = {
    refreshed: true,
    changedCount: 0,
    deferred: true,
};

type IngestOutcome = Awaited<ReturnType<typeof ingestNewsForSymbol>>;

/**
 * 수급 각 단계에 거는 벽시계 예산.
 *
 * 이 경로는 `get_news` 안에서 돈다. `get_news`는 core 스펙상 `costClass: 'free'`라
 * `TOOL_TIMEOUT_MS.free = 30_000`을 받고, 넘기면 `runAgentTurn.executeOne`이 그 툴
 * 호출을 `{ error: 'timeout' }`으로 접는다 — 모델은 **기사를 한 건도 못 받는다.**
 * master는 이 경로에서 적재를 아예 부르지 않았으므로, 바운드 없는 수급은 고치려던
 * 문제보다 나쁜 상태를 만든다.
 *
 * 그래서 **두 단계 모두** 예산을 든다. 둘 다 혼자서 30초를 넘길 수 있다:
 *
 * - **적재**: `fetchNewsForPeriod` → `fmpGet` → `withRetry(FMP_TRANSIENT_RETRY)`가
 *   4회 × `FMP_FETCH_TIMEOUT_MS`(10초) = **fetch만 40초**다. 여기에 429 사다리
 *   (`FMP_RATE_LIMIT_RETRY_DELAYS_MS` 10/15/20초, `backoffBudgetMs` 60초)와 최대
 *   `LONG_PERIOD_LIMIT`(1000)건 upsert(`UPSERT_CONCURRENCY` 10, 각각 Neon 재시도)가
 *   더 붙는다. core의 `limits.js` 주석 자체가 30초는 "10+15+20초 사다리를 일부러
 *   덮지 않는다"고 적어 둔 값이다.
 * - **보강**: `analyzeNewsCards`는 `signal`을 받지 않고, 그 아래 Gemini 어댑터에는
 *   stall 워치독이 없다(`GEMINI_TIMEOUT_MS`는 1시간이고 90초 stall 컷은 DeepSeek
 *   전용이다). `withRetry`는 240초 예산 안에서 5회까지 재시도한다.
 *
 * 합이 18초라 30초에 12초가 남는다 — 그 몫이 DB 읽기와 툴 자체 작업이다. 실측
 * (2026-09-21, LAES) 해피 패스는 적재 3.2초 + 4건 보강 2.86초로 각각 예산의 절반
 * 이하라, 정상 동작은 예산을 건드리지 않는다.
 */
const INGEST_BUDGET_MS = 8_000;
/** 위 `INGEST_BUDGET_MS` 주석 참고 — 같은 이유로 보강에 거는 몫이다. */
const SYNC_ENRICH_BUDGET_MS = 10_000;

type Budgeted<T> = { status: 'done'; value: T } | { status: 'timeout' };

/**
 * `work`를 예산 안에서 기다린다. 넘기면 **기다리기만** 그만둔다 — `work`는 취소
 * 수단이 없어 계속 돌고, 그대로 DB에 기록한다. 호출부가 그 프라미스를 `after()`로
 * 넘겨 응답 이후에 이어받는 것이 이 함수의 전제다.
 *
 * 타이머 핸들을 직접 들고 있다가 해제한다. `sleep()`을 그냥 race에 태우면 work가
 * 2초에 끝나도 남은 타이머가 그만큼 이벤트 루프를 붙잡는다.
 *
 * `work`가 거절하면 이 함수도 거절한다 — 예산 밖의 실패는 호출부 판단이다.
 */
async function withBudget<T>(
    work: Promise<T>,
    budgetMs: number
): Promise<Budgeted<T>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const budget = new Promise<Budgeted<T>>(resolve => {
        timer = setTimeout(() => resolve({ status: 'timeout' }), budgetMs);
    });
    return await Promise.race([
        work.then(value => ({ status: 'done', value }) as const),
        budget,
    ]).finally(() => {
        if (timer !== undefined) clearTimeout(timer);
    });
}

function countChanged(ingested: NonNullable<IngestOutcome>): number {
    return ingested.upsertSettled.filter(
        r => r.status === 'fulfilled' && r.value === true
    ).length;
}

export async function ensureSymbolNewsFresh(
    symbol: string
): Promise<SymbolFreshnessResult> {
    try {
        // Redis 미설정/장애 시 false를 돌려주므로 그때는 항상 적재한다 — 이 경로의
        // 기존 동작(`ensureNewsCardsAnalyzedAction`)과 같다.
        if (await isRecentlyFetched(symbol)) return SKIPPED;

        const { db } = getDatabaseClient();
        const repo = new DrizzleNewsRepository(db);
        // 창을 **명시적으로** 30일로 좁힌다. 기본값은 `NEWS_LOOKBACK_MS`(180일)인데,
        // 이 게이트가 먹여 살리는 소비자는 전부 30일 이하만 읽는다 — `get_news`는
        // 30일로 clamp하고(`MAX_LOOKBACK_MS`), `run_fresh_analysis`의 뉴스 경로는
        // `NEWS_ANALYSIS_LOOKBACK_MS`를 쓴다. 180일치를 받으면 읽지도 않을 기사를
        // Neon에 쓰느라 왕복이 6배가 되는데, 그 비용이 **대화 지연에 그대로 얹힌다**.
        // `prewarmNews`가 cron 경로에서 같은 이유로 이미 좁혀 둔 것을 따른다(감사 F5).
        const ingestion = ingestNewsForSymbol(
            symbol,
            repo,
            NEWS_ANALYSIS_LOOKBACK_MS
        );
        const timed = await withBudget(ingestion, INGEST_BUDGET_MS);
        if (timed.status === 'timeout') {
            // 적재가 예산을 넘겼다. **다시 부르지 않고** 같은 프라미스를 응답
            // 이후로 넘긴다 — FMP 왕복은 여전히 한 번이고, 보강 → 무효화 순서도
            // 그대로 지켜진다. 이번 턴의 답은 DB에 이미 있는 것으로 나간다.
            scheduleRefreshTail(symbol, async () => {
                // 적재 결과를 여기서야 안다. 인라인 경로의 `changedCount === 0`
                // 단락과 **같은 판단**을 여기서 다시 한다 — 안 그러면 적재가
                // 실패(`null`)했거나 새 기사가 없을 때도 태그를 날려, 다음
                // 방문자에게 불필요한 Neon+렌더 재생성을 물린다.
                const ingested = await ingestion;
                if (ingested === null || countChanged(ingested) === 0)
                    return false;
                try {
                    await enrichAll(symbol, repo, ingested);
                } catch (error) {
                    // 기사 원문은 이미 커밋됐다 — 라벨 없이라도 목록에 노출되는
                    // 편이 TTL 내내 숨는 것보다 낫다.
                    console.error(
                        '[ensureSymbolNewsFresh] deferred enrich',
                        symbol,
                        error
                    );
                }
                return true;
            });
            return DEFERRED;
        }

        const ingested = timed.value;
        if (ingested === null) return SKIPPED;

        const changedCount = countChanged(ingested);

        // 실제로 바뀐 행이 있을 때만 후속 작업을 건다. 방문마다 걸면 빈도 폭풍이
        // 되는데, `upsertNewsItem`이 값이 바뀐 행만 RETURNING하므로 같은 기사
        // 재fetch는 changedCount=0이 된다(뉴스 탭 경로와 같은 판단).
        if (changedCount === 0) return { refreshed: true, changedCount };

        // 선별 근거(창 전체 반환·부분 upsert 실패)는 `selectUnanalyzed` 주석에 있다.
        const unanalyzed = selectUnanalyzed(
            ingested.fresh,
            await repo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS)
        );

        /*
         * **신규 기사는 응답 전에 보강한다.** 호출부(`get_news`)가 바로 다음에
         * DB를 읽어 그 턴의 답을 만들기 때문에, 여기서 기다려야 방금 들어온 기사가
         * 한국어 제목·감성·분류를 달고 나간다. 안 기다리면 영문 제목만 나가고
         * 라벨은 다음 읽기부터 붙는다 — 사용자가 "방금 뜬 기사"를 물었을 때 가장
         * 알고 싶은 게 그 라벨이다.
         *
         * 상한이 `CHAT_SYNC_NEWS_CARD_LIMIT`(=동시성 4)인 이유는 그 상수 주석에
         * 있다 — 정확히 한 청크라 대화 지연이 왕복 한 번으로 끝난다.
         */
        const sync = unanalyzed.slice(0, CHAT_SYNC_NEWS_CARD_LIMIT);
        const leftover = unanalyzed.slice(CHAT_SYNC_NEWS_CARD_LIMIT);
        const overrun =
            sync.length > 0
                ? await enrichWithinBudget(sync, repo, symbol)
                : null;

        scheduleRefreshTail(symbol, async () => {
            try {
                // 예산을 넘긴 동기 보강을 **여기서 이어받는다.** 무효화보다 먼저
                // 끝나야 재생성된 캐시가 그 라벨까지 담는다 — 순서 주석 참고.
                if (overrun !== null) await overrun.unfinished;
                if (leftover.length > 0) {
                    await analyzeNewsCards([...leftover], repo, {
                        // 방문자 경로와 같은 상한 — 사용자를 기다리게 하지 않는
                        // 백그라운드 작업이라 prewarm의 12건보다 넉넉해도 된다.
                        limit: VISITOR_NEWS_CARD_LIMIT,
                        logLabel: 'chatNewsRefreshBackground',
                    });
                }
            } catch (error) {
                console.error(
                    '[ensureSymbolNewsFresh] background enrich',
                    symbol,
                    error
                );
            }
            // 여기까지 왔다면 `changedCount > 0`이 이미 확인된 상태다 — 보강이
            // 실패했더라도 새 기사는 커밋됐으므로 무효화한다.
            return true;
        });
        return { refreshed: true, changedCount };
    } catch (error) {
        // NewsIngestWriteError(DB 광역 장애)를 포함해 전부 삼킨다 — 위 계약 참고.
        console.error('[ensureSymbolNewsFresh]', symbol, error);
        return SKIPPED;
    }
}

/**
 * 예산 안에서 보강하고, 넘기면 기다리기를 그만두되 **그 프라미스를 돌려준다.**
 *
 * 돌려주는 게 핵심이다. `analyzeNewsCards`는 취소되지 않으므로 여기서 손을 떼도
 * 계속 돌아 DB에 기록한다 — 호출부가 그걸 `after()`에서 await해야 무효화가 보강
 * **뒤에** 일어난다. 그냥 버리면 무효화가 먼저 나가서 미보강 스냅샷이 TTL 내내
 * 굳는다(이 PR이 없애려던 바로 그 실패다).
 *
 * 다시 부르지 않으므로 LLM 왕복은 한 번뿐이다. 다만 그 사이 행들은 여전히
 * `analyzedAt === null`이라, 겹쳐 도는 prewarm(`isRecentlyFetched` 미참조)이나
 * 방문자 경로(10분 TTL만 봄)가 같은 id를 다시 집으면 그쪽은 별도로 지불한다 —
 * "진행 중" 마커는 이 슬라이스 어디에도 없다.
 *
 * 돌려주는 프라미스를 객체로 **싸는 것은 필수다**. async 함수가 프라미스를 그대로
 * return하면 그 프라미스를 adopt해서, 호출부의 `await`가 예산을 무시하고 끝까지
 * 기다린다 — 예산이 조용히 무력해진다.
 *
 * @returns 예산을 넘겨 아직 도는 작업, 또는 예산 안에 끝났으면 `null`.
 */
async function enrichWithinBudget(
    cards: readonly NewsItem[],
    repo: DrizzleNewsRepository,
    symbol: string
): Promise<{ unfinished: Promise<void> } | null> {
    const enriched = analyzeNewsCards([...cards], repo, {
        limit: CHAT_SYNC_NEWS_CARD_LIMIT,
        logLabel: 'chatNewsRefreshSync',
    }).catch((error: unknown) => {
        // 보강 실패가 뒤따르는 무효화까지 삼키면 안 된다 — 기사 원문은 이미
        // 커밋됐으므로, 라벨 없이라도 목록에 노출되는 편이 12시간 숨는 것보다
        // 낫다. 라벨은 다음 보강 패스가 채운다.
        console.error('[ensureSymbolNewsFresh] sync enrich', symbol, error);
    });
    const outcome = await withBudget(enriched, SYNC_ENRICH_BUDGET_MS);
    if (outcome.status === 'done') return null;
    console.warn(
        '[ensureSymbolNewsFresh] sync enrich budget exceeded',
        symbol,
        {
            budgetMs: SYNC_ENRICH_BUDGET_MS,
            cards: cards.length,
        }
    );
    return { unfinished: enriched };
}

/**
 * 적재가 예산을 넘겨 응답 이후로 넘어간 경우의 보강. 기다리는 사람이 없으므로
 * 동기 경로의 건수 상한(`CHAT_SYNC_NEWS_CARD_LIMIT`) 대신 방문자 경로와 같은
 * 상한을 쓰고, 분할 없이 한 번에 처리한다.
 *
 * 그래서 두 경로의 총 처리량은 다르다 — 인라인은 두 번에 걸쳐 최대
 * `CHAT_SYNC_NEWS_CARD_LIMIT`(4) + `VISITOR_NEWS_CARD_LIMIT`(25) = 29건,
 * 여기는 한 번에 25건이다. 백로그가 그만큼 큰 심볼은 다음 패스가 이어받는다.
 *
 * 호출부가 `ingested !== null && countChanged > 0`을 이미 확인하고 부른다.
 */
async function enrichAll(
    symbol: string,
    repo: DrizzleNewsRepository,
    ingested: NonNullable<IngestOutcome>
): Promise<void> {
    const unanalyzed = selectUnanalyzed(
        ingested.fresh,
        await repo.listBySymbol(symbol, NEWS_ANALYSIS_LOOKBACK_MS)
    );
    if (unanalyzed.length === 0) return;
    await analyzeNewsCards([...unanalyzed], repo, {
        limit: VISITOR_NEWS_CARD_LIMIT,
        logLabel: 'chatNewsRefreshDeferred',
    });
}

/**
 * 남은 수급 작업(`tail`)과 ISR 무효화를 **응답 이후로** 스케줄한다.
 *
 * ## 왜 `after()`인가 — flush 타이밍 문제
 *
 * 이 경로의 호출자는 SSE 스트리밍 라우트(`/api/ai/chat/stream`)이고, 툴은
 * 핸들러가 `Response`를 반환한 **뒤** 스트림을 만들면서 실행된다. 그 자리에서
 * `revalidateTag`를 부르면 **조용히 아무 일도 하지 않는다.**
 *
 * 원인은 요청 컨텍스트가 사라져서가 **아니다**(그랬다면 `after()` 자체가
 * `E468 after was called outside a request scope`로 던졌을 것이고, 아래 try/catch가
 * 그걸 삼켜 이 수정이 조용히 무력해졌을 것이다). `agentEventStream`은
 * `options.work(...)`를 `ReadableStream`의 동기 `start()` 안에서 호출하므로
 * AsyncLocalStorage는 프라미스 체인을 타고 그대로 전파된다.
 *
 * 진짜 원인은 **flush 시점**이다. `revalidateTag`는 `workStore.pendingRevalidatedTags`에
 * push만 하고(`web/spec-extension/revalidate.js`), 실제 반영은
 * `resolvePendingRevalidations()` → `executeRevalidates(workStore)`가 담당하는데
 * 그건 핸들러가 반환하는 순간 이미 실행된다(`route-modules/app-route/module.js`).
 * 스트림 도중의 뒤늦은 push는 flush될 기회가 없다.
 *
 * `after()`가 맞는 seam인 이유가 정확히 그것이다 — `AfterContext.runCallbacks`가
 * 콜백 큐를 `withExecuteRevalidates`로 감싸므로, 그 안에서 부른 `revalidateTag`는
 * 콜백이 끝난 뒤 실제로 flush된다(`after/after-context.js`).
 *
 * 2026-09-21 프로덕션 실측이 증상을 먼저 보여줬다: 챗이 LAES 기사 2건을 적재하고
 * (`fetched_at 14:32:36Z`) `revalidateTag('news:LAES')`를 호출했는데, cacheHandler의
 * 태그 로그(`siglens:isr:tags`, Upstash)에는 그 시각 기록이 없었다 — 마지막 기록이
 * 이틀 전 값 그대로였다. 같은 시각 방문자 경로(Server Action)와 prewarm(일반 라우트
 * 핸들러)이 찍은 `news:SYNX`·`news:NVTS`는 정상 기록됐다. 그래서 뉴스 페이지는 새
 * 기사를 받고도 12시간 TTL까지 옛 목록을 서빙했다.
 *
 * `after()`는 이 레포가 SSE 라우트에서 이미 쓰는 패턴이다
 * (`api/analysis/stream/route.ts`의 `schedulePersistAnalysisHistory`).
 *
 * ## 순서 — 보강을 끝내고 나서 무효화한다
 *
 * `tail`이 먼저 끝나고 그다음 무효화해야, 재생성된 캐시가 라벨까지 담는다. 반대로
 * 하면 무효화 시점의 미보강 스냅샷이 다시 12시간 굳는다. 그래서 예산을 넘긴
 * 작업도 버리지 않고 `tail` 안에서 await한다 — `enrichWithinBudget` 주석 참고.
 *
 * ## 무효화 여부는 `tail`이 정한다
 *
 * `tail`의 반환값이 그 판단이다. 새 기사가 실제로 커밋됐을 때만 `true`를 준다 —
 * 무효화는 공짜가 아니라 다음 방문자에게 Neon 조회와 전체 렌더를 물리므로,
 * "바뀐 게 없는데 날리기"는 그 비용을 이유 없이 내는 것이다. 보강이 실패해도
 * `true`인 경우는 있다(기사 원문은 커밋됐고, 라벨 없이 노출되는 편이 TTL 내내
 * 숨는 것보다 낫다) — 그 판단 역시 `tail` 안에 있다.
 *
 * `tail`이 **던지면** 무효화하지 않는다. 무엇이 커밋됐는지 모르는 상태이므로,
 * 모르면 안 날리는 쪽이 맞다.
 *
 * ## 받아들인 트레이드오프 — 배포 드레인
 *
 * 이 콜백은 SSE 응답이 닫힌 뒤에 돈다. 그 시점엔 `agentEventStream.finish()`가
 * 이미 `registerActiveStream` 드레인 슬롯을 놓은 뒤라, 롤링 배포의 SIGTERM이
 * 이 작업을 기다려 주지 않는다 — 보강 도중 끊길 수 있다.
 *
 * 그래도 슬롯을 붙잡지 않는다. 최악이 "라벨이 다음 패스까지 빈다"뿐이고(기사 원문은
 * 이미 커밋됐다), 반대로 최대 25건의 LLM 왕복만큼 드레인 창을 늘리면 배포가 그만큼
 * 느려진다. 끊긴 심볼은 다음 뉴스 탭 방문이나 prewarm이 같은 보강을 다시 집는다.
 */
function scheduleRefreshTail(
    symbol: string,
    /** 반환값이 무효화 여부다 — 위 "무효화 여부는 `tail`이 정한다" 참고. */
    tail: () => Promise<boolean>
): void {
    const tag = `news:${symbol.toUpperCase()}`;
    try {
        // `after()` 자체가 동기적으로 throw할 수 있다(요청 스코프 밖 호출 등).
        // 이 함수는 절대 throw하지 않는 계약 안에 있으므로 삼키고 로그만 남긴다
        // — `api/analysis/stream/route.ts`의 같은 가드와 동일한 이유다.
        after(async () => {
            let invalidate = false;
            try {
                invalidate = await tail();
            } catch (error) {
                console.error('[scheduleRefreshTail] tail', symbol, error);
            }
            if (invalidate) revalidateTag(tag, 'max');
        });
    } catch (error) {
        console.error('[scheduleRefreshTail] schedule', symbol, error);
    }
}
