import 'server-only';
import type { LlmProvider, ModelId } from '@y0ngha/siglens-core';
import {
    parseDisabledServerKeyProviders,
    pickServableModel,
    selectDisabledServerKeyModels,
    type ServableModel,
} from '../lib/serverKeyKillSwitch';

/**
 * 서버 키(운영자가 요금을 내는 키)로 부르는 provider 중 운영자가 꺼 둔 것을 env
 * `SERVER_KEY_DISABLED_PROVIDERS`에서 읽는다.
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
    return parseDisabledServerKeyProviders(
        process.env.SERVER_KEY_DISABLED_PROVIDERS ?? ''
    );
}

/** 지금 꺼져 있는 서버 키 모델 전부(`/api/analysis/model-availability`가 화면에 내려준다). */
export function listDisabledServerKeyModels(): readonly ModelId[] {
    return selectDisabledServerKeyModels(readDisabledServerKeyProviders());
}

/** 요청 모델을 지금 돌릴 수 있는 모델로 바꾼다(`/api/analysis/stream`이 호출). 규칙은 `pickServableModel`. */
export function resolveServableModelId(modelId: ModelId): ServableModel {
    return pickServableModel(modelId, readDisabledServerKeyProviders());
}
