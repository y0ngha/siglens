'use server';

import { headers, cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import {
    runOptionsAnalysis,
    type RunOptionsAnalysisResult,
    type ModelId,
} from '@y0ngha/siglens-core';
import { fetchOptionsSnapshot } from '../lib/optionsDataCache';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    resolveTierAndByok,
    resolveReasoning,
    buildGateError,
} from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import type {
    AnalysisGateBlockedResult,
    OptionsExpirationSelector,
} from '@/shared/lib/types';

/** Final return type — core's options result + our siglens-side gate errors. */
export type SubmitOptionsAnalysisActionResult =
    | RunOptionsAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * Server Action: tier + BYOK gate, then submit options analysis via siglens-core
 * with the Yahoo snapshot pre-fetched. Returns `cached | submitted | miss_no_trigger
 * | error` variants from siglens-core, or a gate-blocked error from siglens.
 */
export async function submitOptionsAnalysisAction(
    symbol: string,
    companyName: string,
    expirationDate: OptionsExpirationSelector,
    modelId: ModelId,
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
     * 캐시에 이미 결과가 있을 때만 돌려주고, 없으면 **새 분석을 만들지 않는다**.
     *
     * OI/호가가 stale한 상태(정규장 밖 등)에서 쓰인다: 그 입력으로 분석을 새로
     * 태우면 프롬프트의 핵심 지표(Max Pain, P/C, top OI/IV)가 모두 무력화된
     * 저품질 결과에 비용까지 든다. 반면 장중에 만들어둔 캐시가 있으면 그건
     * 정상적인 결과이므로, 읽어서 챗봇 분석 컨텍스트로 올릴 가치가 있다.
     *
     * 클라이언트가 켤 수 있지만 서버 작업량을 **줄이는 방향**으로만 작동하므로
     * (miss 시 enqueue를 건너뜀) 비용 증폭에 악용될 수 없다.
     */
    cacheOnly?: boolean
): Promise<SubmitOptionsAnalysisActionResult> {
    try {
        // E2E short-circuits the LLM/worker with a deterministic fixture (see
        // e2eAnalysisStub). Loaded via a DYNAMIC import under the inline E2E guard
        // so the stub + JSON fixture sit in a lazy chunk (never in the prod main
        // bundle; the branch is dead when E2E_TEST is unset). Dynamic import (vs a
        // bare require) is also resolvable by the vitest runner, so this branch is
        // unit-tested. Inside try so a load failure can't propagate to the client.
        if (isE2E()) {
            const stub = await import('@/shared/api/e2eAnalysisStub');
            // resilience 스펙이 설정하는 force-error 쿠키가 있으면 일시적 실패를
            // 결정적으로 주입해 에러 바운더리 → 재시도 → 복구를 검증할 수 있게 한다.
            const forceError = (await cookies()).get(
                stub.E2E_FORCE_ANALYSIS_ERROR_COOKIE
            );
            return forceError
                ? stub.e2eForcedOptionsError()
                : stub.e2eCachedOptions();
        }
        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders) || cacheOnly === true;

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId, locale);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        const snapshot = await fetchOptionsSnapshot(symbol);
        if (snapshot === null) {
            return {
                status: 'no_chains_error',
                code: 'no_options_chains',
                error: (
                    await getTranslations({
                        locale,
                        namespace: 'app.api.stream',
                    })
                )('noOptionsChains'),
            };
        }

        return await runOptionsAnalysis({
            symbol,
            companyName,
            expirationDate,
            modelId,
            snapshot,
            tier: gate.tier,
            reasoning: resolveReasoning(gate.tier, reasoning),
            skipEnqueueIfMiss,
            signal,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (err) {
        console.error('[submitOptionsAnalysisAction] unexpected error:', err);
        return {
            status: 'error',
            error: await buildGateError('unexpected_error', locale),
        };
    }
}
