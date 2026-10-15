import { getProviderForModel } from '@y0ngha/siglens-core';
import {
    API_MODEL_PROVIDERS,
    listApiSelectableModels,
} from '@/entities/siglens-api-key/lib/apiModels';
import type { LlmProvider } from '@/shared/config/llmProviders';
import { LLM_PROVIDER_LABELS } from '@/shared/lib/llmProviderLabels';
import { getModelDisplay } from '@/shared/lib/modelDisplay';

export interface ApiModelOption {
    id: string;
    label: string;
}

export interface ApiModelOptionGroup {
    provider: LlmProvider;
    providerLabel: string;
    options: ApiModelOption[];
}

/**
 * "API 기본 모델" 선택지: 등록한 BYOK provider의 모델 전부 — 등급과 무관하게 모두 그 키로
 * 생성한다(`listApiSelectableModels`가 서버 액션의 검증 기준과 같다), provider별로 묶어서.
 * 표시 이름은 분석 화면의 모델 선택기와 같은 표(`getModelDisplay`)를 쓴다.
 */
export function buildApiModelOptionGroups(
    registeredProviders: readonly LlmProvider[]
): ApiModelOptionGroup[] {
    const ids = listApiSelectableModels(registeredProviders);
    const providers = [...new Set(ids.map(id => getProviderForModel(id)))];
    return providers.map(provider => ({
        provider,
        providerLabel: LLM_PROVIDER_LABELS[provider],
        options: ids
            .filter(id => getProviderForModel(id) === provider)
            .map(id => ({ id, label: getModelDisplay(id).fullName })),
    }));
}

/**
 * 키를 등록하면 모델을 고를 수 있는 회사들의 표시 이름 목록(예: "Claude (Anthropic), Gemini (Google), …").
 * 안내 문구에 회사 이름을 박아 두면 core 로스터가 바뀔 때 어긋나므로, 로스터에 모델이 실제로 있는
 * provider에서 파생한다(CONVENTIONS.md#I18-6: 문구에는 ICU 인자로 주입).
 */
export function listApiKeyProviderLabels(): string {
    return API_MODEL_PROVIDERS.map(
        provider => LLM_PROVIDER_LABELS[provider]
    ).join(', ');
}
