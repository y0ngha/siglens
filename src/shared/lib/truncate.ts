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

/**
 * 예산 안에 들어가는 **온전한 문장들**만 이어 붙인다. 하나도 못 넣으면 `null`.
 *
 * 하드 컷 뒤 종결부호를 찾는 방식(`clampAtSentenceBoundary`)과 다르다. 그쪽은 첫 문장이 예산보다
 * 길면 무조건 잘린다. 이 함수는 자르지 않고 **넣을 수 있는 만큼만** 넣는다 — 문장 단위로만 담으면
 * 잘림이 구조적으로 0이 되고, 한 문장도 못 담는 경우에만 호출자가 다른 길로 떨어진다.
 *
 * 한국어 종결(`다.`)과 일반 종결부호를 모두 끊는다. CJK 종결부호는 공백을 두지 않으므로 공백을
 * 요구하지 않는다. `Inc. (AAPL)`처럼 약어의 마침표도 끊기지만, 이어 붙일 때 원문 그대로 복원되므로
 * 결과가 달라지는 것은 약어 바로 뒤에서 예산이 끝날 때뿐이다 — 그 경우는 호출부가 최소 길이로 거른다.
 */
export function takeWholeSentences(
    text: string,
    maxLength: number
): string | null {
    const sentences = text
        .split(/(?<=다\.)\s*|(?<=[.!?。])\s+/)
        .map(part => part.trim())
        .filter(part => part.length > 0);

    let out = '';
    for (const sentence of sentences) {
        const next = out === '' ? sentence : `${out} ${sentence}`;
        if ([...next].length > maxLength) break;
        out = next;
    }
    return out === '' ? null : out;
}

/** 어절 경계를 찾으려고 하드 컷 지점에서 뒤로 훑는 최대 code point 수. */
const WORD_BOUNDARY_SEARCH_WINDOW = 20;
/**
 * 말줄임표 앞에 남기지 않는 꼬리 — 공백, 뒤에 올 말이 잘려 나가 홀로 남은 구분 구두점(`,` `·` `:` `;`),
 * **여는** 괄호·따옴표, 그리고 공백 뒤에 홀로 선 줄표.
 *
 * 닫는 따옴표와 곧은 따옴표(`"` `'`)는 걷지 않는다 — 여닫이를 가릴 수 없고, 닫는 쪽을 걷으면
 * `그는 "안정적…`처럼 짝이 깨진다. 단어에 붙은 하이픈(`BRK-`)도 그 단어의 일부라 남긴다.
 */
const DANGLING_TAIL_PATTERN = /(?:[\s,·:;([{“‘]|(?<=\s)[—–-])+$/u;

/**
 * `text`가 `max` code point를 넘으면 **어절 경계**에서 자르고 말줄임표를 붙인다(결과는 `max` 이하).
 *
 * {@link truncateWithEllipsis}는 글자 수만 맞춰 단어 한가운데서 끊는다(`…목표 주가도 이어 봅니…`,
 * `…사이의 줄…`). 검색 결과에 그대로 나가는 문장은 끊더라도 어절 끝에서 끊는다. 하드 컷 지점에서
 * {@link WORD_BOUNDARY_SEARCH_WINDOW} 이내에 공백이 없으면(띄어쓰기 없는 긴 토큰) 글자 수로 자른다 —
 * 너무 앞에서 끊어 예산을 버리는 것보다 낫다.
 */
export function truncateAtWordBoundary(text: string, max: number): string {
    const codePoints = Array.from(text);
    if (codePoints.length <= max) return text;
    const head = codePoints.slice(0, Math.max(0, max - 1));
    const windowStart = Math.max(0, head.length - WORD_BOUNDARY_SEARCH_WINDOW);
    // 잘린 자리 바로 뒤가 공백이면 head가 이미 어절 끝이다.
    const endsOnWord = /\s/u.test(codePoints[head.length] ?? '');
    const lastSpace = endsOnWord
        ? -1
        : head.findLastIndex(
              (codePoint, index) =>
                  index >= windowStart && /\s/u.test(codePoint)
          );
    const kept = lastSpace === -1 ? head : head.slice(0, lastSpace);
    const body = kept.join('').replace(DANGLING_TAIL_PATTERN, '');
    // 걷고 나니 남는 게 없으면(창 안이 공백·구두점뿐) 글자 수로 자른 머리를 쓰되 꼬리 공백은 걷는다.
    return `${body === '' ? head.join('').trimEnd() : body}…`;
}
