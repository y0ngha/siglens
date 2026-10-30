'use server';

import { cookies } from 'next/headers';
import {
    runFinancialsAnalysis,
    type SubmitFinancialsAnalysisOptions,
    type RunFinancialsAnalysisResult,
} from '@y0ngha/siglens-core';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import type { Locale } from '@/shared/i18n/locales';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';
import { runGatedAnalysis } from '../server/runGatedAnalysis';

/** core의 재무 분석 결과에 siglens 쪽 게이트 거부를 더한 최종 반환 타입. */
export type RunFinancialsAnalysisActionResult =
    | RunFinancialsAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * Server Action: tier·BYOK 게이트를 거쳐 재무제표 provider로 siglens-core 재무 분석을
 * 제출한다. `cached | submitted | error`를 돌려준다. 게이트·E2E 단락·catch-all은
 * `runGatedAnalysis`가 맡는다.
 */
export async function runFinancialsAnalysisAction(
    symbol: string,
    modelId: SubmitFinancialsAnalysisOptions['modelId'],
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데
     * `/api/*`는 next-intl matcher 밖이라 액션이 스스로 알 수 없다.
     * **기본값을 두지 않는다** — 두면 호출부에서 빠져도 타입체커가 못 잡는다
     * (실측: `resolveRequestLocale`을 상수로 바꿔도 10,516개 테스트가 초록이었다).
     */
    locale: Locale,
    /** 클라이언트가 요청한 "깊은 생각" 토글. 회원·pro tier에서만 반영된다. */
    reasoning?: boolean,
    signal?: AbortSignal,
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). 큐레이션 밖 종목에서
     * 첫 신뢰 입력 전에 클라이언트가 보낸다(`useAiAutoRunAllowed`).
     */
    cacheOnly?: boolean
): Promise<RunFinancialsAnalysisActionResult> {
    return runGatedAnalysis({
        actionName: 'runFinancialsAnalysisAction',
        cacheOnly,
        modelId,
        locale,
        reasoning,
        e2eResult: async () => {
            const stub = await import('@/shared/api/e2eAnalysisStub');
            // resilience 스펙이 설정하는 force-error 쿠키가 있으면 일시적 실패를
            // 결정적으로 주입해 에러 바운더리 → 재시도 → 복구를 검증할 수 있게 한다.
            const forceError = (await cookies()).get(
                stub.E2E_FORCE_FINANCIALS_ERROR_COOKIE
            );
            return forceError
                ? stub.e2eForcedFinancialsError()
                : stub.e2eCachedFinancials();
        },
        submit: gated =>
            runFinancialsAnalysis({
                symbol,
                // 화면 로케일을 AI 산출물 언어로 그대로 넘긴다 — core 0.53.0부터
                // 받는다. `ko`는 접미 없는 기존 캐시 키를 그대로 맞힌다.
                locale,
                modelId,
                dataProvider: getFinancialStatementsProvider(symbol),
                signal,
                ...gated,
            }),
    });
}
