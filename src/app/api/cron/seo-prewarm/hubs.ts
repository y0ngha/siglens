import { revalidateTag } from 'next/cache';
import {
    peekBriefingCache,
    peekMacroBriefingCache,
    peekMarketNewsDigestCache,
    runBriefing,
    runMacroBriefing,
    runMarketNewsDigest,
    type EnrichedNewsItem,
    type NewsFeedCategory,
} from '@y0ngha/siglens-core';
import { DASHBOARD_SCOPES } from '@/shared/config/dashboardScope';
import { selectAggregateNewsItems } from '@/entities/news-article';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '@/entities/market-summary/api/marketSummaryCache';
import { marketBriefingContextOf } from '@/entities/market-summary/lib/marketBriefingContext';
import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';
import { getMarketNewsList } from '@/entities/market-news/api';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '@/entities/market-news';
import { toEnrichedMarketNewsItem } from '@/entities/market-news/lib/toEnrichedMarketNewsItem';
import { DEFAULT_DIGEST_MODEL_ID } from '@/entities/market-news/lib/marketNewsConstants';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { PREWARM_PROVIDER_FALLBACK } from '@/shared/config/prewarm';

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
 * 심볼 배치의 10분은 이 단계가 끝난 **뒤** 다시 잡히므로(`runPrewarmBatch`) 예산이
 * 깎이지 않는다. 대신 락 보유 시간이 두 단계의 합이 되니, 지켜야 할 조건은
 * `허브 + 심볼 < LOCK_TTL_SECONDS(900초)`다 — 최악 165초(이 마감 120초 + 이미
 * 시작된 대상의 유닛 타임아웃 45초) + 600초 = 765초로 여유가 있다.
 */
export const HUB_DEADLINE_MS = 120_000;

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
 * `peek`가 값을 돌려줄 때까지 짧게 재시도한다. 끝내 비면 `false`.
 */
async function readBackWithRetry(
    peek: () => Promise<unknown>
): Promise<boolean> {
    for (let attempt = 0; attempt < READ_BACK_ATTEMPTS; attempt += 1) {
        if ((await peek()) !== null) return true;
        if (attempt < READ_BACK_ATTEMPTS - 1) {
            await sleep(READ_BACK_INTERVAL_MS);
        }
    }
    return false;
}

export interface HubPrewarmResult {
    readonly attempted: number;
    readonly generated: number;
    /** 생성은 됐는데 되읽기에 실패한 수 — 키 불일치 신호. */
    readonly keyMismatch: number;
    readonly failed: number;
    readonly skippedByDeadline: number;
}

interface HubTarget {
    readonly label: string;
    /** 생성 + 되읽기. 되읽힌 값이 있으면 `true`. */
    readonly run: () => Promise<boolean>;
    /** 성공 후 털 태그 — 이걸 안 털면 `peek*Static`이 TTL 내내 옛 `null`을 준다. */
    readonly tag: string;
}

function marketBriefingTargets(): HubTarget[] {
    return Object.values(DASHBOARD_SCOPES).map(scope => ({
        label: `market-briefing:${scope.id}`,
        tag: `market:briefing:${scope.id}`,
        run: async () => {
            const summary = await getCachedMarketSummary(
                marketDataProviderFor(scope.id),
                scope
            );
            // context는 캐시 키에 접힌다 — 액션·peek와 **같은 헬퍼**여야 한다.
            const context = marketBriefingContextOf(scope, summary);
            await runBriefing(summary, context);
            return readBackWithRetry(() => peekBriefingCache(summary, context));
        },
    }));
}

function macroBriefingTarget(): HubTarget {
    return {
        label: 'macro-briefing',
        tag: 'economy:briefing',
        run: async () => {
            const snapshot = await getEconomySnapshot();
            await runMacroBriefing(snapshot);
            return readBackWithRetry(() => peekMacroBriefingCache(snapshot));
        },
    };
}

function newsDigestTargets(): HubTarget[] {
    return (Object.keys(CATEGORY_CONFIG) as NewsFeedCategoryId[]).map(
        category => ({
            label: `news-digest:${category}`,
            tag: `market-news:digest:${category}`,
            run: async () => {
                const { sentinel, koLabel } = CATEGORY_CONFIG[category];
                const rows = await getMarketNewsList(sentinel);
                const enriched = rows
                    .map(toEnrichedMarketNewsItem)
                    .filter((item): item is EnrichedNewsItem => item !== null);
                const news = selectAggregateNewsItems(enriched);
                if (news.length === 0) {
                    // 기사가 하나도 없으면 다이제스트도 없다. 실패가 아니라 할 일 없음.
                    return true;
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
                    reasoning: true,
                } as const;
                // 프로바이더 폴백은 **키 성분이 아니다.** 이 레포의 모든 프리웜·
                // 백필 호출부가 켜 두는 값이고, core JSDoc도 "SEO prewarm"을 그
                // 대상으로 명시한다 — 지켜보는 사람이 없어 수동 재시도가 불가능한
                // 경로라 DeepSeek가 흔들리면 Gemini로 넘어가야 한다.
                await runMarketNewsDigest({
                    ...options,
                    providerFallback: PREWARM_PROVIDER_FALLBACK,
                });
                return readBackWithRetry(() =>
                    peekMarketNewsDigestCache(options)
                );
            },
        })
    );
}

/**
 * 색인 대상 로케일(`ko`)만 굽는다. 다른 로케일은 어차피 noindex라 비용만 4배가 된다.
 */
export function hubTargets(): readonly HubTarget[] {
    return [
        ...marketBriefingTargets(),
        macroBriefingTarget(),
        ...newsDigestTargets(),
    ];
}

/**
 * 허브 대상을 순차로 굽는다.
 *
 * 순차인 이유: 열 개뿐이라 병렬화 이득이 작고, 동시에 LLM 열 건을 던지면 프로바이더
 * 레이트리밋에 걸려 전부 실패할 수 있다. 실패는 대상 단위로 격리해 하나가 죽어도
 * 나머지와 뒤따르는 심볼 배치가 계속 돈다.
 */
export async function runHubPrewarm(
    now: () => number = Date.now
): Promise<HubPrewarmResult> {
    const startedAt = now();
    const targets = hubTargets();
    let generated = 0;
    let keyMismatch = 0;
    let failed = 0;
    let skippedByDeadline = 0;

    for (const target of targets) {
        if (now() - startedAt >= HUB_DEADLINE_MS) {
            skippedByDeadline += 1;
            continue;
        }
        try {
            // 개별 호출을 상한으로 감싼다 — 단계 마감은 대상 **사이**에서만 보므로
            // 한 건이 멎으면 아무것도 못 막는다(`HUB_UNIT_TIMEOUT_MS` 주석).
            const readBack = await Promise.race([
                target.run(),
                sleep(HUB_UNIT_TIMEOUT_MS).then(() => {
                    throw new Error(
                        `unit timeout ${HUB_UNIT_TIMEOUT_MS}ms: ${target.label}`
                    );
                }),
            ]);
            // **생성이 끝났으면 되읽기 결과와 무관하게 태그를 턴다.**
            // 무효화는 멱등이고(페이지가 다시 렌더되며 peek를 한 번 더 한다) 비용이
            // 거의 없다. 반대로 되읽기가 경합으로 한 번 비었다고 태그를 안 털면,
            // 실제로는 캐시에 값이 있는데 페이지는 TTL 내내 플레이스홀더를 계속
            // 렌더한다 — 이 기능이 고치려던 바로 그 증상이다.
            revalidateTag(target.tag, 'max');
            if (readBack) {
                generated += 1;
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
        keyMismatch,
        failed,
        skippedByDeadline,
    };
}
