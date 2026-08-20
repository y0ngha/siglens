'use server';

import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import {
    runMarketNewsDigest,
    type EnrichedNewsItem,
    type NewsFeedCategory,
} from '@y0ngha/siglens-core';
import type { SubmitMarketNewsDigestActionResult } from './submitMarketNewsDigestActionTypes';
import { isBot } from '@/shared/api/isBot';
import { getMarketNewsList } from '../api';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import { DEFAULT_DIGEST_MODEL_ID } from '../lib/marketNewsConstants';
import {
    isEnrichedRow,
    selectAggregateNewsItems,
    toEnrichedNewsItem,
} from '@/entities/news-article';
import type { MarketNewsRow } from '../model';

/**
 * Picks only the fields that `isEnrichedRow` / `toEnrichedNewsItem` inspect.
 * Explicit mapping surfaces any future shape drift between the two entities
 * as a compile-time TS error rather than a silent runtime mismatch.
 */
function toEnrichedRowShape(
    row: MarketNewsRow
): Parameters<typeof isEnrichedRow>[0] {
    return {
        id: row.id,
        symbol: row.symbol,
        source: row.source,
        url: row.url,
        publishedAt: row.publishedAt,
        titleEn: row.titleEn,
        titleKo: row.titleKo,
        bodyEn: row.bodyEn,
        bodyKo: row.bodyKo,
        summaryKo: row.summaryKo,
        sentiment: row.sentiment,
        category: row.category,
        priceImpact: row.priceImpact,
        analyzedAt: row.analyzedAt,
    };
}

function toEnrichedMarketNewsItem(row: MarketNewsRow): EnrichedNewsItem | null {
    const shaped = toEnrichedRowShape(row);
    if (!isEnrichedRow(shaped)) return null;
    return toEnrichedNewsItem(shaped);
}

/**
 * Server Action: submit a market-news category digest job.
 *
 * No tier/BYOK gate — the category digest is public and uses a fixed shared
 * model. Reads enriched rows from DB, maps through `isEnrichedRow`, caps via
 * `selectAggregateNewsItems`, and delegates to core `runMarketNewsDigest`.
 *
 * Bot traffic sets `skipEnqueueIfMiss: true` so crawler requests return
 * `miss_no_trigger` without dispatching a worker job.
 */
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
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

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

        return await runMarketNewsDigest({
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
            categoryLabel: koLabel,
            modelId: DEFAULT_DIGEST_MODEL_ID,
            news,
            // 스펙상 non-thinking인 deepseek-v4-flash에서도 추론을 강제로 켠다.
            // 카테고리 피드 수십 건을 하나의 서술로 합성하는 작업이라 뉴스
            // 경로 중 추론 이득이 실제로 나오는 유일한 지점이고, Gemini에서
            // 넘어오기 전 동작(spec thinkingBudget 8192 = 추론 ON)과도 맞는다.
            // 추론 티어 모델(deepseek-v4-pro)로 올리는 것보다 훨씬 싸다.
            reasoning: true,
            skipEnqueueIfMiss,
            signal,
        });
    } catch (error) {
        console.error('[submitMarketNewsDigestAction]', error);
        return { status: 'error', error: await digestErrorMessage(locale) };
    }
}
