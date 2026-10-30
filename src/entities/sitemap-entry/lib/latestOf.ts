/**
 * 후보 중 가장 최근 시각. 알 수 없는 후보(`undefined`)는 건너뛰고, 하나도 없으면
 * `fallback`을 그대로 돌려준다. 같은 시각이면 앞선 후보를 고르므로 호출부가 기준값을
 * 앞에 두면 동률에서 그 객체가 유지된다.
 */
export function latestOf(
    candidates: readonly (Date | undefined)[],
    fallback: Date
): Date {
    const known = candidates.filter((d): d is Date => d !== undefined);
    if (known.length === 0) return fallback;
    return known.reduce((max, d) => (d.getTime() > max.getTime() ? d : max));
}
