export const HEADLINE_MAX_CHARS = 200;
/** 이보다 짧은 줄은 제목으로 치지 않는다(문서 번호·날짜 같은 조각). */
export const HEADLINE_MIN_CHARS = 10;
/** 단어 경계로 자를 때 이보다 앞에서 자르게 되면(= 공백이 너무 앞에만 있으면) 그냥 200자에서 자른다. */
const WORD_CUT_MIN_CHARS = 100;

/** 제목 상한(200자)을 넘으면 마지막 공백에서 자른다. 공백이 너무 앞에만 있으면 200자에서 자른다. */
export function cutAtWordBoundary(text: string): string {
    if (text.length <= HEADLINE_MAX_CHARS) return text;
    const slice = text.slice(0, HEADLINE_MAX_CHARS);
    const lastSpace = slice.lastIndexOf(' ');
    return (
        lastSpace >= WORD_CUT_MIN_CHARS ? slice.slice(0, lastSpace) : slice
    ).trimEnd();
}
