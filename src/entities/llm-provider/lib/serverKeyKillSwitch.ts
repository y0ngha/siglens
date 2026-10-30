import {
    getAllowedModels,
    getModelAccess,
    getProviderForModel,
    type LlmProvider,
    type ModelId,
} from '@y0ngha/siglens-core';
import { DEFAULT_ANALYSIS_MODEL } from '@/shared/config/analysisDefaultModel';
import { isRosterModelId } from '@/shared/lib/modelAvailability';

const KNOWN_PROVIDERS: readonly LlmProvider[] = [
    'anthropic',
    'google',
    'openai',
    'deepseek',
];

/** 요청 모델을 실제로 돌릴 모델로 바꾼 결과. */
export interface ServableModel {
    modelId: ModelId;
    /** 꺼진 모델을 대체했으면 원래 요청 모델, 아니면 `null`. */
    fallbackFrom: ModelId | null;
}

/**
 * env `SERVER_KEY_DISABLED_PROVIDERS` 원문(쉼표 목록, 예: `anthropic,openai`)을 provider 집합으로 읽는다.
 *
 * 대소문자·공백은 무시하고, core `LlmProvider`에 없는 값은 버린다 — SSM 파라미터는
 * 빈 값을 저장할 수 없어서 다시 켤 때는 파라미터를 지우거나 `none`처럼 모르는 값을 넣는다.
 */
export function parseDisabledServerKeyProviders(
    raw: string
): ReadonlySet<LlmProvider> {
    const values = raw
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter((value): value is LlmProvider =>
            (KNOWN_PROVIDERS as readonly string[]).includes(value)
        );
    return new Set(values);
}

/**
 * 이 모델이 `disabled` provider 때문에 서버 키로 돌 수 없는가.
 *
 * BYOK 모델은 사용자 자신의 키로 호출되므로 대상이 아니다 — 운영자 크레딧이 바닥나도
 * 사용자 키는 멀쩡하다. 판정은 core `getModelAccess`가 `free`/`member`라고 답하는
 * 모델(서버가 대납하는 모델)로 한정한다.
 */
export function isServerKeyModelDisabled(
    modelId: ModelId,
    disabled: ReadonlySet<LlmProvider>
): boolean {
    if (disabled.size === 0) return false;
    if (getModelAccess(modelId) === 'byok') return false;
    return disabled.has(getProviderForModel(modelId));
}

/** `disabled` provider 때문에 꺼진 서버 키 모델 전부. 꺼진 provider가 없으면 빈 배열이다. */
export function selectDisabledServerKeyModels(
    disabled: ReadonlySet<LlmProvider>
): readonly ModelId[] {
    if (disabled.size === 0) return [];
    // member 허용 목록 = free + member 모델 = 서버가 대납하는 모델 전부.
    return getAllowedModels('member').filter(model =>
        isServerKeyModelDisabled(model, disabled)
    );
}

/**
 * 요청 모델을 지금 실제로 돌릴 수 있는 모델로 바꾼다. 꺼진 서버 키 모델이면
 * `DEFAULT_ANALYSIS_MODEL`(화면의 기본 모델과 같은 상수)로, 아니면 그대로.
 *
 * 대체 모델까지 꺼져 있으면(DeepSeek를 끈 경우) 바꾸지 않는다 — 다른 꺼진 모델로
 * 옮겨 봐야 똑같이 실패하고, 원래 요청대로 실패해야 원인이 로그에 남는다.
 *
 * 요청 본문에서 온 값이라 로스터에 없는 문자열일 수 있다. 그런 값은 건드리지 않고
 * 넘긴다 — 거절(`invalid_model`)은 뒤의 게이트가 한다.
 */
export function pickServableModel(
    modelId: ModelId,
    disabled: ReadonlySet<LlmProvider>
): ServableModel {
    const fallbackModel = DEFAULT_ANALYSIS_MODEL;
    if (
        disabled.size === 0 ||
        !isRosterModelId(modelId) ||
        !isServerKeyModelDisabled(modelId, disabled) ||
        isServerKeyModelDisabled(fallbackModel, disabled)
    ) {
        return { modelId, fallbackFrom: null };
    }
    return { modelId: fallbackModel, fallbackFrom: modelId };
}
