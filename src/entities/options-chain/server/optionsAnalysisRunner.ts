import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/shared/i18n/locales';
import {
    runOptionsAnalysis,
    type RunOptionsAnalysisResult,
    type ModelId,
} from '@y0ngha/siglens-core';
import { fetchOptionsSnapshot } from '../lib/optionsDataCache';
import { resolveReasoning } from '@/shared/lib/byokGate';
import {
    assertCallerRouting,
    type AnalysisCaller,
} from '@/shared/lib/byokOnly';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

export interface ExecuteOptionsAnalysisParams {
    /** 누구의 이름으로 어떤 키로 부르는지 — 쿠키 액션도 공개 API도 호출부가 정해 넘긴다. */
    readonly caller: AnalysisCaller;
    readonly symbol: string;
    readonly companyName: string;
    readonly expirationDate: OptionsExpirationSelector;
    readonly modelId: ModelId;
    readonly locale: Locale;
    /** 클라이언트 "깊은 생각" 토글 — `resolveReasoning`이 tier로 한 번 더 거른다. */
    readonly reasoning?: boolean;
    readonly signal?: AbortSignal;
    /** 캐시만 읽고 미스면 생성하지 않는다(`miss_no_trigger`). */
    readonly cacheOnly: boolean;
}

/**
 * 옵션 분석 본문 — Yahoo 스냅샷을 미리 받아 core `runOptionsAnalysis`.
 *
 * `submitOptionsAnalysisAction`(쿠키 세션)과 공개 API의 `run_fresh_analysis`가 공유한다. 세션을 읽지
 * 않고 `caller`만 쓴다. 예외는 삼키지 않고 던진다(호출부가 각자 오류 모양으로 바꾼다).
 */
export async function executeOptionsAnalysis({
    caller,
    symbol,
    companyName,
    expirationDate,
    modelId,
    locale,
    reasoning,
    signal,
    cacheOnly,
}: ExecuteOptionsAnalysisParams): Promise<RunOptionsAnalysisResult> {
    assertCallerRouting(caller, modelId, cacheOnly);
    const skipEnqueueIfMiss = cacheOnly;
    const snapshot = await fetchOptionsSnapshot(symbol);
    if (snapshot === null) {
        return {
            status: 'no_chains_error',
            code: 'no_options_chains',
            error: (
                await getTranslations({
                    locale,
                    namespace: 'app.api.stream',
                })
            )('noOptionsChains'),
        };
    }

    return await runOptionsAnalysis({
        symbol,
        // 화면 로케일을 AI 산출물 언어로 그대로 넘긴다 — core 0.53.0부터
        // 받는다. `ko`는 접미 없는 기존 캐시 키를 그대로 맞힌다.
        locale,
        companyName,
        expirationDate,
        modelId,
        snapshot,
        tier: caller.tier,
        reasoning: resolveReasoning(caller.tier, reasoning),
        skipEnqueueIfMiss,
        signal,
        ...(caller.userApiKey !== undefined
            ? { userApiKey: caller.userApiKey }
            : {}),
    });
}
