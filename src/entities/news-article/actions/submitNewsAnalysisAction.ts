'use server';

import {
    type SubmitNewsAnalysisOptions,
    type RunNewsAnalysisResult,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';
import { executeNewsAnalysis } from '../server/newsAnalysisRunner';

/** core 뉴스 결과에 siglens 쪽 게이트 거절(tier·BYOK)을 더한 최종 반환 타입. */
export type SubmitNewsAnalysisActionResult =
    | RunNewsAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * Server Action: tier·BYOK 게이트를 통과시킨 뒤 `executeNewsAnalysis`로 뉴스 분석을
 * 제출한다. 게이트 거절과 예기치 못한 예외는 던지지 않고 `error` 결과로 돌려준다.
 */
export async function submitNewsAnalysisAction(
    symbol: string,
    companyName: string,
    modelId: SubmitNewsAnalysisOptions['modelId'],
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데
     * `/api/*`는 next-intl matcher 밖이라 액션이 스스로 알 수 없다.
     * **기본값을 두지 않는다** — 두면 호출부에서 빠져도 타입체커가 못 잡는다
     * (실측: `resolveRequestLocale`을 상수로 바꿔도 10,516개 테스트가 초록이었다).
     */
    locale: Locale,
    /** 클라이언트가 요청한 "깊은 생각" 토글. member/pro tier에서만 반영된다. */
    reasoning?: boolean,
    signal?: AbortSignal,
    /**
     * 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). 큐레이션 밖 종목에서
     * 첫 신뢰 입력 전에 클라이언트가 보낸다(`useAiAutoRunAllowed`).
     */
    cacheOnly?: boolean
): Promise<SubmitNewsAnalysisActionResult> {
    try {
        // E2E는 LLM/worker를 건너뛰고 결정적인 캐시 픽스처를 돌려준다(e2eAnalysisStub).
        // 스텁과 JSON 픽스처는 인라인 E2E 가드 아래에서 동적 import로 불러와 프로덕션
        // 메인 번들이 아닌 lazy 청크에 두고, vitest 러너가 분기를 해석할 수 있게 한다.
        // 로드 실패가 클라이언트로 전파되지 않도록 try 안에 둔다(SSE 분석 라우트의
        // technical 분기와 같다).
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
