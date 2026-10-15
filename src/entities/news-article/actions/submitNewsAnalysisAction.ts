'use server';

import type { Locale } from '@/shared/i18n/locales';
import {
    type SubmitNewsAnalysisOptions,
    type RunNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import { executeNewsAnalysis } from '@/entities/news-article/server/newsAnalysisRunner';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/** Final return type — core's news result + our siglens-side gate errors. */
export type SubmitNewsAnalysisActionResult =
    | RunNewsAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then load last-7d enriched news from DB + next earnings, then submit via siglens-core; returns `cached | submitted | error`. */
export async function submitNewsAnalysisAction(
    symbol: string,
    companyName: string,
    modelId: SubmitNewsAnalysisOptions['modelId'],
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Only honored for member/pro tiers.
     */
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데
     * `/api/*`는 next-intl matcher 밖이라 액션이 스스로 알 수 없다.
     * **기본값을 두지 않는다** — 두면 호출부에서 빠져도 타입체커가 못 잡는다
     * (실측: `resolveRequestLocale`을 상수로 바꿔도 10,516개 테스트가 초록이었다).
     */
    locale: Locale,
    reasoning?: boolean,
    signal?: AbortSignal,
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). 큐레이션 밖 종목에서
     * 첫 신뢰 입력 전에 클라이언트가 보낸다(`useAiAutoRunAllowed`).
     */
    cacheOnly?: boolean
): Promise<SubmitNewsAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // SSE 분석 라우트의 technical 분기).
        if (isE2E()) {
            const { e2eCachedNews } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedNews();
        }
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId, locale);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await executeNewsAnalysis({
            caller: {
                userId,
                tier: gate.tier,
                ...(gate.userApiKey !== undefined
                    ? { userApiKey: gate.userApiKey }
                    : {}),
            },
            symbol,
            companyName,
            modelId,
            locale,
            reasoning,
            signal,
            cacheOnly: cacheOnly === true,
        });
    } catch (err) {
        console.error('[submitNewsAnalysisAction] unexpected error:', err);
        return {
            status: 'error',
            error: await buildGateError(caughtAnalysisErrorCode(err), locale),
        };
    }
}
