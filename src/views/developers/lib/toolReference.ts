/**
 * 도구 레퍼런스 카드의 순수 규칙: 카드 앵커, 긴 열거형을 접는 기준, 열거값 표기.
 */

/** 이 도구의 문서 앵커. 목차 칩과 카드가 같은 규칙을 쓴다. */
export const toolAnchor = (name: string): string => `tool-${name}`;

/** 이 개수를 넘는 열거형은 앞부분만 보이고 나머지는 펼친다 — 좁은 화면에서 인자 열이 목록 하나로 터지는 것을 막는다. */
export const ENUM_PREVIEW_LIMIT = 6;

/** 접힌 열거형에서 먼저 보이는 값 개수. */
export const ENUM_PREVIEW_COUNT = 3;

/** 접힌 열거형: 먼저 보이는 값과 펼쳐야 보이는 나머지. */
export interface EnumPreview {
    readonly preview: readonly string[];
    readonly rest: readonly string[];
}

/** 열거값이 `ENUM_PREVIEW_LIMIT`개를 넘을 때만 둘로 나눈다. 짧은 열거형(또는 열거형이 아닌 인자)은 `null`. */
export function splitEnumPreview(
    values: readonly string[] | undefined
): EnumPreview | null {
    if (values === undefined || values.length <= ENUM_PREVIEW_LIMIT)
        return null;
    return {
        preview: values.slice(0, ENUM_PREVIEW_COUNT),
        rest: values.slice(ENUM_PREVIEW_COUNT),
    };
}

/** 열거값을 타입 표기(`"a" | "b"`)로 잇는다. OpenAPI 타입 라벨과 같은 모양이다. */
export function formatEnumValues(values: readonly string[]): string {
    return values.map(value => `"${value}"`).join(' | ');
}
