import { getProviderForModel } from '@y0ngha/siglens-core';
import { listApiSelectableModels } from '@/entities/siglens-api-key/lib/apiModels';
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
 * "API 기본 모델" 선택지: 등록한 BYOK provider의 모델 중 사용자 키로 생성할 수 있는 것만
 * (`listApiSelectableModels`가 서버 액션의 검증 기준과 같다), provider별로 묶어서.
 * 표시 이름은 분석 화면의 모델 선택기와 같은 표(`getModelDisplay`)를 쓴다.
 */
export function buildApiModelOptionGroups(
    registeredProviders: readonly LlmProvider[]
): ApiModelOptionGroup[] {
    const groups = new Map<LlmProvider, ApiModelOptionGroup>();
    for (const id of listApiSelectableModels(registeredProviders)) {
        const provider = getProviderForModel(id);
        const group = groups.get(provider) ?? {
            provider,
            providerLabel: LLM_PROVIDER_LABELS[provider],
            options: [],
        };
        group.options.push({ id, label: getModelDisplay(id).fullName });
        groups.set(provider, group);
    }
    return [...groups.values()];
}
