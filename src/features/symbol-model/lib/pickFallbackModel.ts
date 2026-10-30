import { getModelAccess, type ModelId } from '@y0ngha/siglens-core';
import { DEFAULT_ANALYSIS_MODEL } from '@/shared/config/analysisDefaultModel';

/**
 * 고를 수 있는 목록에서 대신 쓸 모델. 기본 모델이 있으면 그것, 없으면(운영자가 DeepSeek를
 * 꺼 둔 경우) 서버가 대납하는 첫 free 모델이다. 목록 첫 항목을 그냥 고르면 BYOK 모델이
 * 걸릴 수 있다 — 등급 제한이 꺼진 동안 `getAllowedModels`는 BYOK까지 정렬해 돌려주고,
 * 키 없는 방문자의 분석이 전부 막힌다.
 *
 * `useSelectedModel`의 강등과 컨텍스트의 `fallbackModel`이 같은 규칙을 쓰도록 여기 하나만 둔다.
 */
export function pickFallbackModel(allowedModels: readonly ModelId[]): ModelId {
    if (allowedModels.includes(DEFAULT_ANALYSIS_MODEL)) {
        return DEFAULT_ANALYSIS_MODEL;
    }
    return (
        allowedModels.find(model => getModelAccess(model) === 'free') ??
        allowedModels[0] ??
        DEFAULT_ANALYSIS_MODEL
    );
}
