'use server';

import { headers, cookies } from 'next/headers';
import {
    submitCongressTrend,
    type SubmitCongressTrendOptions,
    type SubmitCongressTrendResult,
} from '@y0ngha/siglens-core';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierOnly, resolveReasoning } from '@/shared/lib/byokGate';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';

/**
 * Final return type — congress data is fully public, so there is no tier-gate
 * or BYOK variant. The action returns the core result union directly.
 */
export type SubmitCongressTrendActionResult = SubmitCongressTrendResult;

/**
 * Server Action: submit a congressional-trade trend analysis job via
 * siglens-core. Returns `cached | submitted | no_trades | miss_no_trigger |
 * error`.
 *
 * §Public access: congress filings are public data. No usage-limit check and
 * no BYOK gate are applied — `resolveTierAndByok` is intentionally absent
 * (only the lighter `resolveTierOnly` runs, for reasoning gating).
 *
 * §Bot guard: `skipEnqueueIfMiss = isBot(headers)` so crawlers never trigger
 * LLM worker dispatches.
 *
 * §E2E: when `E2E_TEST=1`, returns a deterministic cached fixture. The stub
 * imports are lazy/dynamic so they land in a server-only chunk that the prod
 * bundle never ships (mirrors submitFinancialsAnalysisAction).
 *
 * §Reasoning: congress has no BYOK/premium gate, but the "깊은 생각" toggle
 * (member-reasoning-toggle spec Part A) still requires knowing the caller's
 * tier — `resolveTierOnly` resolves tier alone (no premium-model check),
 * and `resolveReasoning` forces `false` for anonymous/free callers.
 */
export async function submitCongressTrendAction(
    symbol: string,
    modelId: SubmitCongressTrendOptions['modelId'],
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value. Only honored
     * for member/pro tiers.
     */
    reasoning?: boolean
): Promise<SubmitCongressTrendActionResult> {
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
        const tier = await resolveTierOnly(user?.id ?? null);

        return await submitCongressTrend({
            symbol,
            modelId,
            dataProvider: getCongressTradesProvider(),
            skipEnqueueIfMiss,
            reasoning: resolveReasoning(tier, reasoning),
        });
    } catch (error) {
        // MISTAKES §0.7: server actions must not propagate raw exceptions to
        // the client. Map any unexpected failure into the `fetch_failed` result
        // shape so the widget can render the typed error state.
        console.error('[submitCongressTrendAction] failed:', error);
        return {
            status: 'error',
            code: 'fetch_failed',
            error: String(error),
        };
    }
}
