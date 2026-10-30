import type { ModelId } from '@y0ngha/siglens-core';
import { LOCAL_STORAGE_ANALYSIS_MODEL_KEY } from '@/shared/lib/storageKeys';

/**
 * 저장된 분석 모델을 읽는다. 저장소 접근이 막힌 브라우저(시크릿 모드·Safari 사생활 보호
 * 등)는 `localStorage` 접근에서 `SecurityError`를 던진다 — 형제 마이그레이션
 * (`migrateLegacyAnalysisModel`)처럼 삼키고 "저장값 없음"으로 취급한다. 던지게 두면
 * 마운트 effect에서 트리가 죽는다.
 *
 * 값은 검증하지 않고 `ModelId`로 돌려준다(사용자가 손댈 수 있는 저장소다). 모든 호출부가
 * 쓰기 전에 허용·중단 목록에 들어 있는지 `includes`로 확인하므로 목록 밖 문자열은 쓰이지 않는다.
 */
export function readStoredModel(): ModelId | null {
    try {
        return localStorage.getItem(
            LOCAL_STORAGE_ANALYSIS_MODEL_KEY
        ) as ModelId | null;
    } catch {
        return null;
    }
}

/**
 * 고른 모델을 저장한다. 서버 렌더에서는 아무것도 하지 않고, 저장소가 막혀 던지면
 * 영속만 포기한다 — 호출부(`useSelectedModel`)는 이번 세션의 선택을 그대로 반영한다.
 */
export function writeStoredModel(model: ModelId): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LOCAL_STORAGE_ANALYSIS_MODEL_KEY, model);
    } catch {
        // 저장소 차단(SecurityError) — 위 JSDoc.
    }
}
