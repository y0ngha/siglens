'use server';

import type { Locale } from '@/shared/i18n/locales';
import {
    type AssembledPromptRecord,
    type MarketEvent,
    type PriorAnalysis,
    type SubmitOverallAnalysisOptions,
    type RunOverallAnalysisResult,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { executeOverallAnalysis } from '@/entities/analysis/server/overallAnalysisRunner';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierAndByok, buildGateError } from '@/shared/lib/byokGate';
import { caughtAnalysisErrorCode } from '@/shared/lib/aiProviderFailure';
import { isE2E } from '@/shared/api/e2eEnv';
import type { AnalysisGateBlockedResult } from '@/shared/lib/types';

/** Final return type — core's overall result + our siglens-side gate errors. */
export type RunOverallAnalysisActionResult =
    | RunOverallAnalysisResult
    | AnalysisGateBlockedResult;

/**
 * 재분석(force) 같이 axis 일반 인자가 아니라 호출자 의도를 전달하기 위한 옵션.
 * 현재는 `force` 하나만 있지만 향후 확장 가능하도록 객체로 받는다.
 */
export interface SubmitOverallAnalysisActionOptions {
    force?: boolean;
    /**
     * Client-requested "깊은 생각" (deep-thinking) toggle value (member-reasoning-toggle
     * spec Part A). Only honored for member/pro tiers — forced `false` for
     * anonymous/free callers by `resolveReasoning` regardless of this value.
     */
    reasoning?: boolean;
    /**
     * Prior-analysis-context 히스토리 저장(Task S2)을 위해 그대로 core에
     * 전달한다 — `OverallDependencyInputs.onPromptAssembled`와 동일 계약
     * (캐시 미스에서 정확히 한 번, 프로바이더 호출 직전 동기 호출; 동시
     * 요청의 패자는 호출받지 않음). 여기서 가공하지 않는다.
     */
    onPromptAssembled?: (record: AssembledPromptRecord) => void | Promise<void>;
    /**
     * Prior-analysis-context 히스토리(Task S3)를 core의 **overall 축**
     * (top-level `priorAnalyses`)에 그대로 전달한다. `analysisHistoryQuery(timeframe,
     * 'overall')`로 읽은 값이어야 한다 — technical 축과 recency 윈도우가 다르다
     * (overall은 `OVERALL_CACHE_TTL_SECONDS`, technical은 `ANALYSIS_CACHE_TTL[timeframe]`).
     * 호출자(SSE 라우트)가 core 호출 **이전에** 읽어 넘긴다 — core가 이 값의
     * fingerprint를 캐시 키에 접기 때문에, 캐시 미스에서만 지연 조회하면 같은
     * 요청이 키 계산 시점과 프롬프트 렌더 시점에 서로 다른 히스토리 집합을
     * 보게 된다. 여기서는 가공하지 않고 그대로 넘긴다.
     */
    priorAnalyses?: readonly PriorAnalysis[];
    /**
     * Prior-analysis-context 히스토리를 core의 **technical 축**
     * (`technical.priorAnalyses`)에 전달한다. technical 탭 스트림 경로가
     * `runAnalysis`에 넘기는 것과 **같은 값**(`analysisHistoryQuery(timeframe,
     * 'technical')`로 읽은)이어야 그 축이 technical 탭과 캐시 키를 공유한다.
     *
     * `priorAnalyses`(overall 축)와 별개 필드다 — 과거엔 하나의 배열을 두 곳에
     * 동시에 흘려보냈는데, 두 축의 recency 윈도우가 다르므로(overall이 하루,
     * technical이 타임프레임별 TTL) 같은 배열을 공유하면 한쪽이 틀린 윈도우로
     * 읽은 이력을 갖게 된다.
     */
    technicalPriorAnalyses?: readonly PriorAnalysis[];
    /**
     * technical 탭 스트림 경로가 `runAnalysis`에 넘기는 것과 같은 시장 이벤트.
     * `technicalPriorAnalyses`와 함께 overall의 technical 축에도 넘겨야 그 축의
     * 캐시 키(`:hist=`·`:evt=`)가 technical 탭과 같아진다 — 한쪽만 넘기면 같은
     * 분석이 한 번 더 생성된다. 가공하지 않고 그대로 넘긴다.
     */
    marketEvents?: readonly MarketEvent[];
    /**
     * 캐시만 조회하고 미스면 생성하지 않는다(`miss_no_trigger`). SSE 라우트가
     * 생성 한도를 넘긴 요청을 강등할 때 켠다. 생략·`false`면 기존 동작 그대로다.
     */
    cacheOnly?: boolean;
}

/** Server Action: tier + BYOK gate, then submit a 4-axis overall analysis job; loads enriched news + earnings from DB, options snapshot, injects FMP provider; returns `cached | done | error`. */
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
        // E2E short-circuits the LLM/worker; returns a deterministic cached fixture
        // (see e2eAnalysisStub). The stub + JSON fixture load via a DYNAMIC import
        // under the inline E2E guard so they sit in a lazy chunk (not the prod main
        // bundle) and the branch stays resolvable by the vitest runner. Lives inside
        // try so a load failure can't propagate to the client (mirrors
        // SSE 분석 라우트의 technical 분기).
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
