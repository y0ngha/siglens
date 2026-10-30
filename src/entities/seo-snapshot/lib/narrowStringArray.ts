import { narrowCleanString } from './narrowJson';

/**
 * `unknown` 필드를 마크다운 기호를 벗기고 trim한 문자열 배열로 좁힌다. 일곱 `*SnapshotProse`
 * 렌더러의 `*Ko` 불릿/목록 필드(`riskFactorsKo`, `notableMembersKo`, `keyEventsKo`,
 * `technicalBulletsKo` 등)가 공유하는 모양이다. 비문자열 항목과 정리 후 빈 문자열은 버린다.
 *
 * 배열이 아니면(`null`/`undefined` 포함) 던지지 않고 `[]`로 좁힌다 — "산문 근거 없음 →
 * 아무것도 렌더하지 않고 플레이스홀더로 폴백"이라는 모든 렌더러의 계약이다.
 */
export function narrowStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
        const cleaned = narrowCleanString(item);
        return cleaned.length > 0 ? [cleaned] : [];
    });
}
