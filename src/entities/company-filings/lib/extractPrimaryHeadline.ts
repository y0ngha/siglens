import { cutAtWordBoundary, HEADLINE_MIN_CHARS } from './cutAtWordBoundary';

const SKIPPED_ITEM = '9.01';
/** `Item 8.01. Other Events.`, `Item 8.01`(번호만 있는 줄). */
const ITEM_HEADING = /^Item\s+(\d{1,2}\.\d{2})\b[.:\s–—-]*(.*)$/i;
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

function itemNumber(line: string): string | null {
    return ITEM_HEADING.exec(line)?.[1] ?? null;
}

function endsWithAbbreviation(before: string): boolean {
    const token = (/(\S+)$/.exec(before)?.[1] ?? '')
        .replace(/^[("“]+/, '')
        .toLowerCase();
    return ABBREVIATIONS.has(token) || INITIAL.test(token);
}

function firstSentence(paragraph: string): string {
    const end = [...paragraph.matchAll(SENTENCE_END)].find(
        match =>
            !match[0].startsWith('.') ||
            !endsWithAbbreviation(paragraph.slice(0, match.index))
    );
    return end === undefined
        ? paragraph
        : paragraph.slice(0, end.index + end[0].length);
}

/**
 * `from` 다음 줄부터 `matches`인 첫 줄의 인덱스(없으면 -1). `lines.findIndex((_, i) => i > from && …)`는 매번 0번
 * 줄부터 훑어 항목 수 × 줄 수가 된다 — 항목 제목이 빽빽한 256KB 문서에서 초 단위가 걸려 구간만 본다.
 */
function indexAfter(
    lines: readonly string[],
    from: number,
    matches: (line: string) => boolean
): number {
    const offset = lines.slice(from + 1).findIndex(matches);
    return offset === -1 ? -1 : from + 1 + offset;
}

/** 항목 `heading`의 본문 첫 문단. 제목 줄 뒤에 본문 없이 곧바로 다음 항목이 오면 `null`. */
function bodyParagraph(
    lines: readonly string[],
    heading: number
): string | null {
    const inlineTitle = ITEM_HEADING.exec(lines[heading])?.[2] ?? '';
    // 번호만 있는 줄이면 다음 비어 있지 않은 줄이 제목이라 본문은 그 다음부터다.
    const titleLine =
        inlineTitle.trim() !== ''
            ? heading
            : indexAfter(lines, heading, line => line !== '');
    if (titleLine === -1) return null;
    const first = indexAfter(lines, titleLine, line => line !== '');
    if (first === -1 || itemNumber(lines[first]) !== null) return null;
    const blank = indexAfter(lines, first, line => line === '');
    return lines.slice(first, blank === -1 ? undefined : blank).join(' ');
}

/** 6-K 표지의 첨부 목록 줄(`99.1 Press release dated …`)에서 설명을 뽑는다. */
const EXHIBIT_INDEX_LINE = /^(?:Exhibit\s+)?99\.\d+\s*[—–:\-.]?\s*(.{15,})$/i;

function exhibitIndexDescription(lines: readonly string[]): string | null {
    for (const line of lines) {
        const description = EXHIBIT_INDEX_LINE.exec(line)?.[1];
        if (description !== undefined) return description.trim();
    }
    return null;
}

/**
 * 보도자료 첨부가 없는 8-K 주 문서의 제목 대용: 9.01이 아닌 첫 `Item N.NN` 항목의 **본문 첫 문장**.
 * 항목 제목(`Other Events.`)은 항목 라벨과 겹쳐 정보가 없으므로 건너뛴다 — 제목이 같은 줄에 있든 다음 줄에 있든.
 * 문장은 `Inc.`·`Corp.`·`U.S.` 같은 약어의 마침표에서는 끝나지 않고, 200자 안에서 단어 경계로 자른다.
 * 조건에 맞는 항목이 없으면 6-K 표지의 첨부 목록 줄(`99.1 Press release …`)의 설명, 그것도 없으면 `null`.
 */
export function extractPrimaryHeadline(text: string): string | null {
    const lines = text.split('\n').map(line => line.trim());
    const headings = lines.flatMap((line, index) => {
        const number = itemNumber(line);
        return number !== null && number !== SKIPPED_ITEM ? [index] : [];
    });
    // 항목 수만큼만 훑는다(재귀 없음). 본문이 있는 첫 항목의 첫 문장이 제목이다.
    for (const heading of headings) {
        const paragraph = bodyParagraph(lines, heading);
        if (paragraph === null) continue;
        const headline = cutAtWordBoundary(firstSentence(paragraph));
        if (headline.length >= HEADLINE_MIN_CHARS) return headline;
    }
    // Item 제목이 없는 6-K 표지는 첨부 목록의 99.x 설명이 가장 정보가 많다.
    const description = exhibitIndexDescription(lines);
    if (description === null) return null;
    const cut = cutAtWordBoundary(description);
    return cut.length >= HEADLINE_MIN_CHARS ? cut : null;
}
