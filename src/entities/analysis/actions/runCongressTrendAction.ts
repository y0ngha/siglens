'use server';

import { headers, cookies } from 'next/headers';
import type { Locale } from '@/shared/i18n/locales';
import {
    runCongressTrend,
    type SubmitCongressTrendOptions,
    type RunCongressTrendResult,
} from '@y0ngha/siglens-core';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import {
    resolveTierAndByok,
    resolveReasoning,
    buildGateError,
} from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/**
 * Final return type — core's congress result union + our siglens-side gate
 * errors (mirrors runFinancialsAnalysisAction / runFundamentalAnalysisAction).
 */
export type RunCongressTrendActionResult =
    | RunCongressTrendResult
    | AnalysisGateBlockedResult;

/**
 * Server Action: tier + BYOK gate, then submit a congressional-trade trend
 * analysis job via siglens-core. Returns `cached | submitted | no_trades |
 * miss_no_trigger | error`.
 *
 * §Public access vs. premium models: congress *filings* are public data — at
 * the type level, core's `SubmitCongressTrendOptions` has no `usage`/`now`
 * field at all, unlike `SubmitAnalysisOptions`/`SubmitFinancialsAnalysisOptions`,
 * so there is no daily usage-limit check to wire up here. But a
 * caller can still request a premium `modelId`, and `resolveTierAndByok`
 * gates exactly like every other submit action (free/anonymous + premium →
 * blocked unless the caller has a stored BYOK key; pro or a free model →
 * allowed). This was previously missing — congress was the only analysis
 * surface with no BYOK gate. The fix is two functional wins, not a cost or
 * security one: (a) the gate is what actually forwards the member's stored
 * key to core as `userApiKey` (→ `X-AI-API-KEY`), so a premium model works
 * at all here — without it a member with a registered key had no way to
 * reach a premium model through this action; and (b) an ungated call now
 * fails fast with a localized `tier_premium_blocked` message instead of
 * being submitted and only rejected later, at poll time, by the worker.
 *
 * §Bot guard: `skipEnqueueIfMiss = isBot(headers)` so crawlers never trigger
 * LLM worker dispatches.
 *
 * §E2E: when `E2E_TEST=1`, returns a deterministic cached fixture. The stub
 * imports are lazy/dynamic so they land in a server-only chunk that the prod
 * bundle never ships (mirrors runFinancialsAnalysisAction).
 *
 * §Reasoning: the "깊은 생각" toggle (member-reasoning-toggle spec Part A)
 * still requires the caller tier. `resolveReasoning` forces `false` for
 * anonymous/free callers, using the tier resolved by the gate above (so a
 * single DB round-trip serves both concerns).
 */
export async function runCongressTrendAction(
    symbol: string,
    modelId: SubmitCongressTrendOptions['modelId'],
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value. Only honored
     * for member/pro tiers.
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
): Promise<RunCongressTrendActionResult> {
    try {
        if (isE2E()) {
            const stub = await import('@/shared/api/e2eAnalysisStub');
            // resilience 스펙이 설정하는 force-error 쿠키가 있으면 일시적 실패를
            // 결정적으로 주입해 에러 바운더리 → 재시도 → 복구를 검증할 수 있게 한다.
            const forceError = (await cookies()).get(
                stub.E2E_FORCE_CONGRESS_ERROR_COOKIE
            );
            return forceError
                ? stub.e2eForcedCongressError()
                : stub.e2eCachedCongressTrend();
        }

        const requestHeaders = await headers();
        const skipEnqueueIfMiss = isBot(requestHeaders);

        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId, locale);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await runCongressTrend({
            symbol,
            modelId,
            dataProvider: getCongressTradesProvider(),
            tier: gate.tier,
            reasoning: resolveReasoning(gate.tier, reasoning),
            skipEnqueueIfMiss,
            signal,
            ...(gate.userApiKey !== undefined
                ? { userApiKey: gate.userApiKey }
                : {}),
        });
    } catch (error) {
        // MISTAKES §0.7: server actions must not propagate raw exceptions to
        // the client. Mirrors the sibling submit actions' catch-all shape so
        // the hook's `isGateBlockedResult` check stays a reliable discriminant.
        console.error('[runCongressTrendAction] unexpected error:', error);
        return {
            status: 'error',
            error: await buildGateError('unexpected_error', locale),
        };
    }
}
