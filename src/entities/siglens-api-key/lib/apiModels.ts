import {
    getProviderForModel,
    TIER_CONFIG,
    type ModelId,
} from '@y0ngha/siglens-core';
import type { LlmProvider } from '@/shared/config/llmProviders';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';

/** 로스터 전체(등급 순서 그대로, 중복 없음). 요청 `model`의 열거값이자 생성 가능한 모델 전체다. */
export const API_KNOWN_MODELS: readonly ModelId[] = [
    ...new Set<string>(Object.values(TIER_CONFIG.models).flat()),
].filter(isActiveModelId);

/**
 * 로스터에 모델을 가진 provider(안내 문구의 "키를 등록할 수 있는 회사" 목록).
 *
 * 공개 API는 로스터의 **모든** 활성 모델을 호출자 자신의 provider 키로 생성한다 — core의
 * `keyPolicy: 'byok-only'`가 모델 등급(free/member/byok)과 tier에 상관없이 사용자 키만 쓰게 한다. 웹 화면은
 * 하위 모델을 서버 키로 만들지만 API는 키가 있어야 한다.
 */
export const API_MODEL_PROVIDERS: readonly LlmProvider[] = [
    ...new Set(API_KNOWN_MODELS.map(id => getProviderForModel(id))),
];

/** 등록된 BYOK provider의 모델만. 계정 화면의 선택지이자 `setApiDefaultModelAction`의 검증 기준이다. */
export function listApiSelectableModels(
    registeredProviders: readonly LlmProvider[]
): ModelId[] {
    return API_KNOWN_MODELS.filter(id =>
        registeredProviders.includes(getProviderForModel(id))
    );
}

export type ApiModelCheck =
    | { ok: true; model: ModelId }
    | { ok: false; reason: 'invalid_model' | 'provider_key_missing' };

/**
 * `invalid_model`: 로스터에 없다.
 * `provider_key_missing`: 모델은 유효하지만 그 provider의 키를 등록하지 않았다.
 */
export function checkApiModel(
    model: string,
    registeredProviders: readonly LlmProvider[]
): ApiModelCheck {
    const known = API_KNOWN_MODELS.find(id => id === model);
    if (known === undefined) return { ok: false, reason: 'invalid_model' };
    return registeredProviders.includes(getProviderForModel(known))
        ? { ok: true, model: known }
        : { ok: false, reason: 'provider_key_missing' };
}

/** 요청의 `model` 인자 검증용: 로스터에 있는 활성 모델 ID인가. */
export function isKnownApiModel(model: string): model is ModelId {
    return API_KNOWN_MODELS.some(id => id === model);
}
