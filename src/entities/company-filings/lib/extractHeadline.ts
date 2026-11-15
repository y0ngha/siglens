import { cutAtWordBoundary, HEADLINE_MAX_CHARS } from './cutAtWordBoundary';
import { stripExhibitPreamble } from './stripExhibitPreamble';

const HEADLINE_MIN_CHARS = 10;
/** 문단이 이보다 길면 제목이 아니라 본문·법적 고지다. */
const BODY_PARAGRAPH_MAX_CHARS = 300;
/** 이 길이를 채운 뒤에 빈 줄이 나오면 제목이 끝난 것이다(짧은 제목은 빈 줄을 건너 이어 붙인다). */
const BLANK_LINE_STOP_MIN_CHARS = 120;
const TOC_NUMBER_MIN_COUNT = 4;

const MONTH =
    '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
/** `October 26, 2026`, `Nov. 13, 2026`, `26 October 2026`. */
const DATELINE = new RegExp(
    `\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b|\\b\\d{1,2}\\s+${MONTH}\\.?,?\\s+\\d{4}\\b`,
    'i'
);
const BULLET = /^[●•·\-*–]/;
/** `For the month ended: …`, `To : …` 같은 양식 필드. */
const FORM_FIELD = /^[A-Z][A-Za-z ]{0,30}:\s/;
const PAGE_MARKER = /^Page \d+ of \d+/i;
/** `FF301` 같은 짧은 양식 코드. */
const FORM_CODE = /^[A-Z0-9]{2,8}$/;
const VERSION_TAG = /^v\s?\d+(?:\.\d+)*$/i;
const BOILERPLATE_LINE =
    /^(?:FOR IMMEDIATE RELEASE|PRESS RELEASE|MEDIA CONTACTS?|INVESTOR CONTACTS?|CONTACTS?)\b/i;
const INLINE_EXHIBIT = /\b(?:Exhibit|EX)[-\s]*99(?:\.\d+)?\b/gi;
const TRAILING_PAGE_NUMBER = /\s+\d{1,2}\s*$/;

function isTocLine(line: string): boolean {
    return (
        (line.match(/(?:^|\s)\d{2}(?=\s|$)/g)?.length ?? 0) >=
        TOC_NUMBER_MIN_COUNT
    );
}

/** 제목이 시작될 수 없는 줄: 양식·페이지 표지, 목차, 불릿, 보도자료 상투 문구. */
function isSkippableStart(line: string): boolean {
    return (
        PAGE_MARKER.test(line) ||
        FORM_CODE.test(line) ||
        VERSION_TAG.test(line) ||
        isTocLine(line) ||
        BULLET.test(line) ||
        BOILERPLATE_LINE.test(line)
    );
}

/** 제목 중간에서 이어 붙이기를 멈추게 하는 줄. */
function endsHeadline(line: string): boolean {
    return (
        DATELINE.test(line) ||
        BULLET.test(line) ||
        FORM_FIELD.test(line) ||
        isTocLine(line)
    );
}

/** 한 번의 제목 후보 이어 붙이기가 훑는 줄 수의 상한 — 빈 줄·짧은 줄이 수천 개여도 비용이 일정하다. */
const MAX_SCAN_LINES = 100;

interface Collecting {
    text: string;
    done: boolean;
}

/** `start`줄부터 정지 조건(날짜줄·불릿·양식 필드·목차·충분히 긴 뒤의 빈 줄·`cap`자)까지 한 줄로 이어 붙인다. */
function collect(lines: readonly string[], start: number, cap: number): string {
    return lines.slice(start, start + MAX_SCAN_LINES).reduce<Collecting>(
        (acc, raw, offset) => {
            if (acc.done || acc.text.length >= cap)
                return { ...acc, done: true };
            const line = raw.trim();
            if (line === '')
                return acc.text.length >= BLANK_LINE_STOP_MIN_CHARS
                    ? { ...acc, done: true }
                    : acc;
            if (offset > 0 && endsHeadline(line)) return { ...acc, done: true };
            return { ...acc, text: `${acc.text} ${line}`.trim() };
        },
        { text: '', done: false }
    ).text;
}

function paragraphEnd(lines: readonly string[], from: number): number {
    const blank = lines.findIndex(
        (line, index) => index > from && line.trim() === ''
    );
    return blank === -1 ? lines.length : blank;
}

/** 문단(빈 줄로 구분된 연속 줄)의 첫 줄 위치들. */
function paragraphStarts(lines: readonly string[]): number[] {
    return lines.flatMap((line, index) =>
        line.trim() !== '' && (index === 0 || lines[index - 1].trim() === '')
            ? [index]
            : []
    );
}

/**
 * 문단 순서대로 후보를 시험한다: 문단 안의 첫 "시작 가능한 줄"(양식·목차·불릿 등이 아닌 줄)에서 이어 붙이고,
 * 300자를 넘으면 그 문단은 본문·법적 고지로 보고 통째로 버린다. 줄마다 재귀하지 않으므로 건너뛸 줄이 수만 개여도
 * 호출 스택이 늘지 않는다.
 */
function findHeadlineText(lines: readonly string[]): string | null {
    for (const from of paragraphStarts(lines)) {
        const end = paragraphEnd(lines, from);
        const offset = lines
            .slice(from, end)
            .findIndex(line => !isSkippableStart(line.trim()));
        if (offset === -1) continue;
        const start = from + offset;
        const probe = collect(lines, start, BODY_PARAGRAPH_MAX_CHARS + 1);
        if (probe.length <= BODY_PARAGRAPH_MAX_CHARS)
            return collect(lines, start, HEADLINE_MAX_CHARS);
    }
    return null;
}

/** 줄 안에 남은 `Exhibit 99.1` 토큰과 그 앞에 붙어 있던 쪽 번호(`Q3 2026 Update 1 Exhibit 99.1`의 `1`)를 지운다. */
function cleanHeadline(raw: string): string {
    const withoutTokens = raw.replace(INLINE_EXHIBIT, ' ');
    const withoutPage =
        withoutTokens === raw
            ? withoutTokens
            : withoutTokens.replace(TRAILING_PAGE_NUMBER, '');
    return withoutPage.replace(/\s+/g, ' ').trim();
}

/**
 * 보도자료·첨부 평문(`htmlToText` 결과)에서 제목을 뽑는다.
 *
 * 1. 맨 앞의 첨부 표지 찌꺼기를 걷어 낸다(`stripExhibitPreamble`).
 * 2. 시작 줄을 고른다: 양식·페이지 표지(`FF301`, `Page 1 of 10`, `v 1.2.1`), 목차, 불릿, 상투 문구는 건너뛰고, 이어
 *    붙였을 때 300자를 넘는 문단(본문·법적 고지)은 문단째 건너뛴다.
 * 3. 시작 줄부터 다음 줄들을 공백 하나로 이어 붙이다가 날짜줄(`October 26, 2026`)·불릿·양식 필드(`To : …`)·목차 줄,
 *    120자를 채운 뒤의 빈 줄, 200자 중 가장 먼저 오는 곳에서 멈춘다(부제는 제목에 붙고 본문 첫 불릿에서 끊긴다).
 * 4. 줄 안의 `Exhibit 99.1` 토큰과 그 앞의 쪽 번호를 지우고 200자 안에서 단어 경계로 자른다. 10자 미만이면 `null`.
 */
export function extractHeadline(text: string): string | null {
    const lines = stripExhibitPreamble(text).split('\n');
    const raw = findHeadlineText(lines);
    if (raw === null) return null;
    const headline = cutAtWordBoundary(cleanHeadline(raw));
    return headline.length >= HEADLINE_MIN_CHARS ? headline : null;
}
