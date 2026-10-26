import 'server-only';
import type { ModelId } from '@y0ngha/siglens-core';
import { resolveServableModelId } from '@/entities/llm-provider/lib/serverKeyKillSwitch';
import { isRosterModelId } from '@/shared/lib/modelAvailability';
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
    // 로스터 밖 값(없음·오타·잘못된 본문)은 손대지 않고 넘긴다 — 지금까지처럼 게이트가
    // `invalid_model`로 거절하거나 모델 없는 요청으로 처리한다. 이 단언은 값을 좁히지 않는다:
    // 라우트가 본문을 이미 같은 타입으로 단언해 쓰고 있고(`StreamRequestBody`), 검증은
    // 게이트(`isKnownModelId`) 몫이다. 여기서는 받은 값을 그대로 되돌려 줄 뿐이다.
    if (!isRosterModelId(modelId) || cacheOnly) {
        return { modelId: modelId as ModelId | undefined, fallback: null };
    }
    const servable = resolveServableModelId(modelId);
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
        // 분석 결과를 실제로 내준 상태만. 그 밖의 상태(`miss_no_trigger`·쿨다운 등)엔 싣지 않는다.
        (result.status === 'cached' || result.status === 'done')
            ? { ...result, [MODEL_FALLBACK_FIELD]: fallback }
            : result
    );
}
