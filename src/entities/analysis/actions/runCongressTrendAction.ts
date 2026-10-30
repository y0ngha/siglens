'use server';

import { cookies } from 'next/headers';
import {
    runCongressTrend,
    type SubmitCongressTrendOptions,
    type RunCongressTrendResult,
} from '@y0ngha/siglens-core';
import { getCongressTradesProvider } from '@/shared/api/fmp/getCongressTradesProvider';
import type { Locale } from '@/shared/i18n/locales';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';
import { runGatedAnalysis } from '../server/runGatedAnalysis';

/** core의 의회 거래 결과 유니온에 siglens 쪽 게이트 거부를 더한 최종 반환 타입. */
export type RunCongressTrendActionResult =
    | RunCongressTrendResult
    | AnalysisGateBlockedResult;

/**
 * Server Action: tier·BYOK 게이트를 거쳐 siglens-core로 의회 거래 동향 분석 job을
 * 제출한다. `cached | submitted | no_trades | miss_no_trigger | error`를 돌려준다.
 *
 * 공개 접근과 프리미엄 모델: 의회 *공시*는 공개 데이터라 core의
 * `SubmitCongressTrendOptions`에는 `SubmitAnalysisOptions`/`SubmitFinancialsAnalysisOptions`
 * 와 달리 `usage`/`now` 필드가 아예 없어 여기서 연결할 일일 사용량 한도 검사가 없다.
 * 그래도 호출자는 프리미엄 `modelId`를 고를 수 있고, `resolveTierAndByok`가 다른 제출
 * 액션과 똑같이 게이트한다(무료·비회원 + 프리미엄 → 저장된 BYOK 키가 없으면 차단,
 * pro 또는 무료 모델 → 허용). 게이트가 하는 일은 두 가지다. (a) 회원이 저장한 키를
 * `userApiKey`(→ `X-AI-API-KEY`)로 core에 전달하므로 프리미엄 모델이 여기서 동작한다.
 * (b) 게이트를 안 거친 호출은 제출된 뒤 worker 폴링 시점에야 거부되는 대신, 로케일
 * 문구가 담긴 `tier_premium_blocked`로 즉시 실패한다.
 *
 * 게이트·E2E 단락·봇 동등성(`skipEnqueueIfMiss: false`)·추론 tier 규칙·catch-all은
 * 다른 패널 액션과 공유하는 `runGatedAnalysis`에 있다.
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
    /** 클라이언트가 요청한 "깊은 생각" 토글. 회원·pro tier에서만 반영된다. */
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
