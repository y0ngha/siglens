import {
    getModelAccess,
    getProviderForModel,
    TIER_CONFIG,
    type ModelId,
} from '@y0ngha/siglens-core';
import type { LlmProvider } from '@/shared/config/llmProviders';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';

/** 로스터 전체(등급 순서 그대로, 중복 없음). 요청 `model`의 열거값이자 캐시 적중 읽기의 허용 범위다. */
export const API_KNOWN_MODELS: readonly ModelId[] = [
    ...new Set<string>(Object.values(TIER_CONFIG.models).flat()),
].filter(isActiveModelId);

/**
 * 공개 API에서 사용자 키로 **생성**할 수 있는 모델(로스터 순서 그대로).
 *
 * `byok` 등급만이다: core는 `free`·`member` 등급 모델을 사용자 키가 아니라 **서버 키로** 호출한다
 * (`userApiKey`를 무시한다). 공개 API는 서버 비용을 쓰지 않으므로 그 모델들은 생성 대상이 아니다
 * (공유 캐시 적중 읽기는 요청의 `model`로 가능하다). `API_KNOWN_MODELS`에서 파생하므로 로스터가
 * 바뀌면 따라온다.
 */
export const API_GENERATABLE_MODELS: readonly ModelId[] =
    API_KNOWN_MODELS.filter(id => getModelAccess(id) === 'byok');

/** 생성 가능한 모델이 하나라도 있는 provider(안내 문구의 "키를 등록할 수 있는 회사" 목록). */
export const API_GENERATABLE_PROVIDERS: readonly LlmProvider[] = [
    ...new Set(API_GENERATABLE_MODELS.map(id => getProviderForModel(id))),
];

/** 등록된 BYOK provider의 모델만. 계정 화면의 선택지이자 `setApiDefaultModelAction`의 검증 기준이다. */
export function listApiSelectableModels(
    registeredProviders: readonly LlmProvider[]
): ModelId[] {
    return API_GENERATABLE_MODELS.filter(id =>
        registeredProviders.includes(getProviderForModel(id))
    );
}

export type ApiModelCheck =
    | { ok: true; model: ModelId }
    | { ok: false; reason: 'invalid_model' | 'provider_key_missing' };

/**
 * `invalid_model`: 로스터에 없거나 `byok` 등급이 아니다.
 * `provider_key_missing`: 모델은 유효하지만 그 provider의 키를 등록하지 않았다.
 */
export function checkApiModel(
    model: string,
    registeredProviders: readonly LlmProvider[]
): ApiModelCheck {
    const known = API_GENERATABLE_MODELS.find(id => id === model);
    if (known === undefined) return { ok: false, reason: 'invalid_model' };
    return registeredProviders.includes(getProviderForModel(known))
        ? { ok: true, model: known }
        : { ok: false, reason: 'provider_key_missing' };
}

/** 요청의 `model` 인자 검증용: 로스터에 있는 모델 ID인가(등급 무관 — 캐시 적중 읽기는 허용). */
export function isKnownApiModel(model: string): model is ModelId {
    return API_KNOWN_MODELS.some(id => id === model);
}

/** 이 모델을 사용자 키로 생성할 수 있는가(= `byok` 등급). */
export function isApiGeneratableModel(model: ModelId): boolean {
    return API_GENERATABLE_MODELS.includes(model);
}
