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

function endsWithAbbreviation(before: string): boolean {
    const token = (/(\S+)$/.exec(before)?.[1] ?? '')
        .replace(/^[("“]+/, '')
        .toLowerCase();
    return ABBREVIATIONS.has(token) || INITIAL.test(token);
}

/** 문단의 첫 문장. `Inc.`·`U.S.`·한 글자 이니셜의 마침표에서는 끊지 않는다. 끝나는 곳이 없으면 문단 전체. */
export function firstSentence(paragraph: string): string {
    const end = [...paragraph.matchAll(SENTENCE_END)].find(
        match =>
            !match[0].startsWith('.') ||
            !endsWithAbbreviation(paragraph.slice(0, match.index))
    );
    return end === undefined
        ? paragraph
        : paragraph.slice(0, end.index + end[0].length);
}
