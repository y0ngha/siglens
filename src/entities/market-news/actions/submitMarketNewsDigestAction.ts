'use server';

import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import {
    peekMarketNewsDigestCache,
    runMarketNewsDigest,
    type EnrichedNewsItem,
    type NewsFeedCategory,
    type RunMarketNewsDigestResult,
    type SubmitMarketNewsDigestOptions,
} from '@y0ngha/siglens-core';
import type { SubmitMarketNewsDigestActionResult } from './submitMarketNewsDigestActionTypes';
import { getMarketNewsList } from '@/entities/market-news/api/marketNewsRepository';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import {
    DEFAULT_DIGEST_MODEL_ID,
    DIGEST_REASONING,
} from '../lib/marketNewsConstants';
import { selectAggregateNewsItems } from '@/entities/news-article/lib/newsAnalysisSelection';
import { toEnrichedMarketNewsItem } from '../lib/toEnrichedMarketNewsItem';
import {
    readLatestMarketNewsDigest,
    releaseMarketNewsDigestSlot,
    tryAcquireMarketNewsDigestSlot,
    writeLatestMarketNewsDigest,
} from '../api/marketNewsDigestCooldown';

/**
 * Server Action: submit a market-news category digest job.
 *
 * No tier/BYOK gate — the category digest is public and uses a fixed shared
 * model. Reads enriched rows from DB, maps through `isEnrichedRow`, caps via
 * `selectAggregateNewsItems`, and delegates to core `runMarketNewsDigest`.
 *
 * `skipEnqueueIfMiss` is hardcoded `false` (2026-09-27) — no longer derived
 * from `isBot(headers)`. Crawlers get the same digest a human would on a
 * cache miss; see the invariant at the top of
 * `src/app/api/analysis/stream/route.ts`.
 *
 * 비용(2026-10 비용 감사): core 키는 기사 목록에서 파생돼 새 기사가 분석될 때마다
 * 갈린다. 그래서 키 miss일 때는 카테고리 × 로케일별 1시간 생성 슬롯
 * (`marketNewsDigestCooldown`)을 잡은 호출만 생성하고, 못 잡은 호출은 마지막 생성본을
 * `cached`로 돌려준다. 마지막 생성본도 없으면(배포 직후·만료 뒤) 슬롯 없이 생성한다 —
 * 빈 화면보다 낫고, 그 생성이 마지막 생성본을 채운다.
 */
/**
 * runMarketNewsDigest를 부르고, 실제로 생성됐으면(`done`) 마지막 생성본으로 남긴다.
 *
 * `ownsSlot`은 이 호출이 생성 슬롯을 잡았는지다. 잡은 호출이 실패하면 슬롯을 돌려줘
 * 다음 방문자가 다시 시도하게 한다 — 남이 잡은 슬롯은 건드리지 않는다. 예외는 그대로
 * 올려 액션의 catch가 `error` 상태로 바꾸게 한다.
 */
async function runAndRecordDigest(
    options: SubmitMarketNewsDigestOptions,
    category: NewsFeedCategoryId,
    locale: Locale,
    ownsSlot: boolean
): Promise<RunMarketNewsDigestResult> {
    try {
        const result = await runMarketNewsDigest(options);
        if (result.status === 'done') {
            await writeLatestMarketNewsDigest(category, locale, result.result);
        }
        return result;
    } catch (error) {
        if (ownsSlot) await releaseMarketNewsDigestSlot(category, locale);
        throw error;
    }
}

/** 사용자에게 그대로 보이는 실패 문구. 영어 리터럴이 전 로케일에 나가고 있었다. */
async function digestErrorMessage(locale: Locale): Promise<string> {
    const t = await getTranslations({ locale, namespace: 'app.api.stream' });
    return t('digestFailed');
}

export async function submitMarketNewsDigestAction(
    category: NewsFeedCategoryId,
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데
     * `/api/*`는 next-intl matcher 밖이라 액션이 스스로 알 수 없다.
     * **기본값을 두지 않는다** — 두면 호출부에서 빠져도 타입체커가 못 잡는다
     * (실측: `resolveRequestLocale`을 상수로 바꿔도 10,516개 테스트가 초록이었다).
     */
    locale: Locale,
    signal?: AbortSignal
): Promise<SubmitMarketNewsDigestActionResult> {
    try {
        // 알 수 없는 카테고리는 CATEGORY_CONFIG 접근 전에 차단한다.
        // TypeScript 타입으로는 방어되지만, 런타임 직렬화(SSE JSON 파라미터 등)에서
        // 타입이 우회될 수 있으므로 명시적 가드를 추가한다.
        if (!Object.hasOwn(CATEGORY_CONFIG, category)) {
            return { status: 'error', error: await digestErrorMessage(locale) };
        }
        const { sentinel, koLabel } = CATEGORY_CONFIG[category];
        const rows = await getMarketNewsList(sentinel);

        const enrichedItems: EnrichedNewsItem[] = rows
            .map(toEnrichedMarketNewsItem)
            .filter((item): item is EnrichedNewsItem => item !== null);

        // Cap to the top market-moving items to keep the digest prompt bounded.
        const news = selectAggregateNewsItems(enrichedItems);

        const options: SubmitMarketNewsDigestOptions = {
            /*
             * core 경계에서의 유일한 캐스트.
             *
             * core는 `NewsFeedCategory`(general|stock|crypto|forex|articles)만 알고,
             * siglens는 여기에 한국 증시(`'kr'`)를 더해 쓴다
             * (`lib/categoryConfig.ts`의 `NewsFeedCategoryId`).
             *
             * **왜 안전한가**: core 안에서 이 값이 닿는 곳은 네 군데인데
             * (installed 0.47.0 `runMarketNewsDigest` 확인) 어느 것도 값으로
             * 분기하거나 룩업하지 않고 전부 문자열로 흘려보낸다.
             *   1. `createSkillSamplingPlan(..., ['market-news-digest', category, modelId, …])`
             *      — 샘플링 시드 성분
             *   2. `buildMarketNewsDigestCacheKey(category, …)` — Redis 키에 그대로 보간
             *   3. `correlationId: \`${category}:market-news-digest\`` — 로그 상관 id
             *   4. 빈 다이제스트 경고의 `console.warn` 페이로드
             * 프롬프트는 아래 `categoryLabel`만 본다(`buildMarketNewsDigestPrompt` 확인).
             * 따라서 `'kr'`은 `…:market-news:kr:…`이라는 **정확한** 네임스페이스를
             * 만들고, 다른 카테고리와 절대 충돌하지 않는다.
             *
             * core가 이 값으로 분기하기 시작하면 이 캐스트는 깨져야 한다 —
             * union 확장을 core 후속 과제로 기록해 두었다
             * (`docs/superpowers/specs/2026-08-19-asset-class-navigation-design.md` §7).
             */
            category: category as NewsFeedCategory,
            // 화면 로케일을 AI 산출물 언어로 그대로 넘긴다 — core 0.53.0부터
            // 받는다. `ko`는 접미 없는 기존 캐시 키를 그대로 맞힌다.
            locale,
            categoryLabel: koLabel,
            modelId: DEFAULT_DIGEST_MODEL_ID,
            news,
            // 캐시 키 성분 — 허브 프리웜·SSR peek와 같은 상수를 쓴다(`DIGEST_REASONING` 주석).
            reasoning: DIGEST_REASONING,
            skipEnqueueIfMiss: false,
            signal,
        };

        // 기사 0건(`no_news`)과 캐시 hit은 LLM을 부르지 않으므로 슬롯을 건드리지 않는다.
        const needsGeneration =
            news.length > 0 &&
            (await peekMarketNewsDigestCache(options)) === null;
        const ownsSlot =
            needsGeneration &&
            (await tryAcquireMarketNewsDigestSlot(category, locale));
        if (needsGeneration && !ownsSlot) {
            const latest = await readLatestMarketNewsDigest(category, locale);
            if (latest !== null) return { status: 'cached', result: latest };
        }
        return await runAndRecordDigest(options, category, locale, ownsSlot);
    } catch (error) {
        console.error('[submitMarketNewsDigestAction]', error);
        return { status: 'error', error: await digestErrorMessage(locale) };
    }
}
