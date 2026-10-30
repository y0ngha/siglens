/**
 * 드라이버가 jsonb 식 결과를 문자열로 줘도 같은 판정이 되도록 한 번 푼다. 문자열이 JSON이
 * 아니면 `null`이다.
 */
export function parseProjected(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/**
 * SQL이 이미 "탐지된 요청 패턴 이름"만 jsonb 배열로 투영해 오므로, 여기서는 문자열만 남기고
 * 요청 순서로 정렬한다. jsonb 배열 안의 순서는 스냅샷 저장 순서라 호출부가 기대하는 대상
 * 패턴 순서와 다를 수 있다. 배열이 아니면 빈 배열이다.
 */
export function detectedAmong(
    requested: readonly string[],
    projected: unknown
): string[] {
    if (!Array.isArray(projected)) return [];
    const detected = new Set(
        projected.filter((name): name is string => typeof name === 'string')
    );
    return requested.filter(name => detected.has(name));
}
