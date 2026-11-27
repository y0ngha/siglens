type PathPart = string | number;

function describePath(path: readonly PathPart[]): string {
    return path.length === 0 ? 'value' : path.join('.');
}

/**
 * `unknown` JSON(도구 결과, 응답 본문)에서 경로를 따라 값을 읽는다. 경로 중간이 객체가
 * 아니면 `any` 캐스트로 뭉개지 않고 어디서 끊겼는지 알려 주며 던진다.
 */
export function readAt(value: unknown, ...path: readonly PathPart[]): unknown {
    return path.reduce<unknown>((current, part, index) => {
        if (typeof current !== 'object' || current === null) {
            throw new Error(
                `expected an object at ${describePath(path.slice(0, index))}`
            );
        }
        return Reflect.get(current, part);
    }, value);
}

export function numberAt(value: unknown, ...path: readonly PathPart[]): number {
    const found = readAt(value, ...path);
    if (typeof found !== 'number') {
        throw new Error(`expected a number at ${describePath(path)}`);
    }
    return found;
}

export function stringAt(value: unknown, ...path: readonly PathPart[]): string {
    const found = readAt(value, ...path);
    if (typeof found !== 'string') {
        throw new Error(`expected a string at ${describePath(path)}`);
    }
    return found;
}

export function arrayAt(
    value: unknown,
    ...path: readonly PathPart[]
): readonly unknown[] {
    const found = readAt(value, ...path);
    if (!Array.isArray(found)) {
        throw new Error(`expected an array at ${describePath(path)}`);
    }
    return found;
}

export function keysAt(value: unknown, ...path: readonly PathPart[]): string[] {
    const found = readAt(value, ...path);
    if (typeof found !== 'object' || found === null) {
        throw new Error(`expected an object at ${describePath(path)}`);
    }
    return Object.keys(found);
}
