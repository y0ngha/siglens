/**
 * `text`가 `max` **code point** 이하면 그대로, 넘으면 `max - 1`개에서 잘라
 * 말줄임표(`…`, 1자로 계산)를 붙인다 — 결과는 항상 `max` code point 이하다.
 *
 * `text.slice(0, n)`은 UTF-16 코드 유닛 단위라 이모지·보조 평면 한자의
 * surrogate pair를 반으로 가를 수 있다(뒤에 lone surrogate가 남아 `�`로
 * 렌더되거나, OG 이미지·JSON 직렬화에서 깨진다). 길이 판정과 자르기를 모두
 * code point 기준으로 한다.
 *
 * `trimEnd`: 자른 뒤 꼬리 공백을 걷고 말줄임표를 붙인다(`단어 …` 대신 `단어…`).
 */
export interface TruncateWithEllipsisOptions {
    readonly trimEnd?: boolean;
}

export function truncateWithEllipsis(
    text: string,
    max: number,
    { trimEnd = false }: TruncateWithEllipsisOptions = {}
): string {
    const codePoints = Array.from(text);
    if (codePoints.length <= max) return text;
    const head = codePoints.slice(0, Math.max(0, max - 1)).join('');
    return `${trimEnd ? head.trimEnd() : head}…`;
}
