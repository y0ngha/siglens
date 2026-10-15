'use server';

import { cookies } from 'next/headers';
import type { Locale } from '@/shared/i18n/locales';
import {
    runInvestorFlowsAnalysis,
    type ModelId,
    type RunInvestorFlowsAnalysisResult,
} from '@y0ngha/siglens-core';
import { isFinraShortDataEnabled } from '@/shared/api/finra/finraShortDataEnabled';
import { investorFlowsCachedProvider } from '@/entities/investor-flows/server/getInvestorFlowsCachedProvider';
import { runGatedAnalysis } from '../lib/runGatedAnalysis';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/**
 * Final return type — core's investor-flows result union + our siglens-side gate
 * errors (mirrors `runCongressTrendAction`).
 */
export type RunInvestorFlowsActionResult =
    | RunInvestorFlowsAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * Server Action: tier + BYOK gate, then run the investor-flows (수급) interpretation via
 * siglens-core. Returns `cached | done | no_data | miss_no_trigger | error`.
 *
 * 수급 데이터(13F·Form 4·13D/G·FINRA)는 공개 자료라 core에 사용량 한도 인자가 없다. 그래도 호출자는
 * 프리미엄 `modelId`를 고를 수 있어, `resolveTierAndByok`가 다른 축과 똑같이 게이트한다(무료·비회원 +
 * 프리미엄 모델 → 저장된 BYOK 키가 없으면 차단). 게이트·E2E 단락·봇 동등성·추론 토글 규칙·catch-all은
 * `runGatedAnalysis`가 fundamental/financials/congress와 공유한다.
 *
 * `includeFinraData`는 FINRA 플래그(`FINRA_SHORT_DATA_ENABLED`)를 그대로 따른다 — core 캐시 키에 접히므로
 * 플래그를 끄면 공매도가 섞인 옛 해석이 캐시에서 나오지 않는다. 스냅샷은 페이지가 그리는 것과 같은
 * 캐시 스냅샷을 쓴다(`investorFlowsCachedProvider`).
 */
export async function runInvestorFlowsAction(
    symbol: string,
    modelId: ModelId,
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데 `/api/*`는 next-intl matcher 밖이라
     * 액션이 스스로 알 수 없다. **기본값을 두지 않는다** — 두면 호출부에서 빠져도 타입체커가 못 잡는다.
     */
    locale: Locale,
    /** Client-requested "깊은 생각" toggle. Only honored for member/pro tiers. */
    reasoning?: boolean,
    signal?: AbortSignal,
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). 큐레이션 밖 종목에서 첫 신뢰 입력 전에
     * 클라이언트가 보낸다(`useAiAutoRunAllowed`).
     */
    cacheOnly?: boolean
): Promise<RunInvestorFlowsActionResult> {
    return runGatedAnalysis({
        actionName: 'runInvestorFlowsAction',
        cacheOnly,
        modelId,
        locale,
        reasoning,
        e2eResult: async () => {
            const stub = await import('@/shared/api/e2eAnalysisStub');
            // resilience 스펙이 설정하는 force-error 쿠키가 있으면 일시적 실패를 결정적으로 주입한다.
            const forceError = (await cookies()).get(
                stub.E2E_FORCE_INVESTOR_FLOWS_ERROR_COOKIE
            );
            return forceError
                ? stub.e2eForcedInvestorFlowsError()
                : stub.e2eCachedInvestorFlows();
        },
        submit: gated =>
            runInvestorFlowsAnalysis({
                symbol,
                locale,
                modelId,
                dataProvider: investorFlowsCachedProvider,
                includeFinraData: isFinraShortDataEnabled(),
                signal,
                ...gated,
            }),
    });
}
