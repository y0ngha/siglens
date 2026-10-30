'use server';

import { getTranslations } from 'next-intl/server';
import {
    peekMarketNewsDigestCache,
    runMarketNewsDigest,
    type RunMarketNewsDigestResult,
    type SubmitMarketNewsDigestOptions,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import {
    readLatestMarketNewsDigest,
    releaseMarketNewsDigestSlot,
    tryAcquireMarketNewsDigestSlot,
    writeLatestMarketNewsDigest,
} from '../api/marketNewsDigestCooldown';
import { getMarketNewsList } from '../api/marketNewsRepository';
import {
    CATEGORY_CONFIG,
    type NewsFeedCategoryId,
} from '../lib/categoryConfig';
import { selectDigestNews, toCoreFeedCategory } from '../lib/digestInput';
import {
    DEFAULT_DIGEST_MODEL_ID,
    DIGEST_REASONING,
} from '../lib/marketNewsConstants';
import type { SubmitMarketNewsDigestActionResult } from './submitMarketNewsDigestActionTypes';

/**
 * runMarketNewsDigest를 부르고, 실제로 생성됐으면(`done`) 마지막 생성본으로 남긴다.
 *
 * `ownsSlot`은 이 호출이 생성 슬롯을 잡았는지다. 잡은 호출이 실패하면 슬롯을 돌려줘
 * 다음 방문자가 다시 시도하게 한다 — 남이 잡은 슬롯은 건드리지 않는다. 예외는 그대로
 * 올려 액션의 catch가 `error` 상태로 바꾸게 한다.
 *
 * 예외 없이 끝나도 LLM을 부르지 않은 결과면 슬롯을 돌려준다. core
 * `RunMarketNewsDigestResult`는 `done`·`cached` 말고도 `miss_no_trigger`·`no_news`를
 * 던지지 않고 돌려준다 — 그때 슬롯을 쥐고 있으면 비용 없이 1시간 동안 생성이 막힌다.
 * `cached`도 생성이 아니지만(peek 직후 다른 호출이 채운 경우) 그 본문이 곧 최신이라
 * 슬롯을 그대로 둔다 — 돌려주면 다음 키 miss가 곧바로 또 생성한다.
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
        } else if (ownsSlot && result.status !== 'cached') {
            await releaseMarketNewsDigestSlot(category, locale);
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

/**
 * Server Action: 시장 뉴스 카테고리 다이제스트를 생성(또는 캐시에서 조회)한다.
 *
 * 티어/BYOK 게이트가 없다 — 카테고리 다이제스트는 공개이고 고정된 공용 모델을 쓴다.
 * DB의 보강된 행을 `selectDigestNews`로 상위 기사로 추려 core `runMarketNewsDigest`에
 * 넘긴다.
 *
 * `skipEnqueueIfMiss`는 `false`로 고정이다(2026-09-27) — 더는 `isBot(headers)`에서
 * 파생하지 않는다. 크롤러도 캐시 miss에서 사람과 같은 다이제스트를 받는다.
 * `src/app/api/analysis/stream/route.ts` 상단의 불변식을 본다.
 *
 * 비용(2026-10): core 키는 기사 목록에서 파생돼 새 기사가 분석될 때마다
 * 갈린다. 그래서 키 miss일 때는 카테고리 × 로케일별 1시간 생성 슬롯
 * (`marketNewsDigestCooldown`)을 잡은 호출만 생성하고, 못 잡은 호출은 마지막 생성본을
 * `cached`로 돌려준다. 마지막 생성본도 없으면(배포 직후·만료 뒤) 슬롯 없이 생성한다 —
 * 빈 화면보다 낫고, 그 생성이 마지막 생성본을 채운다.
 */
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
        // 타입으로는 막히지만 런타임 직렬화(SSE JSON 파라미터 등)에서 타입이 우회될 수
        // 있으므로 명시적 가드를 둔다.
        if (!Object.hasOwn(CATEGORY_CONFIG, category)) {
            return { status: 'error', error: await digestErrorMessage(locale) };
        }
        const { sentinel, koLabel } = CATEGORY_CONFIG[category];
        const rows = await getMarketNewsList(sentinel);

        // 프롬프트 크기를 묶으려고 시장을 움직일 상위 기사만 남긴다.
        const news = selectDigestNews(rows);

        const options: SubmitMarketNewsDigestOptions = {
            category: toCoreFeedCategory(category),
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
