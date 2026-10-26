import 'server-only';
import type { ModelId } from '@y0ngha/siglens-core';
import { resolveServableModelId } from '@/entities/llm-provider/lib/serverKeyKillSwitch';
import {
    MODEL_FALLBACK_FIELD,
    type AnalysisModelFallback,
} from '@/shared/lib/sse/analysisModelFallback';

export interface RequestModel {
    /** 실제로 돌릴 모델. 요청에 모델이 없었으면 `undefined` 그대로다. */
    modelId: ModelId | undefined;
    /** 꺼진 서버 키 모델을 대체했으면 그 표시, 아니면 `null`. */
    fallback: AnalysisModelFallback | null;
}

/**
 * 요청 본문의 모델을 지금 돌릴 수 있는 모델로 바꾼다(`SERVER_KEY_DISABLED_PROVIDERS`).
 *
 * 게이트(`resolveTierAndByok`)보다 **먼저** 불러야 한다 — 꺼진 모델 그대로 게이트를
 * 통과시키면 provider 호출이 400으로 실패하고 `[analysis-stream] failed`(P1 알람 마커)가
 * 찍힌다. 대체는 `[analysis-stream] model-fallback`으로 따로 남긴다 — 운영자가 끈
 * 결과라 알람 대상이 아니다.
 *
 * 캐시 전용 요청(`cacheOnly`)은 바꾸지 않는다 — provider를 부르지 않으니 꺼진 키와
 * 무관하고, 바꾸면 그 모델로 이미 만들어 둔 캐시를 버리고 아무것도 분석하지 않은 채
 * "기본 모델로 분석해요" 안내만 띄운다.
 */
export function resolveRequestModel(
    modelId: unknown,
    { cacheOnly }: { cacheOnly: boolean }
): RequestModel {
    // 문자열이 아니면(없음·잘못된 본문) 손대지 않고 넘긴다 — 지금까지처럼 게이트가
    // `invalid_model`로 거절하거나 모델 없는 요청으로 처리한다.
    if (typeof modelId !== 'string' || cacheOnly) {
        return { modelId: modelId as ModelId | undefined, fallback: null };
    }
    const servable = resolveServableModelId(modelId as ModelId);
    if (servable.fallbackFrom === null) {
        return { modelId: servable.modelId, fallback: null };
    }
    console.warn(
        '[analysis-stream] model-fallback:',
        servable.fallbackFrom,
        '->',
        servable.modelId
    );
    return {
        modelId: servable.modelId,
        fallback: { from: servable.fallbackFrom, to: servable.modelId },
    };
}

/** 분석 결과를 실제로 내준 상태. 그 밖의 상태(`miss_no_trigger`·쿨다운 등)엔 대체 표시를 싣지 않는다. */
const RESULT_STATUSES: readonly unknown[] = ['cached', 'done'];

/**
 * 결과 객체에 대체 표시를 싣는다. 클라이언트 `runAnalysisStream`이 이 필드를 떼어 내
 * 안내를 띄운다. 대체가 없었거나, 분석 결과를 낸 상태가 아니면 그대로 돌려준다.
 */
export function attachModelFallback<T>(
    work: Promise<T>,
    fallback: AnalysisModelFallback | null
): Promise<T> {
    if (fallback === null) return work;
    return work.then(result =>
        typeof result === 'object' &&
        result !== null &&
        'status' in result &&
        RESULT_STATUSES.includes(result.status)
            ? { ...result, [MODEL_FALLBACK_FIELD]: fallback }
            : result
    );
}
