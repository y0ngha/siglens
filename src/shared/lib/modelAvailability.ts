import type { ModelId } from '@y0ngha/siglens-core';

/** 운영자가 꺼 둔 서버 키 모델 목록을 내주는 경로(`app/api/analysis/model-availability`). */
export const MODEL_AVAILABILITY_PATH = '/api/analysis/model-availability';

/** `GET {@link MODEL_AVAILABILITY_PATH}` 응답. */
export interface ModelAvailabilityResponse {
    /** 운영자가 꺼 둔 서버 키 모델(`SERVER_KEY_DISABLED_PROVIDERS`). */
    disabledModels: readonly ModelId[];
}
