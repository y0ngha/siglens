import 'server-only';

import {
    getAllowedModels,
    getModelAccess,
    getProviderForModel,
    type LlmProvider,
    type ModelId,
} from '@y0ngha/siglens-core';
import { DEFAULT_ANALYSIS_MODEL } from '@/shared/config/analysisDefaultModel';

const KNOWN_PROVIDERS: readonly LlmProvider[] = [
    'anthropic',
    'google',
    'openai',
    'deepseek',
];

/**
 * 서버 키(운영자가 요금을 내는 키)로 부르는 provider 중 운영자가 꺼 둔 것.
 *
 * env `SERVER_KEY_DISABLED_PROVIDERS`는 쉼표 목록이다(`anthropic`, `anthropic,openai`).
 * 대소문자·공백은 무시하고, core `LlmProvider`에 없는 값은 버린다 — SSM 파라미터는
 * 빈 값을 저장할 수 없어서 다시 켤 때는 파라미터를 지우거나 `none`처럼 모르는 값을 넣는다.
 *
 * 크레딧 소진·provider 장애처럼 그 provider의 서버 키 호출이 전부 실패하는 동안
 * 쓰는 운영 스위치다.
 *
 * **적용 범위**: 사용자가 고른 분석 모델이 서버 키로 도는 경로, 곧 `/api/analysis/stream`
 * (종목 분석 탭 전부)과 화면의 모델 목록뿐이다. 공개 API(`/api/v1`)는 `keyPolicy: 'byok-only'`라
 * 호출자 자신의 키로 돌아 대상이 아니고, 사용자가 모델을 고르지 않는 서버 작업(뉴스 카드·
 * 브리핑·SEO 프리웜 등)은 코드가 정한 고정 모델로 돈다 — 그 provider가 끊기면 이 스위치가
 * 아니라 해당 작업의 모델 설정을 바꾼다. 호출마다 읽는다(모듈 상수로 굳히지 않는다) — 테스트가 env를
 * 바꿔 가며 검증하고, 런타임 env는 재시작 전까지 어차피 바뀌지 않는다.
 */
export function readDisabledServerKeyProviders(): ReadonlySet<LlmProvider> {
    const raw = process.env.SERVER_KEY_DISABLED_PROVIDERS ?? '';
    const values = raw
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter((value): value is LlmProvider =>
            (KNOWN_PROVIDERS as readonly string[]).includes(value)
        );
    return new Set(values);
}

/**
 * 이 모델이 지금 서버 키로 돌 수 없는가.
 *
 * BYOK 모델은 사용자 자신의 키로 호출되므로 대상이 아니다 — 운영자 크레딧이 바닥나도
 * 사용자 키는 멀쩡하다. 판정은 core `getModelAccess`가 `free`/`member`라고 답하는
 * 모델(서버가 대납하는 모델)로 한정한다.
 */
export function isServerKeyModelDisabled(
    modelId: ModelId,
    disabled: ReadonlySet<LlmProvider> = readDisabledServerKeyProviders()
): boolean {
    if (disabled.size === 0) return false;
    if (getModelAccess(modelId) === 'byok') return false;
    return disabled.has(getProviderForModel(modelId));
}

/** 지금 꺼져 있는 서버 키 모델 전부. 꺼진 provider가 없으면 빈 배열이다. */
export function listDisabledServerKeyModels(): readonly ModelId[] {
    const disabled = readDisabledServerKeyProviders();
    if (disabled.size === 0) return [];
    // member 허용 목록 = free + member 모델 = 서버가 대납하는 모델 전부.
    return getAllowedModels('member').filter(model =>
        isServerKeyModelDisabled(model, disabled)
    );
}

export interface ServableModel {
    modelId: ModelId;
    /** 꺼진 모델을 대체했으면 원래 요청 모델, 아니면 `null`. */
    fallbackFrom: ModelId | null;
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
export function resolveServableModelId(modelId: ModelId): ServableModel {
    const fallbackModel = DEFAULT_ANALYSIS_MODEL;
    const disabled = readDisabledServerKeyProviders();
    if (
        disabled.size === 0 ||
        !getAllowedModels('pro').includes(modelId) ||
        !isServerKeyModelDisabled(modelId, disabled) ||
        isServerKeyModelDisabled(fallbackModel, disabled)
    ) {
        return { modelId, fallbackFrom: null };
    }
    return { modelId: fallbackModel, fallbackFrom: modelId };
}
