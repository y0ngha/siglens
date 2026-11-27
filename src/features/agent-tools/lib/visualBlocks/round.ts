/** 소수 `digits`자리 반올림 — 그림·요약에 긴 부동소수가 실리지 않게 한다(`-0`은 `0`으로). */
export function roundTo(value: number, digits: number): number {
    const scale = 10 ** digits;
    const rounded = Math.round(value * scale) / scale;
    return Object.is(rounded, -0) ? 0 : rounded;
}

/** 길이가 `max`를 넘으면 처음과 끝을 지키며 고르게 솎는다. */
export function downsample<T>(items: readonly T[], max: number): T[] {
    if (items.length <= max) return [...items];
    const keep = new Set(
        Array.from({ length: max }, (_, i) =>
            Math.round((i * (items.length - 1)) / (max - 1))
        )
    );
    return items.filter((_, i) => keep.has(i));
}
