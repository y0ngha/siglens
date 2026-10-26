import { getAllowedModels, type ModelId } from '@y0ngha/siglens-core';

/** 운영자가 꺼 둔 서버 키 모델 목록을 내주는 경로(`app/api/analysis/model-availability`). */
export const MODEL_AVAILABILITY_PATH = '/api/analysis/model-availability';

/**
 * 로스터(core `TIER_CONFIG`의 어느 등급에든 있는 모델)에 있는 `ModelId`인가. 요청 본문·SSE
 * 결과·API 응답처럼 바깥에서 온 문자열을 단언 없이 좁힌다. pro 허용 목록은 모든 등급의
 * 모델을 누적해 담는다.
 */
export function isRosterModelId(value: unknown): value is ModelId {
    return (
        typeof value === 'string' &&
        getAllowedModels('pro').some(model => model === value)
    );
}

/** `GET {@link MODEL_AVAILABILITY_PATH}` 응답. */
export interface ModelAvailabilityResponse {
    /** 운영자가 꺼 둔 서버 키 모델(`SERVER_KEY_DISABLED_PROVIDERS`). */
    disabledModels: readonly ModelId[];
}
