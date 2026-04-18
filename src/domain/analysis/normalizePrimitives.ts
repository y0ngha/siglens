export function asString(v: unknown, fallback = ''): string {
    return typeof v === 'string' ? v : fallback;
}

export function asNumber(v: unknown): number | undefined {
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function asBoolean(v: unknown, fallback = false): boolean {
    return typeof v === 'boolean' ? v : fallback;
}

export function asEnum<T extends string>(
    v: unknown,
    valid: readonly T[],
    fallback: T
): T {
    return valid.find(x => x === v) ?? fallback;
}

export function asOptionalEnum<T extends string>(
    v: unknown,
    valid: readonly T[]
): T | undefined {
    return valid.find(x => x === v);
}

export function asObject(v: unknown): Record<string, unknown> | null {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
    // 바로 위 가드에서 null, 비객체, 배열을 모두 걸러내 Record 구조임을 확정했다.
    return v as Record<string, unknown>;
}

export function asArray(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
}

export function compact<T>(xs: (T | null)[]): T[] {
    return xs.filter((x): x is T => x !== null);
}
