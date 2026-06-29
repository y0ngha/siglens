import type { SharedAnalysisSnapshot } from '../types';

/**
 * 스냅샷의 분석 기준 시각을 반환한다.
 *
 * `snapshot.context.analyzedAt`이 있으면 그 값을, 없으면 공유 생성 시각(`createdAt`)을
 * 대신 사용한다. 공유 페이지에서 "스냅샷 기준 시각" 레이블을 렌더링할 때 사용한다.
 *
 * @param snapshot - DB에서 복원한 스냅샷 객체
 * @param createdAt - 공유 레코드가 DB에 기록된 ISO 8601 시각 문자열
 * @returns ISO 8601 형태의 기준 시각 문자열
 */
export function resolveAsOf(
    snapshot: SharedAnalysisSnapshot,
    createdAt: string
): string {
    return snapshot.context.analyzedAt ?? createdAt;
}
