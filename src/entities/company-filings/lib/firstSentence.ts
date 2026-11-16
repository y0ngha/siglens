const SENTENCE_END = /[.!?]["”’)]*(?=\s|$)/g;
/** 마침표로 끝나도 문장이 끝나지 않는 약어(소문자, 끝의 마침표 제외). */
const ABBREVIATIONS: ReadonlySet<string> = new Set([
    'inc',
    'corp',
    'ltd',
    'co',
    'no',
    'u.s',
    'u.k',
    'mr',
    'mrs',
    'ms',
    'dr',
    'st',
    'vs',
    'llc',
    'l.p',
]);
const INITIAL = /^[a-z]$/i;
/**
 * 문장 끝을 찾는 앞부분의 길이. 제목 대용은 200자에서 잘리므로 이보다 먼 곳의 마침표는 쓸모가 없다 — 문단이
 * 256KB여도 이 길이만 훑는다(SERVER.md#SA-23).
 */
const SENTENCE_SCAN_MAX_CHARS = 2_000;
/** 마침표 앞 토큰을 찾는 길이. 약어(`u.s`)·이니셜은 몇 글자라 이보다 긴 토큰은 약어가 아니다. */
const TOKEN_LOOKBACK_CHARS = 16;

/** 마침표 바로 앞 토큰이 약어·이니셜인가. 앞부분 전체를 복사하지 않고 마침표 앞 몇 글자만 본다. */
function endsWithAbbreviation(text: string, dotIndex: number): boolean {
    const before = text.slice(
        Math.max(0, dotIndex - TOKEN_LOOKBACK_CHARS),
        dotIndex
    );
    const token = (/(\S+)$/.exec(before)?.[1] ?? '')
        .replace(/^[("“]+/, '')
        .toLowerCase();
    return ABBREVIATIONS.has(token) || INITIAL.test(token);
}

/**
 * 문단의 첫 문장. `Inc.`·`U.S.`·한 글자 이니셜의 마침표에서는 끊지 않는다. 앞 2,000자 안에 끝나는 곳이 없으면 그
 * 2,000자(호출자가 200자에서 다시 자른다).
 */
export function firstSentence(paragraph: string): string {
    const head = paragraph.slice(0, SENTENCE_SCAN_MAX_CHARS);
    const end = [...head.matchAll(SENTENCE_END)].find(
        match =>
            !match[0].startsWith('.') ||
            !endsWithAbbreviation(head, match.index)
    );
    return end === undefined ? head : head.slice(0, end.index + end[0].length);
}
