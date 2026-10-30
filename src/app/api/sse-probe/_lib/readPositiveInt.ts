/**
 * 쿼리 파라미터를 엄격하게 파싱해 `[1, max]` 정수로 돌려준다. 없거나 숫자가 아니거나 0 이하이거나
 * 안전 정수를 넘으면 `fallback`이다.
 *
 * `Number.parseInt`는 `'10abc'`를 10으로 받아주지만, `/api/sse-probe`의 목적이 정밀한
 * 타이밍 측정이라 오타가 조용히 통과하면 측정값을 신뢰할 수 없게 된다 — 숫자만으로 이루어진
 * 입력만 받는다.
 */
export function readPositiveInt(
    params: URLSearchParams,
    key: string,
    fallback: number,
    max: number
): number {
    const raw = params.get(key);
    if (raw === null || !/^\d+$/.test(raw)) return fallback;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
}
