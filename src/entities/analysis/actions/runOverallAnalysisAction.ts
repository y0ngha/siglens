'use server';

import {
    type SubmitOverallAnalysisOptions,
    type RunOverallAnalysisResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { isE2E } from '@/shared/api/e2eEnv';
import type { Locale } from '@/shared/i18n/locales';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import { buildGateError, resolveTierAndByok } from '@/shared/lib/byokGate';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';
import {
    executeOverallAnalysis,
    type SubmitOverallAnalysisActionOptions,
} from '../server/overallAnalysisRunner';

/** core의 종합 분석 결과에 siglens 쪽 게이트 거부를 더한 최종 반환 타입. */
export type RunOverallAnalysisActionResult =
    | RunOverallAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * Server Action: tier·BYOK 게이트를 거쳐 4축 종합 분석 job을 제출한다. 입력 조립(DB의
 * 뉴스·실적, 옵션 스냅샷, FMP provider)은 `executeOverallAnalysis`가 맡는다.
 * `cached | done | error`를 돌려준다.
 */
export async function runOverallAnalysisAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: SubmitOverallAnalysisOptions['modelId'],
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데 `/api/*`는
     * next-intl matcher 밖이라 액션이 스스로 알 수 없다. **기본값을 두지 않는다**
     * — 두면 호출부에서 빠져도 타입체커가 못 잡는다.
     */
    locale: Locale,
    options: SubmitOverallAnalysisActionOptions = {},
    signal?: AbortSignal
): Promise<RunOverallAnalysisActionResult> {
    try {
        // E2E는 LLM/worker를 단락하고 결정적인 캐시 픽스처를 돌려준다(`e2eAnalysisStub`).
        // 스텁과 JSON 픽스처는 인라인 E2E 가드 아래 동적 import로 불러 프로덕션 메인
        // 번들이 아닌 지연 청크에 놓이게 하고, vitest 러너가 분기를 해석할 수 있게
        // 한다. 로드 실패가 클라이언트로 전파되지 않도록 try 안에 둔다(SSE 분석
        // 라우트의 technical 분기와 같다).
        if (isE2E()) {
            const { e2eCachedOverall } =
                await import('@/shared/api/e2eAnalysisStub');
            return e2eCachedOverall();
        }
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId, locale);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await executeOverallAnalysis({
            caller: {
                userId,
                tier: gate.tier,
                ...(gate.userApiKey !== undefined
                    ? { userApiKey: gate.userApiKey }
                    : {}),
            },
            symbol,
            companyName,
            timeframe,
            modelId,
            locale,
            options,
            signal,
        });
    } catch (err) {
        console.error('[runOverallAnalysisAction] unexpected error:', err);
        return {
            status: 'error',
            error: await buildGateError(caughtAnalysisErrorCode(err), locale),
        };
    }
}
