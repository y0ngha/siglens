'use server';

import { cookies } from 'next/headers';
import type { Locale } from '@/shared/i18n/locales';
import {
    runCongressTrend,
    type SubmitCongressTrendOptions,
    type RunCongressTrendResult,
} from '@y0ngha/siglens-core';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import { runGatedAnalysis } from '../lib/runGatedAnalysis';
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
 * The gate, E2E short-circuit, bot parity (`skipEnqueueIfMiss: false`),
 * reasoning tier rule and catch-all live in `runGatedAnalysis`, shared with the
 * fundamental/financials actions.
 */
export async function runCongressTrendAction(
    symbol: string,
    modelId: SubmitCongressTrendOptions['modelId'],
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데
     * `/api/*`는 next-intl matcher 밖이라 액션이 스스로 알 수 없다.
     * **기본값을 두지 않는다** — 두면 호출부에서 빠져도 타입체커가 못 잡는다
     * (실측: `resolveRequestLocale`을 상수로 바꿔도 10,516개 테스트가 초록이었다).
     */
    locale: Locale,
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value. Only honored
     * for member/pro tiers.
     */
    reasoning?: boolean,
    signal?: AbortSignal,
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). 큐레이션 밖 종목에서
     * 첫 신뢰 입력 전에 클라이언트가 보낸다(`useAiAutoRunAllowed`).
     */
    cacheOnly?: boolean
): Promise<RunCongressTrendActionResult> {
    return runGatedAnalysis({
        actionName: 'runCongressTrendAction',
        cacheOnly,
        modelId,
        locale,
        reasoning,
        e2eResult: async () => {
            const stub = await import('@/shared/api/e2eAnalysisStub');
            // resilience 스펙이 설정하는 force-error 쿠키가 있으면 일시적 실패를
            // 결정적으로 주입해 에러 바운더리 → 재시도 → 복구를 검증할 수 있게 한다.
            const forceError = (await cookies()).get(
                stub.E2E_FORCE_CONGRESS_ERROR_COOKIE
            );
            return forceError
                ? stub.e2eForcedCongressError()
                : stub.e2eCachedCongressTrend();
        },
        submit: gated =>
            runCongressTrend({
                symbol,
                // 화면 로케일을 AI 산출물 언어로 그대로 넘긴다 — core 0.53.0부터
                // 받는다. `ko`는 접미 없는 기존 캐시 키를 그대로 맞힌다.
                locale,
                modelId,
                dataProvider: getCongressTradesProvider(),
                signal,
                ...gated,
            }),
    });
}
