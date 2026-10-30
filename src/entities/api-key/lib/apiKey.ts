import {
    LLM_PROVIDER_VALUES,
    type LlmProvider,
} from '@/shared/config/llmProviders';

/** 입력 API 키의 앞뒤 공백을 제거한다. 비어 있으면 `null`이라 호출부가 미입력과 공백만 입력을 같게 다룬다. */
export function normalizeLlmApiKey(apiKey: string): string | null {
    const trimmed = apiKey.trim();
    return trimmed.length === 0 ? null : trimmed;
}

/** 폼 입력 문자열이 지원하는 {@link LlmProvider}인지 좁히는 타입 가드. */
export function isLlmProvider(value: string): value is LlmProvider {
    // ReadonlyArray<LlmProvider>.includes()는 string을 받지 못해 넓힌다.
    // LLM_PROVIDER_VALUES는 항상 문자열 배열이라 안전하다.
    return (LLM_PROVIDER_VALUES as readonly string[]).includes(value);
}
