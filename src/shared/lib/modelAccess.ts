import {
    getModelAccess,
    type ModelAccess,
    type ModelId,
} from '@y0ngha/siglens-core';

/**
 * `getModelAccess`의 throw-safe 래퍼.
 *
 * core의 `getModelAccess`는 레지스트리에 없는 ID에 throw한다. 그 자체는 옳은
 * 설계지만(등급 배치 누락을 조용히 넘기지 않는다), 클라이언트에는 레지스트리에
 * 없는 ID가 정상적으로 도달할 수 있다:
 *
 * - localStorage나 분석 이력에 남은, 이후 제거된 모델
 * - core 배포와 siglens 배포 사이의 시차
 *
 * 그 값이 렌더나 이벤트 핸들러에서 throw하면 모델 선택 UI 전체가 죽는다. 그래서
 * 경계에서 한 번 잡고, 호출부가 자기 맥락에 맞게 처리하도록 `null`을 돌려준다.
 *
 * @returns 등급, 또는 레지스트리에 없는 ID면 `null`.
 */
export function tryGetModelAccess(model: ModelId): ModelAccess | null {
    try {
        return getModelAccess(model);
    } catch {
        return null;
    }
}

/**
 * 게이트 판정용 등급. 알 수 없는 ID는 **가장 제한적인 등급**으로 본다.
 *
 * 실패 방향이 중요하다 — 알 수 없는 모델을 `'free'`로 접으면 게이트를 그대로
 * 통과해 서버 키로 호출이 나간다. `'byok'`로 접으면 최악의 경우 사용자가 쓸 수
 * 있었을 모델이 잠기는 정도에 그친다.
 */
export function resolveGateAccess(model: ModelId): ModelAccess {
    return tryGetModelAccess(model) ?? 'byok';
}
