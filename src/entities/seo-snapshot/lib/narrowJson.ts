import { stripSnapshotMarkdown } from '@/shared/lib/stripSnapshotMarkdown';

/**
 * 저장된 JSONB(`unknown`)를 필드 접근이 가능한 레코드로 좁힌다. 객체가 아니면 `null`.
 * 배열도 객체이므로 통과하지만, 호출부는 문자열 키로만 읽어 `undefined`를 얻을 뿐이다.
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
    // safe: 객체임을 확인했고, 값은 호출부가 필드별로 다시 좁혀 읽는다.
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : null;
}

/**
 * 문자열이면 마크다운 기호를 벗기고 앞뒤 공백을 자른다. 문자열이 아니면 빈 문자열이라
 * 호출부는 "산문 없음"을 길이 0으로 판정한다.
 */
export function narrowCleanString(value: unknown): string {
    return typeof value === 'string' ? stripSnapshotMarkdown(value).trim() : '';
}
