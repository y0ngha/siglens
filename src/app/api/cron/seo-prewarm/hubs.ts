import 'server-only';
import { revalidateTag } from 'next/cache';
import {
    peekBriefingCache,
    peekMacroBriefingCacheEntry,
    peekMarketNewsDigestCache,
    runBriefing,
    runMacroBriefing,
    runMarketNewsDigest,
    type EnrichedNewsItem,
    type NewsFeedCategory,
} from '@y0ngha/siglens-core';
import { DASHBOARD_SCOPES } from '@/shared/config/dashboardScope';
import {
    MAX_AGGREGATE_NEWS_ITEMS,
    selectAggregateNewsItems,
} from '@/entities/news-article/lib/newsAnalysisSelection';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '@/entities/market-summary/api/marketSummaryCache';
import { marketBriefingContextOf } from '@/entities/market-summary/lib/marketBriefingContext';
import {
    marketBriefingCacheTag,
    marketBriefingSeedSurface,
} from '@/entities/market-summary/api/briefingStaticCache';
import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';
import {
    MACRO_BRIEFING_CACHE_TAG,
    MACRO_BRIEFING_SEED_SURFACE,
} from '@/entities/economy/api/macroBriefingStaticCache';
import { marketNewsDigestCacheTag } from '@/entities/market-news/api/marketNewsDigestStaticCache';
import {
    getMarketNewsList,
    isCronIngestedRecently,
    markCronIngested,
} from '@/entities/market-news/api/marketNewsRepository';
import { ingestMarketNewsCategory } from '@/entities/market-news/api/ingestMarketNewsCategory';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';
import { toEnrichedMarketNewsItem } from '@/entities/market-news/lib/toEnrichedMarketNewsItem';
import {
    DEFAULT_DIGEST_MODEL_ID,
    DIGEST_REASONING,
} from '@/entities/market-news/lib/marketNewsConstants';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import type { NavRegionId } from '@/shared/config/assetClassNav';
import { SITE_URL } from '@/shared/lib/seo';
import { PREWARM_PROVIDER_FALLBACK } from '@/shared/config/prewarm';
import { writeHubSsrSeed } from '@/shared/cache/hubSsrSeed';
import { recordHubContentStamp } from '@/shared/cache/hubContentStamp';
import {
    economyHubPath,
    marketHubPath,
    newsHubPath,
    RSS_ECONOMY_SURFACE,
    rssMarketSurface,
    rssNewsSurface,
} from '@/entities/rss-feed/model';
import { consumeSsrMiss } from '@/shared/cache/ssrMissMarker';
import { createRedisFlag } from '@/shared/cache/createRedisFlag';
import { SECONDS_PER_HOUR } from '@/shared/config/time';
import { ECONOMY_SNAPSHOT_CACHE_TAG } from '@/entities/economy/api/economySnapshotStaticCache';
import { shouldCacheEconomySnapshot } from '@/entities/economy/lib/economyCompleteness';
import { ingestEconomicCalendar } from '@/entities/economy/api/ingestEconomicCalendar';
import { analyzeEconomicEvents } from '@/entities/economy/api/analyzeEconomicEvents';
import { translateUnresolvedCalendarIndicators } from '@/entities/economy/api/translateIndicators';
import {
    CALENDAR_COUNTRY,
    CALENDAR_COUNTRY_KR,
    economyCalendarCacheTag,
    type CalendarCountry,
} from '@/entities/economy/lib/economyCalendarConstants';

/**
 * 허브 페이지의 AI 콘텐츠를 **서버에서 미리 굽는다**.
 *
 * ## 왜 있는가
 *
 * `/market`·`/economy`·`/news/{category}`의 AI 산문은 전부 `peek*Static`(읽기 전용)로
 * SSR에 실린다. 그 캐시를 채우는 것은 클라이언트가 부르는 생성 액션뿐인데, 크롤러는
 * 그 액션을 부르지 않는다 — 2026-09-18 운영 실측에서 Googlebot은 열 개 URL 전부에서
 * "AI 다이제스트 생성 중이에요…" 같은 플레이스홀더만 받고 있었다. 종목 페이지만
 * 예외였던 이유는 이 크론이 스냅샷을 미리 구워 두기 때문이다. 같은 일을 허브에도 한다.
 *
 * ## 키가 어긋나면 조용히 실패한다
 *
 * core의 캐시 키는 **입력에서 파생**된다(뉴스 배열·요약 데이터·컨텍스트). 그래서 이
 * 모듈은 액션이 쓰는 빌더를 그대로 재사용한다 — 입력을 여기서 다시 조립하면 아무도
 * 읽지 않는 키에 쓰고, 로그는 성공이라고 말하며, 페이지는 영원히 플레이스홀더다.
 * 쓰기 직후 **core의 `peek*Cache`로 되읽어** 그 사고를 잡는다.
 *
 * ⚠️ 되읽기에 `peek*Static`을 쓰면 안 된다. 그쪽은 `unstable_cache`로 감싸져 있어
 * 방금 쓴 값이 아니라 그 전에 캐시된 `null`을 돌려준다 — 정상인데 경보가 뜨고,
 * 반대로 키가 어긋나도 옛 성공값이 남아 있으면 통과한다.
 */

/**
 * 허브 단계 전체의 wall-clock 상한.
 *
 * 심볼 배치의 10분은 이 단계가 끝난 **뒤** 다시 잡히므로(`runPrewarmBatch`) 평소에는
 * 예산이 깎이지 않는다. 대신 락 보유 시간이 두 단계의 합이 되고, 두 마감 모두 유닛
 * **사이**에서만 검사되므로 실제 최악은 `마감 + 그 단계의 유닛 상한`이다:
 * 이 단계 180 + 45, 심볼 600 + 120 = 945초. `LOCK_TTL_SECONDS`(900초)를 넘으므로
 * `runPrewarmBatch`가 심볼 마감을 `BATCH_WALL_CLOCK_BUDGET_MS`(840초) 안으로 자른다.
 * 이 상수를 올리면 잘리는 쪽은 심볼 배치다.
 *
 * 120 → 180초(2026-10-01): 이 단계에 뉴스 카테고리 적재와 경제 캘린더(적재·분석·
 * 지표명 번역)가 붙어 대상당 시간이 늘었다. 120초면 뒤쪽 대상이 첫 tick마다
 * `skippedByDeadline`으로 밀린다. 대신 심볼 쪽 일감은 같은 날 프리웜 탭 축소로
 * 2,742 → 754유닛(약 72% 감소)이 돼, 잘려도 최악 ~495초가 남아 충분하다.
 */
export const HUB_DEADLINE_MS = 180_000;

/**
 * 대상 하나의 상한.
 *
 * 단계 마감(`HUB_DEADLINE_MS`)은 **대상 사이에서만** 검사되므로 한 건이 멎으면
 * 아무것도 못 막는다 — 심볼 프리웜이 `UNIT_TIMEOUT_MS`를 도입한 이유와 같다
 * (`runPrewarmBatch.ts`: 멎은 유닛이 Redis 락을 `LOCK_TTL_SECONDS` 너머까지 붙든다).
 * 여기서도 같은 형태로 개별 호출을 race시킨다. 목적은 작업 취소가 아니라 **슬롯 보호**다.
 */
export const HUB_UNIT_TIMEOUT_MS = 45_000;

/**
 * 되읽기 재시도 간격·횟수.
 *
 * core의 `run*`은 캐시 쓰기를 **await하지 않는다**(`cache.set(...).catch(...)`).
 * 그래서 생성 직후의 읽기는 아직 안 착지한 SET과 경합한다 — 키가 멀쩡한데도 `null`을
 * 읽어 "불일치"로 오보할 수 있다. 짧게 몇 번 다시 읽어 그 창을 덮는다.
 */
const READ_BACK_ATTEMPTS = 4;
const READ_BACK_INTERVAL_MS = 400;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        // unref: race에서 진 타이머가 배치 종료를 붙들지 않게 한다.
        setTimeout(resolve, ms).unref();
    });
}

/**
 * `peek`가 값을 돌려줄 때까지 짧게 재시도한다. 끝내 비면 `null`.
 *
 * 값을 그대로 돌려주는 이유: 브리핑은 이 값을 SSR seed로 한 벌 더 저장한다
 * (`writeHubSsrSeed`). 불린만 돌려주면 호출부가 방금 읽은 본문을 다시 읽어야 한다.
 */
async function readBackWithRetry<T>(
    peek: () => Promise<T | null>
): Promise<T | null> {
    for (let attempt = 0; attempt < READ_BACK_ATTEMPTS; attempt += 1) {
        const value = await peek();
        if (value !== null) return value;
        if (attempt < READ_BACK_ATTEMPTS - 1) {
            await sleep(READ_BACK_INTERVAL_MS);
        }
    }
    return null;
}

/**
 * 대상 하나의 처리 결과.
 *
 * `alreadyFresh`와 `noData`를 `generated`와 **합치지 않는** 이유가 둘 있다.
 *
 * ① ISR 과금: 이 크론은 하룻밤 126번 돈다(`docs/reference/CRON.md`의 EventBridge
 *    규칙 4개). core 캐시가 살아 있으면 `run*`은 즉시 캐시값을 돌려주므로, 그때도
 *    태그를 털면 데이터가 하나도 안 변했는데 무효화만 9 × 126 = 1,134회 나간다 —
 *    MISTAKES.md "ISR & Caching #1"에서 이미 한 번 겪은 과금 패턴이다.
 * ② 조용한 실패: 기사가 0건이면 다이제스트는 만들 게 없다. 그걸 "생성 성공"으로
 *    세면, `getMarketNewsList`가 버그로 빈 배열을 돌려주는 진짜 장애도 로그에
 *    100% 성공으로 찍힌다. 이 기능의 존재 이유가 그 반대다.
 */
type HubOutcome =
    | 'generated'
    | 'alreadyFresh'
    | 'noData'
    | 'keyMismatch'
    /**
     * 쿨다운 중이라 굽지 않았다(시장 브리핑). `alreadyFresh`와 갈라 세는 이유: 그쪽은
     * "값이 있음을 확인했다"는 뜻이라 SSR miss 표시를 소비하고 태그를 턴다. 쿨다운
     * 중에는 값이 있는지 **모른다** — 거기서 털면 페이지가 다시 `null`로 렌더되며
     * 표시를 새로 세우고, 다음 tick이 또 터는 tick당 ISR 쓰기 루프가 된다.
     */
    | 'cooldown';

/**
 * `HubTarget.run`의 반환. `stampChanged`는 이번에 확인한 본문이 **이전 확인과 달라졌는가**
 * (`recordHubContentStamp`가 새 해시를 썼는가) — `alreadyFresh`여도 참일 수 있다(캐시에는
 * 있었지만 RSS·IndexNow가 처음 보는 본문).
 */
interface HubRunResult {
    readonly outcome: HubOutcome;
    readonly stampChanged: boolean;
}

function runResult(outcome: HubOutcome, stampChanged = false): HubRunResult {
    return { outcome, stampChanged };
}

export interface HubPrewarmResult {
    readonly attempted: number;
    readonly generated: number;
    /** 이미 core 캐시에 있어 생성도 무효화도 하지 않은 수. */
    readonly alreadyFresh: number;
    /** 입력 자체가 비어(기사 0건) 만들 게 없던 수. 고장이 아니다. */
    readonly noData: number;
    /** 생성은 됐는데 되읽기에 실패한 수 — 키 불일치 신호. */
    readonly keyMismatch: number;
    readonly failed: number;
    readonly skippedByDeadline: number;
    /** 쿨다운으로 굽지 않은 수(시장 브리핑). */
    readonly skippedByCooldown: number;
    /**
     * 이번에 **새로 구운**(`generated`) 허브의 공개 URL(절대 URL).
     *
     * IndexNow 제출용이다(`indexNowSubmission.ts`). `alreadyFresh`·`keyMismatch`·
     * `cooldown`은 싣지 않는다 — 검색엔진에 "바뀌었다"고 알릴 근거가 없고, 같은 URL을
     * tick마다 다시 보내면 제출 한도만 쓴다. 이 목록은 정적 sitemap과 대조해 걸러진 뒤에
     * 제출되므로 여기서는 sitemap 판정을 반복하지 않는다.
     */
    readonly generatedUrls: readonly string[];
    /**
     * 본문이 바뀐 것으로 확인됐지만 **새로 굽지는 않은**(`alreadyFresh` + 스탬프 변경) 허브의
     * 공개 URL. `generatedUrls`와 겹치지 않는다. 크론이 태그를 털지 않았으므로 IndexNow 지연이
     * 더 길다(`indexNowDelays`).
     */
    readonly changedUrls: readonly string[];
}

interface HubTarget {
    readonly label: string;
    readonly run: () => Promise<HubRunResult>;
    /** 새로 구웠을 때만 털 태그 — 이걸 안 털면 `peek*Static`이 TTL 내내 옛 `null`을 준다. */
    readonly tag: string;
    /**
     * 대상이 실제 변경이 있을 때 **스스로** 태그를 턴다(경제 캘린더 — 내부 함수가
     * 방문자 경로와 같은 무효화를 이미 한다). 러너는 이 대상의 태그를 다시 털지 않고,
     * SSR miss 표시도 보지 않는다 — 이 태그엔 표시를 세우는 렌더 경로가 없다.
     */
    readonly selfInvalidating?: true;
    /**
     * 이 대상이 채우는 허브 페이지의 경로(`/market/kr`). 화면이 없으면 `null`.
     *
     * 경로는 내비 단일 소스(`assetClassNav`)·카테고리 설정에서 파생한다 — sitemap 빌더가
     * 같은 소스에서 URL을 만들므로, 여기서 따로 적으면 sitemap 대조에서 조용히 탈락한다.
     */
    readonly path: string | null;
}

/**
 * 시장 브리핑의 크론 생성 간격(1시간, 시장별).
 *
 * 브리핑의 core 캐시 키는 시세 요약(`MarketSummaryData`)에서 파생된다. 장이 열려 있는
 * 동안은 요약이 tick마다 바뀌어 키가 갈리고, 이 단계는 5분마다 새로 구웠다 — 크론 창
 * 일부가 KRX·미국 장중과 겹친다(설계 문서 "비용" 절이 미뤄 둔 그 위험). 페이지 ISR이
 * 1시간이라 그보다 자주 구워도 화면에는 시간당 한 벌만 나간다. 방문자 생성 경로
 * (`submitMarketBriefingAction`)는 건드리지 않는다.
 */
const MARKET_BRIEFING_COOLDOWN_SECONDS = SECONDS_PER_HOUR;

const marketBriefingCooldown = createRedisFlag(
    (scopeId: string) => `hub-prewarm:market-briefing-cooldown:${scopeId}`,
    MARKET_BRIEFING_COOLDOWN_SECONDS,
    '[hub-prewarm:market-briefing-cooldown]'
);

/**
 * 확인한 본문의 스탬프를 남긴다 — RSS `pubDate`의 근거(`hubContentStamp`).
 *
 * `generated`·`alreadyFresh` 둘 다에서 부른다: 본문이 바뀐 순간만 시각이 갱신되므로
 * (같은 해시면 no-op) 확인할 때마다 불러도 비용은 Redis GET 한 번이다. 이미 캐시에 있던
 * 본문도 스탬프가 없으면 이 호출이 처음 시각을 찍는다 — 배포 직후 첫 tick에 항목이 생긴다.
 * `cooldown`·`noData`·`keyMismatch`에서는 확인된 본문이 없으므로 부르지 않는다.
 */
function stampBody(
    surface: string,
    body: unknown,
    now: () => number
): Promise<boolean> {
    return recordHubContentStamp(surface, body, new Date(now()));
}

function marketBriefingTargets(now: () => number): HubTarget[] {
    // 화면이 없는 scope는 뺀다. 이 순회는 브리핑을 **생성**하므로(LLM 호출),
    // 아무도 읽지 않는 시장이 끼면 매일 밤 그만큼 돈이 나간다.
    return Object.values(DASHBOARD_SCOPES)
        .filter(scope => scope.hasHubPage)
        .map(scope => ({
            label: `market-briefing:${scope.id}`,
            tag: marketBriefingCacheTag(scope),
            path: marketHubPath(scope.id),
            run: async () => {
                const summary = await getCachedMarketSummary(
                    marketDataProviderFor(scope.id),
                    scope
                );
                // context는 캐시 키에 접힌다 — 액션·peek와 **같은 헬퍼**여야 한다.
                const context = marketBriefingContextOf(scope, summary);
                const surface = marketBriefingSeedSurface(scope);
                const stampSurface = rssMarketSurface(scope.id);
                const peek = () => peekBriefingCache(summary, context);
                const cached = await peek();
                if (cached !== null) {
                    // 이미 손에 있는 값이다 — seed를 최신으로 유지하는 비용은 SET 한 번.
                    await writeHubSsrSeed(surface, cached);
                    return runResult(
                        'alreadyFresh',
                        await stampBody(stampSurface, cached, now)
                    );
                }
                // 페이지 peek는 키가 빗나가도 직전에 써 둔 SSR seed로 물러나므로 화면은
                // 대개 그 브리핑을 보여 준다 — 다만 값이 있는지 확인한 건 아니라
                // `alreadyFresh`가 아니다(`HubOutcome`의 `cooldown` 주석).
                if (await marketBriefingCooldown.isSet(scope.id)) {
                    return runResult('cooldown');
                }
                await runBriefing(summary, context);
                // 생성 시도 직후에 세운다 — 되읽기 실패(`keyMismatch`)여도 LLM 비용은 이미
                // 나갔으므로, 다음 tick에 같은 호출을 반복하지 않게 한다.
                await marketBriefingCooldown.mark(scope.id);
                const readBack = await readBackWithRetry(peek);
                if (readBack === null) return runResult('keyMismatch');
                await writeHubSsrSeed(surface, readBack);
                return runResult(
                    'generated',
                    await stampBody(stampSurface, readBack, now)
                );
            },
        }));
}

/**
 * `/economy`가 quorum 미달 스냅샷으로 렌더된 적이 있으면, 지금 스냅샷이 완전할 때
 * 그 페이지를 다시 생성시킨다.
 *
 * 정적 스냅샷 캐시는 이제 미달 스냅샷을 저장하지 않지만(`getEconomySnapshotStatic`),
 * 그 렌더의 HTML은 페이지 ISR(24h) 동안 남는다. 예전에는 `economy:snapshot` 태그를
 * 터는 곳이 없어 FMP 일시 장애 한 번이 하루짜리 `EconomyDegraded`+noindex가 됐다
 * (2026-10-01 허브 감사 B1). 미달 렌더가 실제로 있었을 때만 표시가 남으므로
 * (`markSsrMiss`) 매 tick 털지 않는다.
 */
async function repairDegradedEconomySnapshot(
    snapshot: Awaited<ReturnType<typeof getEconomySnapshot>>
): Promise<void> {
    if (!shouldCacheEconomySnapshot(snapshot)) return;
    if (await consumeSsrMiss(ECONOMY_SNAPSHOT_CACHE_TAG)) {
        revalidateTag(ECONOMY_SNAPSHOT_CACHE_TAG, 'max');
    }
}

/**
 * 경제 캘린더 이벤트 분석 상한 — `CALENDAR_ANALYSIS_PARALLEL_LIMIT`(4)와 같아 **한 청크**.
 *
 * 이 대상 하나가 적재(FMP + upsert, 수 초) + 분석 + 번역을 `HUB_UNIT_TIMEOUT_MS`(45초)
 * 안에 끝내야 한다. DeepSeek 왕복 실측 4~13초 기준 최악: 적재 ~5 + 분석 1청크 ~13 +
 * 번역 1건 ~13 ≈ 31초. 두 청크·번역 3건이면 ~65초로 넘친다 — 넘치면 러너가 실패로
 * 세고, 끊기지 않은 작업이 다음 대상과 겹쳐 돈다. 남은 이벤트·이름은 각 플래그
 * (분석 30분, 번역 이름별)가 풀린 뒤 다음 tick이 이어받는다.
 */
const HUB_CALENDAR_ANALYSIS_LIMIT = 4;

/** 지표명 번역 상한 — 1건. 근거는 {@link HUB_CALENDAR_ANALYSIS_LIMIT} 주석의 예산. */
const HUB_INDICATOR_TRANSLATION_LIMIT = 1;

/** 캘린더 국가 → 허브 지역. 국가가 늘면 컴파일러가 여기서 막는다(조용히 미국으로 떨어지지 않게). */
const CALENDAR_COUNTRY_REGION: Record<CalendarCountry, NavRegionId> = {
    US: 'us',
    KR: 'kr',
};

/** 캘린더를 굽는 국가 — `/economy`(미국)와 `/economy/kr`. */
const CALENDAR_COUNTRIES = [CALENDAR_COUNTRY, CALENDAR_COUNTRY_KR] as const;

/**
 * 국가별 경제 캘린더를 **적재 → 이벤트 분석 → 지표명 번역** 순으로 채운다.
 *
 * 세 단계 모두 예전엔 방문자 브라우저가 `/economy`·`/economy/kr`을 열 때만 돌았다
 * (`useEconomicCalendarTrigger`, `useIndicatorTranslationTrigger`). 그래서 방문 전에는
 * 캘린더·한국 지표 카드(같은 테이블에서 파생)가 비고, 발표 해설이 없고, 지표명이
 * 영어였다(2026-10-01 허브 감사 A1·A2). 뉴스 카테고리 적재와 같은 처방이다.
 *
 * 간격은 각 단계의 기존 플래그가 맡는다(캘린더 60분, 분석 30분, 번역은 이름별
 * pending 플래그) — 크론이 5분마다 와도 FMP·LLM 호출은 그 주기로 묶인다. 분석·번역
 * 대상은 새로 발표·등장한 것뿐이라 비용도 신규 건수에 비례한다.
 *
 * 각 단계는 앞 단계가 실패해도 진행한다(fail-open) — DB에 이미 있는 행으로 분석·번역할
 * 수 있다. 무효화는 각 함수가 실제 변경이 있을 때 직접 한다(`selfInvalidating`).
 */
function economyCalendarTargets(): HubTarget[] {
    return CALENDAR_COUNTRIES.map(country => ({
        label: `economy-calendar:${country}`,
        tag: economyCalendarCacheTag(country),
        selfInvalidating: true,
        // 캘린더는 `/economy`(US)·`/economy/kr`(KR) 페이지를 채운다.
        path: economyHubPath(CALENDAR_COUNTRY_REGION[country]),
        run: async () => {
            const logLabel = `hub-prewarm:economy-calendar:${country}`;
            const ingested = await ingestEconomicCalendar(
                country,
                logLabel
            ).catch((error: unknown) => {
                console.error(`[${logLabel}] ingest threw`, error);
                return null;
            });
            const analyzed = await analyzeEconomicEvents(country, {
                limit: HUB_CALENDAR_ANALYSIS_LIMIT,
                logLabel,
            }).catch((error: unknown) => {
                console.error(`[${logLabel}] analysis threw`, error);
                return null;
            });
            const translated = await translateUnresolvedCalendarIndicators(
                country,
                { limit: HUB_INDICATOR_TRANSLATION_LIMIT, logLabel }
            ).catch((error: unknown) => {
                console.error(`[${logLabel}] translation threw`, error);
                return 0;
            });
            console.log(
                `[${logLabel}] ${JSON.stringify({ ingested, analyzed, translated })}`
            );
            // 적재와 분석이 **둘 다** 실패했으면 실패로 센다 — 그대로 `alreadyFresh`로
            // 두면 FMP·DB 장애가 로그에 "캐시 신선"으로 찍혀 묻힌다(`HubOutcome` 주석의
            // 경계와 같다). 한쪽이라도 정상이면 fail-open으로 계속 간다.
            const ingestFailed =
                ingested === null ||
                ingested.status === 'fetch-failed' ||
                ingested.status === 'write-failed';
            if (ingestFailed && analyzed === null) {
                throw new Error(
                    `economy calendar ${country}: ingest and analysis both failed`
                );
            }
            const changed =
                (ingested?.status === 'ok' && ingested.changed > 0) ||
                (analyzed?.status === 'ok' && analyzed.persisted > 0) ||
                translated > 0;
            return runResult(changed ? 'generated' : 'alreadyFresh');
        },
    }));
}

function macroBriefingTarget(now: () => number): HubTarget {
    return {
        label: 'macro-briefing',
        tag: MACRO_BRIEFING_CACHE_TAG,
        // 거시 브리핑은 시장 구분이 없어 미국 경제 허브(`/economy`)에 실린다.
        path: economyHubPath('us'),
        run: async () => {
            const snapshot = await getEconomySnapshot();
            await repairDegradedEconomySnapshot(snapshot);
            const peek = () => peekMacroBriefingCacheEntry(snapshot);
            // seed에는 본문과 함께 생성 시각을 둔다 — 화면이 seed로 그려진 브리핑에도
            // "생성 시각"을 보여 준다. RSS 스탬프 해시는 본문(briefing)만 대조한다.
            const cached = await peek();
            if (cached !== null) {
                await writeHubSsrSeed(MACRO_BRIEFING_SEED_SURFACE, cached);
                return runResult(
                    'alreadyFresh',
                    await stampBody(RSS_ECONOMY_SURFACE, cached.briefing, now)
                );
            }
            await runMacroBriefing(snapshot);
            const readBack = await readBackWithRetry(peek);
            if (readBack === null) return runResult('keyMismatch');
            await writeHubSsrSeed(MACRO_BRIEFING_SEED_SURFACE, readBack);
            return runResult(
                'generated',
                await stampBody(RSS_ECONOMY_SURFACE, readBack.briefing, now)
            );
        },
    };
}

/**
 * 다이제스트 카드 보강 상한 — `LLM_PARALLEL_LIMIT`(8)와 같아 **한 청크**로 끝난다.
 *
 * 대상 하나에는 `HUB_UNIT_TIMEOUT_MS`(45초) 상한이 있고, 그 안에 적재(FMP 1~3초 +
 * upsert) + 보강 + 다이제스트 LLM이 모두 들어가야 한다. DeepSeek 왕복 실측 4~13초라
 * 한 청크면 최악 ~13초, 두 청크면 다이제스트 몫이 위태롭다. 백로그는 다음 적재 때
 * 이어서 보강된다 — 보강된 기사가 다이제스트 상한(25건)에 못 미치는 동안은 3시간
 * 플래그를 세우지 않아 다음 tick(방문자용 10분 플래그 주기)에 곧바로 이어 받고, 상한에
 * 닿으면 백로그가 남아도 3시간 간격으로 돌아간다(`ingestCategoryBeforeDigest` 참고).
 */
const HUB_NEWS_CARD_LIMIT = 8;

/**
 * 다이제스트를 굽기 **전에** 그 카테고리 기사를 적재한다.
 *
 * 예전 허브 단계는 DB만 읽었다. 기사를 넣는 건 방문자 브라우저뿐이라, 찾는 사람이
 * 적은 `forex`·`articles`는 몇 주씩 비었고(다이제스트도 `noData`), 방문이 한 번
 * 생기면 "다이제스트는 있는데 목록은 비어 있는" 화면이 나왔다 — 목록 캐시 태그를
 * 터는 건 적재 쪽인데 이 단계는 적재를 안 했기 때문이다. 종목 뉴스 프리웜
 * (`prewarmNews`)과 같은 "ingest-before-read" 순서로 맞춘다.
 *
 * 간격은 `MARKET_NEWS_CRON_INGEST_INTERVAL_SECONDS`(3시간)로 묶는다 — 근거는 그
 * 상수 주석(새 기사 = 다이제스트 재생성). 표시는 적재가 실제로 끝나고(`ok`) 보강
 * 백로그가 비었거나 다이제스트에 쓸 만큼 보강됐을 때 한다: 피드·쓰기 실패나 아직
 * 모자란 백로그면 다시 시도한다(방문자용 10분 플래그가 그 사이 FMP 연타를 막는다).
 *
 * fail-open: 적재가 어떻게 실패해도 다이제스트는 DB에 이미 있는 기사로 계속 간다.
 */
async function ingestCategoryBeforeDigest(
    category: NewsFeedCategoryId,
    sentinel: string
): Promise<void> {
    if (await isCronIngestedRecently(sentinel)) return;
    const result = await ingestMarketNewsCategory(category, {
        analyzeLimit: HUB_NEWS_CARD_LIMIT,
        logLabel: `hub-prewarm:news-ingest:${category}`,
    }).catch((error: unknown) => {
        console.error(
            `[hub-prewarm] news ingest threw: ${category} — 다이제스트는 DB 기사로 계속한다`,
            error
        );
        return null;
    });
    if (result === null) return;
    console.log(
        `[hub-prewarm] news ingest ${category}: ${JSON.stringify(result)}`
    );
    // `recently-fetched`로는 표시하지 않는다 — 10분 플래그는 적재 **시작** 시점에
    // 세워지므로, 직전 tick의 피드 실패도 이 상태로 보인다. 그걸 완료로 치면 실패
    // 하나가 3시간 공백이 된다. 다음 tick에 다시 묻는 비용은 Redis GET 한 번이다.
    //
    // 보강 백로그(`pending`)가 남아 있으면 세우지 않고 다음 tick(방문자용 10분 플래그
    // 주기)에 이어 비운다. 세우면 상한 8건이 3시간마다 하나씩만 비워져, 몇 주 비어 있던
    // 카테고리(`forex`·`articles`)의 첫 적재가 하루 가까이 걸린다.
    //
    // **단, 다이제스트에 쓸 만큼 보강됐으면 백로그가 남아도 세운다.** `pending`만 보면
    // 빠른 피드는 영원히 안 끝난다 — 2026-10-01 운영 실측에서 `stock`·`crypto`는 10분마다
    // 새 기사가 10~50건 들어와 `pending`이 한 시간 내내 26~42였고, 그동안 10분마다
    // 재적재·카드 보강 8건·다이제스트 재생성이 돌았다(3시간 간격이 무력화). 다이제스트는
    // 보강된 기사 중 영향도 순 상위 `MAX_AGGREGATE_NEWS_ITEMS`건만 쓰므로, 그만큼 채워졌으면
    // 다이제스트를 구울 재료는 충분하다. **대가**: 아직 보강 안 된 새 기사 중 영향도가 더
    // 큰 것이 있어도 다음 적재(최대 3시간 뒤)나 방문자 경로가 보강할 때까지 다이제스트에
    // 반영되지 않는다 — 10분마다 재생성하는 비용과 맞바꾼 지연이다.
    const backlogDrained = result.status === 'ok' && result.pending === 0;
    const enoughForDigest =
        result.status === 'ok' && result.enriched >= MAX_AGGREGATE_NEWS_ITEMS;
    if (backlogDrained || enoughForDigest) {
        await markCronIngested(sentinel);
    }
}

function newsDigestTargets(now: () => number): HubTarget[] {
    // safe: CATEGORY_CONFIG is Record<NewsFeedCategoryId, CategoryConfig>, so
    // Object.keys is exactly the union members — TS just widens to string[].
    return (Object.keys(CATEGORY_CONFIG) as NewsFeedCategoryId[]).map(
        category => ({
            label: `news-digest:${category}`,
            tag: marketNewsDigestCacheTag(category),
            path: newsHubPath(category),
            run: async () => {
                const { sentinel, koLabel } = CATEGORY_CONFIG[category];
                await ingestCategoryBeforeDigest(category, sentinel);
                const rows = await getMarketNewsList(sentinel);
                const enriched = rows
                    .map(toEnrichedMarketNewsItem)
                    .filter((item): item is EnrichedNewsItem => item !== null);
                const news = selectAggregateNewsItems(enriched);
                if (news.length === 0) {
                    // 기사가 하나도 없으면 다이제스트도 없다. 실패가 아니라 할 일
                    // 없음이다 — 다만 `generated`와는 갈라 센다(HubOutcome 주석 ②).
                    return runResult('noData');
                }
                const options = {
                    // `'kr'`은 core union 밖이지만 core가 값으로 분기하지 않고
                    // 문자열로만 흘린다 — 근거는 `submitMarketNewsDigestAction` 주석.
                    category: category as NewsFeedCategory,
                    locale: DEFAULT_LOCALE,
                    categoryLabel: koLabel,
                    modelId: DEFAULT_DIGEST_MODEL_ID,
                    news,
                    // 액션과 같은 값이어야 한다 — 캐시 키 성분이다.
                    reasoning: DIGEST_REASONING,
                } as const;
                // `options`를 peek에도 그대로 넘긴다. `categoryLabel`은 키 성분이
                // 아니지만(`marketNewsDigestStaticCache.ts`의 peek 헬퍼는 그래서
                // 아예 빼 둔다), 여기서는 **run과 완전히 같은 객체**를 쓰는 것이
                // 목적이다 — 되읽기가 잡으려는 사고가 바로 "run과 peek의 입력이
                // 갈려 키가 어긋나는 것"이라, 한쪽만 손질하면 그 검증이 약해진다.
                const peek = () => peekMarketNewsDigestCache(options);
                const stampSurface = rssNewsSurface(category);
                const cached = await peek();
                if (cached !== null) {
                    return runResult(
                        'alreadyFresh',
                        await stampBody(stampSurface, cached, now)
                    );
                }
                // 프로바이더 폴백은 **키 성분이 아니다.** 이 레포의 모든 프리웜·
                // 백필 호출부가 켜 두는 값이고, core JSDoc도 "SEO prewarm"을 그
                // 대상으로 명시한다 — 지켜보는 사람이 없어 수동 재시도가 불가능한
                // 경로라 DeepSeek가 흔들리면 Gemini로 넘어가야 한다.
                await runMarketNewsDigest({
                    ...options,
                    providerFallback: PREWARM_PROVIDER_FALLBACK,
                });
                // 다이제스트는 seed를 두지 않는다 — 입력이 DB 행 목록이라 분 단위로
                // 안 움직이고, 정적 peek이 같은 쿼리로 입력을 다시 만들어 키가 맞는다.
                const readBack = await readBackWithRetry(peek);
                if (readBack === null) return runResult('keyMismatch');
                return runResult(
                    'generated',
                    await stampBody(stampSurface, readBack, now)
                );
            },
        })
    );
}

/**
 * 색인 대상 로케일(`ko`)만 굽는다. 다른 로케일은 어차피 noindex라 비용만 4배가 된다.
 */
export function hubTargets(now: () => number = Date.now): readonly HubTarget[] {
    return [
        ...marketBriefingTargets(now),
        macroBriefingTarget(now),
        ...economyCalendarTargets(),
        ...newsDigestTargets(now),
    ];
}

/**
 * 허브 대상을 순차로 굽는다.
 *
 * 순차인 이유: 대상이 십여 개(`hubTargets`)라 병렬화 이득이 작고, 동시에 LLM 여러 건을 던지면 프로바이더
 * 레이트리밋에 걸려 전부 실패할 수 있다. 실패는 대상 단위로 격리해 하나가 죽어도
 * 나머지와 뒤따르는 심볼 배치가 계속 돈다.
 */
export async function runHubPrewarm(
    now: () => number = Date.now
): Promise<HubPrewarmResult> {
    const startedAt = now();
    const targets = hubTargets(now);
    let generated = 0;
    let alreadyFresh = 0;
    let noData = 0;
    let keyMismatch = 0;
    let failed = 0;
    let skippedByDeadline = 0;
    let skippedByCooldown = 0;
    let generatedUrls: readonly string[] = [];
    let changedUrls: readonly string[] = [];

    /**
     * 새로 구운 대상의 공개 URL을 모은다. 화면 없는 대상(`path: null`)은 건너뛴다.
     * 거시 브리핑과 미국 캘린더처럼 두 대상이 같은 페이지(`/economy`)를 가리킬 수 있어
     * 이미 담긴 URL은 다시 넣지 않는다.
     */
    const recordGenerated = (target: HubTarget): void => {
        if (target.path === null) return;
        const url = `${SITE_URL}${target.path}`;
        if (generatedUrls.includes(url)) return;
        generatedUrls = [...generatedUrls, url];
    };
    /**
     * 새로 굽진 않았지만 본문이 바뀐 것으로 확인된 허브의 URL. 같은 페이지를 가리키는 다른
     * 대상이 새로 구웠다면(`generatedUrls`) 이미 알림 대상이라 여기에는 넣지 않는다.
     */
    const recordChanged = (target: HubTarget): void => {
        if (target.path === null) return;
        const url = `${SITE_URL}${target.path}`;
        if (generatedUrls.includes(url) || changedUrls.includes(url)) return;
        changedUrls = [...changedUrls, url];
    };

    for (const target of targets) {
        if (now() - startedAt >= HUB_DEADLINE_MS) {
            skippedByDeadline += 1;
            continue;
        }
        try {
            // 개별 호출을 상한으로 감싼다 — 단계 마감은 대상 **사이**에서만 보므로
            // 한 건이 멎으면 아무것도 못 막는다(`HUB_UNIT_TIMEOUT_MS` 주석).
            const { outcome, stampChanged } = await Promise.race([
                target.run(),
                sleep(HUB_UNIT_TIMEOUT_MS).then<never>(() => {
                    throw new Error(
                        `unit timeout ${HUB_UNIT_TIMEOUT_MS}ms: ${target.label}`
                    );
                }),
            ]);

            if (outcome === 'cooldown') {
                // 값이 있는지 확인하지 않았다 — 표시도 태그도 건드리지 않는다.
                skippedByCooldown += 1;
                continue;
            }
            if (target.selfInvalidating === true) {
                // 대상이 실제 변경 때 스스로 털었다. 여기서 또 털면 같은 태그를 두 번
                // 무효화하고, 이 태그엔 SSR miss 표시도 없어 getdel만 헛돈다.
                if (outcome === 'generated') {
                    generated += 1;
                    recordGenerated(target);
                } else alreadyFresh += 1;
                continue;
            }
            if (outcome === 'alreadyFresh') {
                alreadyFresh += 1;
                if (stampChanged) recordChanged(target);
                // 값은 이미 있는데 페이지가 비어 있는 채로 렌더된 적이 있으면(방문자가
                // 먼저 생성했거나 렌더 직후 캐시가 찼다) 그때만 턴다 — `markSsrMiss`
                // JSDoc. 무조건 털면 tick마다 ISR 쓰기가 나간다.
                if (await consumeSsrMiss(target.tag)) {
                    revalidateTag(target.tag, 'max');
                }
                continue;
            }
            if (outcome === 'noData') {
                noData += 1;
                continue;
            }

            // **새로 구웠으면 되읽기 결과와 무관하게 태그를 턴다.**
            // 무효화는 멱등이고(페이지가 다시 렌더되며 peek를 한 번 더 한다) 비용이
            // 거의 없다. 반대로 되읽기가 경합으로 한 번 비었다고 태그를 안 털면,
            // 실제로는 캐시에 값이 있는데 페이지는 TTL 내내 플레이스홀더를 계속
            // 렌더한다 — 이 기능이 고치려던 바로 그 증상이다.
            revalidateTag(target.tag, 'max');
            // 방금 털었으니 남아 있던 빈 렌더 표시는 해소됐다 — 다음 tick이 같은 태그를
            // 한 번 더 털지 않게 비운다.
            await consumeSsrMiss(target.tag);
            if (outcome === 'generated') {
                generated += 1;
                recordGenerated(target);
            } else {
                keyMismatch += 1;
                console.error(
                    `[hub-prewarm] key mismatch — 생성 후 되읽기 실패: ${target.label}`
                );
            }
        } catch (error) {
            failed += 1;
            console.error(`[hub-prewarm] failed: ${target.label}`, error);
        }
    }

    return {
        attempted: targets.length - skippedByDeadline,
        generated,
        alreadyFresh,
        noData,
        keyMismatch,
        failed,
        skippedByDeadline,
        skippedByCooldown,
        generatedUrls,
        // 같은 tick에 다른 대상이 같은 페이지를 새로 구웠다면 그쪽이 이긴다.
        changedUrls: changedUrls.filter(url => !generatedUrls.includes(url)),
    };
}
