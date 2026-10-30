'use server';

import { cookies } from 'next/headers';
import {
    type RunOptionsAnalysisResult,
    type ModelId,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/server/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import { isE2E } from '@/shared/api/e2eEnv';
import type { Locale } from '@/shared/i18n/locales';
import type {
    AnalysisGateBlockedResult,
    OptionsExpirationSelector,
} from '@/shared/lib/types';
import { executeOptionsAnalysis } from '../server/optionsAnalysisRunner';

/** core의 옵션 분석 결과에 siglens 쪽 게이트 거부(티어·BYOK)를 합친 액션 반환 타입. */
export type SubmitOptionsAnalysisActionResult =
    | RunOptionsAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * 옵션 탭의 분석 요청 Server Action. 티어·BYOK 게이트를 통과하면 Yahoo 스냅샷을 미리 받아
 * core `runOptionsAnalysis`로 넘긴다. core의 `cached | submitted | miss_no_trigger | error`
 * 변형과 게이트 거부 모두 던지지 않고 결과로 돌려준다.
 */
export async function submitOptionsAnalysisAction(
    symbol: string,
    companyName: string,
    expirationDate: OptionsExpirationSelector,
    modelId: ModelId,
    /**
     * 요청 로케일. 게이트 거부 문구가 사용자에게 그대로 보이는데
     * `/api/*`는 next-intl matcher 밖이라 액션이 스스로 알 수 없다.
     * **기본값을 두지 않는다** — 두면 호출부에서 빠져도 타입체커가 못 잡는다
     * (실측: `resolveRequestLocale`을 상수로 바꿔도 10,516개 테스트가 초록이었다).
     */
    locale: Locale,
    /** 클라이언트가 요청한 "깊은 생각" 토글. 멤버·프로 티어에서만 반영된다. */
    reasoning?: boolean,
    signal?: AbortSignal,
    /**
     * 캐시에 이미 결과가 있을 때만 돌려주고, 없으면 **새 분석을 만들지 않는다**.
     *
     * OI/호가가 stale한 상태(정규장 밖 등)에서 쓰인다: 그 입력으로 분석을 새로
     * 태우면 프롬프트의 핵심 지표(Max Pain, P/C, top OI/IV)가 모두 무력화된
     * 저품질 결과에 비용까지 든다. 반면 장중에 만들어둔 캐시가 있으면 그건
     * 정상적인 결과이므로, 읽어서 분석 컨텍스트로 올릴 가치가 있다.
     *
     * 클라이언트가 켤 수 있지만 서버 작업량을 **줄이는 방향**으로만 작동하므로
     * (miss 시 enqueue를 건너뜀) 비용 증폭에 악용될 수 없다.
     */
    cacheOnly?: boolean
): Promise<SubmitOptionsAnalysisActionResult> {
    try {
        // E2E에서는 LLM·워커 대신 결정적 픽스처(e2eAnalysisStub)로 단락한다. 스텁과 JSON
        // 픽스처가 프로덕션 메인 번들에 들어가지 않도록 인라인 E2E 가드 아래에서 동적 import한다
        // (E2E_TEST 미설정 시 죽은 분기). 동적 import는 vitest 러너도 해석하므로 이 분기를 단위
        // 테스트한다. 로드 실패가 클라이언트로 전파되지 않게 try 안에 둔다.
        if (isE2E()) {
            const stub = await import('@/shared/api/e2eAnalysisStub');
            // resilience 스펙이 설정하는 force-error 쿠키가 있으면 일시적 실패를 결정적으로
            // 주입해 에러 바운더리 → 재시도 → 복구를 검증할 수 있게 한다.
            const forceError = (await cookies()).get(
                stub.E2E_FORCE_ANALYSIS_ERROR_COOKIE
            );
            return forceError
                ? stub.e2eForcedOptionsError()
                : stub.e2eCachedOptions();
        }
        // 봇의 캐시 미스도 사람과 같은 본문을 생성해야 하므로 봇 여부로 가르지 않는다.
        // `cacheOnly`가 enqueue를 건너뛰는 유일한 사유다(위 JSDoc).
        const user = await getCurrentUser();
        const userId = user?.id ?? null;

        const gate = await resolveTierAndByok(userId, modelId, locale);
        if (gate.kind === 'blocked') {
            return { status: 'error', error: gate.error };
        }

        return await executeOptionsAnalysis({
            caller: {
                userId,
                tier: gate.tier,
                ...(gate.userApiKey !== undefined
                    ? { userApiKey: gate.userApiKey }
                    : {}),
            },
            symbol,
            companyName,
            expirationDate,
            modelId,
            locale,
            reasoning,
            signal,
            cacheOnly: cacheOnly === true,
        });
    } catch (err) {
        console.error('[submitOptionsAnalysisAction] unexpected error:', err);
        return {
            status: 'error',
            error: await buildGateError(caughtAnalysisErrorCode(err), locale),
        };
    }
}
