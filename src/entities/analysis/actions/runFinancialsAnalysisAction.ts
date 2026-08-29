'use server';

import { headers, cookies } from 'next/headers';
import type { Locale } from '@/shared/i18n/locales';
import {
    runFinancialsAnalysis,
    type SubmitFinancialsAnalysisOptions,
    type RunFinancialsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    resolveTierAndByok,
    resolveReasoning,
    buildGateError,
} from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/** Final return type — core's financials result + our siglens-side gate errors. */
export type RunFinancialsAnalysisActionResult =
    | RunFinancialsAnalysisResult
    | AnalysisGateBlockedResult;

/** Server Action: tier + BYOK gate, then submit financials analysis via siglens-core with financial statements provider; returns `cached | submitted | error`. */
export async function runFinancialsAnalysisAction(
    symbol: string,
    modelId: SubmitFinancialsAnalysisOptions['modelId'],
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
    signal?: AbortSignal
): Promise<RunFinancialsAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // SSE 분석 라우트의 technical 분기).
        if (isE2E()) {
            const stub = await import('@/shared/api/e2eAnalysisStub');
            // resilience 스펙이 설정하는 force-error 쿠키가 있으면 일시적 실패를
            // 결정적으로 주입해 에러 바운더리 → 재시도 → 복구를 검증할 수 있게 한다.
            const forceError = (await cookies()).get(
                stub.E2E_FORCE_FINANCIALS_ERROR_COOKIE
            );
            return forceError
                ? stub.e2eForcedFinancialsError()
                : stub.e2eCachedFinancials();
        }
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId, locale);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await runFinancialsAnalysis({
            symbol,
            // 화면 로케일을 AI 산출물 언어로 그대로 넘긴다 — core 0.53.0부터
            // 받는다. `ko`는 접미 없는 기존 캐시 키를 그대로 맞힌다.
            locale,
            modelId,
            dataProvider: getFinancialStatementsProvider(symbol),
            tier: gate.tier,
            reasoning: resolveReasoning(gate.tier, reasoning),
            skipEnqueueIfMiss,
            signal,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error('[runFinancialsAnalysisAction] unexpected error:', err);
        return {
            status: 'error',
            error: await buildGateError('unexpected_error', locale),
        };
    }
}
