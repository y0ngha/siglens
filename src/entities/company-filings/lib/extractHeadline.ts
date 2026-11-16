import {
    cutAtWordBoundary,
    HEADLINE_MAX_CHARS,
    HEADLINE_MIN_CHARS,
} from './cutAtWordBoundary';
import { firstSentence } from './firstSentence';
import { stripExhibitPreamble } from './stripExhibitPreamble';

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
/** `FF301` 같은 짧은 양식 코드(숫자가 섞인다 — `DATE`처럼 대문자뿐인 단어는 제목의 첫 줄일 수 있다). */
const FORM_CODE = /^(?=[A-Z]*\d)[A-Z0-9]{2,8}$/;
const VERSION_TAG = /^v\s?\d+(?:\.\d+)*$/i;
const BOILERPLATE_LINE =
    /^(?:FOR IMMEDIATE RELEASE|PRESS RELEASE|MEDIA CONTACTS?|INVESTOR CONTACTS?|CONTACTS?|Indicate by check mark|This announcement is\b|Hong Kong Exchanges and Clearing)\b/i;
/**
 * 줄 전체가 표지 라벨인 줄. `News Release Archive Shows …` 같은 제목의 첫 단어와 겹치지 않게 줄 끝(또는 구분 기호)까지
 * 맞춘다.
 */
const LABEL_LINE =
    /^(?:MEDIA RELEASE|NEWS RELEASE|EXPLANATORY NOTE)(?:\s*$|\s*[:–—-])/i;
/** 체크 표시·한두 글자 조각(`☒`, `o`, `x`). */
const TINY_LINE = /^.{1,2}$/u;
/** 표지 조각만 남은 줄: `Exhibit`, `99.1`(첨부 번호가 줄로 쪼개진 표지). */
const EXHIBIT_FRAGMENT = /^(?:Exhibit|EX-?99(?:\.\d+)?|\d{1,3}\.\d{1,2})$/i;
/** 한자·가나 덩어리와 전각 괄호·구두점. 영문 공시의 병기 회사명(`阿里巴巴集團控股有限公司`)이다. */
const CJK_RUN =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff08\uff09\uff0c\uff1a\uff1b]+/gu;
const LATIN_OR_DIGIT = /[A-Za-z0-9]/;
/** 회사명 다음 줄의 상장 표기(`("TSMC"; NYSE: TSM)`). */
const TICKER_LINE =
    /^\(.*\b(?:NYSE|NASDAQ|Nasdaq|TWSE|HKEX|SGX|LSE|TSX)\s*:.*\)$/;
/** 회사명 줄 뒤에서 상장 표기 줄을 찾아볼 줄 수. */
const TICKER_LOOKAHEAD_LINES = 3;
/** 홍콩 상장사 공고의 `(Stock Code: 9988 …)` 문단. 그 앞은 면책 고지·의결권 고지·회사명이다. */
const STOCK_CODE = /^[(（]?\s*Stock\s+Code\s*[:：]/i;
/** `(Stock Code: …)` 괄호가 닫히는 줄의 끝. 제목이 빈 줄 없이 바로 다음 줄에 붙는 공고가 있다(`9868）` ⏎ `NOTICE OF …`). */
const CLOSING_PAREN = /[)）]$/;
/**
 * `* 僅供識別 For identification purposes only` — 홍콩 보고서 표지의 한자 회사명 각주. 이 뒤는 제목이 아니다.
 * `cleanHeadline`만 쓰고, 그 입력은 제목 후보(이어 붙이기 300자, 첫 문장 2,000자 상한)라 앞쪽 `\s*`의 재시도가
 * 길어지지 않는다.
 */
const IDENTIFICATION_NOTE = /\*?\s*For identification purposes only[\s\S]*$/i;
/** 주주 서한 인사말(`Dear Shareholder:`). */
const SALUTATION = /^Dear\s[^.!?]{1,60}[:,]$/;
/** 홍콩 공고 표기·서한 인사말을 찾는 앞쪽 문단 수. */
const LEAD_PARAGRAPHS = 40;
/**
 * 제목 후보를 찾는 앞쪽 문단 수. 실측 공시의 제목은 면책·의결권 고지·표지 조각 뒤 수십 문단 안에 있다. 문단마다
 * 최대 100줄을 이어 붙여 보므로, 상한이 없으면 건너뛸 문단이 수만 개인 256KB 입력에서 상수배가 커진다.
 */
const HEADLINE_SCAN_PARAGRAPHS = 120;
/** 날짜줄에서 날짜 앞에 올 수 있는 장소 표기(`SHANGHAI, China,`)의 최대 길이. */
const DATELINE_PLACE_MAX_CHARS = 80;
/** 장소 표기는 쉼표·마침표·대시·빗금으로 날짜와 이어진다. 본문 문장 속 날짜(`period ended June 30, 2026`)는 아니다. */
const DATELINE_PLACE_TAIL = /[,.–—/-]$/;
/**
 * 연락처(이메일·미국 전화번호)가 든 후보. `NEWS RELEASE` ⏎ `Contact:` 뒤의 담당자 블록은 제목이 아니다. 이메일은
 * `@` 바로 앞 한 글자만 확인한다 — `[\w.+-]{1,64}@`처럼 앞쪽을 길게 잡으면 위치마다 64글자를 되짚어 제목 후보마다
 * 수천 단계가 되고, 무한 수량자(`[\w]+@`)면 256KB 단어 덩어리에서 제곱 시간이 된다(SERVER.md#SA-23).
 */
const CONTACT_INFO =
    /[\w.+-]@[\w-]{1,63}\.[a-z]{2,10}\b|\(\d{3}\)\s?\d{3}-\d{4}/i;
/** 제목다운 줄: 네 글자 이상 단어의 이 비율 이상이 대문자·숫자로 시작한다(Title Case). */
const TITLE_CASE_MIN_RATIO = 0.6;
const TITLE_CASE_MIN_WORDS = 4;
/** 문장처럼 끝나는 문단은 제목이 아니다(레터헤드의 `Inc.`, 본문 조각). */
const SENTENCE_TAIL = /[.;:,]$/;
const INLINE_EXHIBIT = /\b(?:Exhibit|EX)[-\s]*99(?:\.\d+)?\b/gi;
const TRAILING_PAGE_NUMBER = /\s+\d{1,2}\s*$/;

function isTocLine(line: string): boolean {
    return (
        (line.match(/(?:^|\s)\d{2}(?=\s|$)/g)?.length ?? 0) >=
        TOC_NUMBER_MIN_COUNT
    );
}

function withoutCjk(line: string): string {
    return line
        .replace(CJK_RUN, ' ')
        .replace(/\(\s*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 제목이 시작될 수 없는 줄: 양식·페이지 표지, 목차, 불릿, 보도자료 상투 문구, 한자뿐인 줄, 체크 표시, 상장 표기. */
function isSkippableStart(line: string): boolean {
    return (
        TINY_LINE.test(line) ||
        EXHIBIT_FRAGMENT.test(line) ||
        !LATIN_OR_DIGIT.test(withoutCjk(line)) ||
        TICKER_LINE.test(line) ||
        LABEL_LINE.test(line) ||
        PAGE_MARKER.test(line) ||
        FORM_CODE.test(line) ||
        VERSION_TAG.test(line) ||
        isTocLine(line) ||
        BULLET.test(line) ||
        BOILERPLATE_LINE.test(line)
    );
}

/** 날짜가 줄 맨 앞이거나 장소 표기(`SHANGHAI, China,`) 바로 뒤에 오는 날짜줄. 본문 문장 속 날짜는 아니다. */
function isDateline(line: string): boolean {
    const match = DATELINE.exec(line);
    if (match === null) return false;
    const place = line.slice(0, match.index).trim();
    return (
        place === '' ||
        (place.length <= DATELINE_PLACE_MAX_CHARS &&
            DATELINE_PLACE_TAIL.test(place))
    );
}

/** 제목 중간에서 이어 붙이기를 멈추게 하는 줄. */
function endsHeadline(line: string): boolean {
    return (
        isDateline(line) ||
        BULLET.test(line) ||
        FORM_FIELD.test(line) ||
        isTocLine(line)
    );
}

/** 한 번의 제목 후보 이어 붙이기가 훑는 줄 수의 상한 — 빈 줄·짧은 줄이 수천 개여도 비용이 일정하다. */
const MAX_SCAN_LINES = 100;
/**
 * 빈 줄 뒤 문단이 본문인지 볼 때 읽는 줄 수. 300자를 넘는지·문장처럼 끝나는지만 보면 되므로 몇 줄이면 된다 —
 * 이보다 긴 문단은 300자를 넘거나 문장 끝이 이 안에 없어도 본문으로 본다.
 */
const NEXT_PARAGRAPH_SCAN_LINES = 8;

interface Collecting {
    text: string;
    done: boolean;
}

/**
 * 빈 줄 `blank` 다음 문단이 본문처럼 보이는가: 문장처럼(`.`·`,`·`:`) 끝나거나 300자를 넘는다. 짧은 제목은 빈 줄을
 * 건너 부제(마침표 없이 끝나는 긴 줄 포함)를 이어 붙이지만, 본문 문단(`Our board of directors will … announcement.`)이나
 * 인사말(`Dear Shareholders,`)은 붙이지 않는다.
 */
function bodyFollows(lines: readonly string[], blank: number): boolean {
    // 다음 문단은 짧은 구간(NEXT_PARAGRAPH_SCAN_LINES) 안에서만 본다 — 이어 붙이기는 빈 줄마다 이 함수를 부르므로 구간이
    // 길면 시작 줄 수 × 빈 줄 수 × 구간이 된다. 0번 줄부터 다시 훑으면 빈 줄마다 문서 전체가 된다.
    const window = lines.slice(
        blank + 1,
        blank + 1 + NEXT_PARAGRAPH_SCAN_LINES
    );
    const first = window.findIndex(line => line.trim() !== '');
    if (first === -1) return true;
    const blankAfter = window.findIndex(
        (line, index) => index > first && line.trim() === ''
    );
    // 구간 안에서 문단이 끝나지 않으면(8줄 넘게 이어지는 문단) 본문이다.
    if (blankAfter === -1 && blank + 1 + window.length < lines.length)
        return true;
    const text = paragraphText(
        window,
        first,
        blankAfter === -1 ? window.length : blankAfter
    );
    // 첫 줄이 `News Highlights:`·`Contact:` 같은 라벨이면 그 문단도 제목이 아니다.
    return (
        text.length > BODY_PARAGRAPH_MAX_CHARS ||
        SENTENCE_TAIL.test(text) ||
        SENTENCE_TAIL.test(window[first].trim())
    );
}

/**
 * `start`줄부터 정지 조건(날짜줄·불릿·양식 필드·목차·충분히 긴 뒤의 빈 줄·본문 문단 앞의 빈 줄·`cap`자)까지 한 줄로
 * 이어 붙인다.
 */
function collect(lines: readonly string[], start: number, cap: number): string {
    return lines.slice(start, start + MAX_SCAN_LINES).reduce<Collecting>(
        (acc, raw, offset) => {
            if (acc.done) return acc;
            if (acc.text.length >= cap) return { ...acc, done: true };
            const line = raw.trim();
            if (line === '')
                return acc.text.length >= BLANK_LINE_STOP_MIN_CHARS ||
                    bodyFollows(lines, start + offset)
                    ? { ...acc, done: true }
                    : acc;
            if (offset > 0 && endsHeadline(line)) return { ...acc, done: true };
            return { ...acc, text: `${acc.text} ${line}`.trim() };
        },
        { text: '', done: false }
    ).text;
}

/** 바로 뒤(몇 줄 안)에 상장 표기 줄이 오는 회사명 줄 — `Taiwan Semiconductor … Limited` + `("TSMC"; NYSE: TSM)`. */
function isRegistrantName(lines: readonly string[], index: number): boolean {
    const next = lines
        .slice(index + 1, index + 1 + TICKER_LOOKAHEAD_LINES)
        .find(line => line.trim() !== '');
    return next !== undefined && TICKER_LINE.test(next.trim());
}

function paragraphText(
    lines: readonly string[],
    start: number,
    end: number
): string {
    return lines
        .slice(start, end)
        .map(line => line.trim())
        .filter(line => line !== '')
        .join(' ');
}

/** 문단(빈 줄로 구분된 연속 줄)의 `[from, end)` 구간. */
interface Paragraph {
    from: number;
    end: number;
}

/**
 * 문단 구간을 한 번에 구한다. 문단 k의 끝은 다음 문단의 시작 전까지만 찾으므로 전체가 줄 수에 비례한다 — 문단마다
 * 0번 줄부터 빈 줄을 다시 찾으면 건너뛸 문단이 많은 256KB 입력에서 제곱 시간이 된다(SERVER.md#SA-23).
 */
function paragraphSpans(lines: readonly string[]): Paragraph[] {
    const starts = lines.flatMap((line, index) =>
        line.trim() !== '' && (index === 0 || lines[index - 1].trim() === '')
            ? [index]
            : []
    );
    return starts.map((from, k) => {
        const limit = starts[k + 1] ?? lines.length;
        const blank = lines
            .slice(from, limit)
            .findIndex(line => line.trim() === '');
        return { from, end: blank === -1 ? limit : from + blank };
    });
}

/** 300자를 넘는 문단을 만났을 때: 건너뛰거나(보도자료), 그 첫 문장을 제목 대용으로 쓴다(제목 없는 6-K 본문). */
type LongParagraph = 'skip' | 'firstSentence';

/**
 * 문단 순서대로 후보를 시험한다: 문단 안의 첫 "시작 가능한 줄"(양식·목차·불릿 등이 아닌 줄)에서 이어 붙이고,
 * 300자를 넘으면 그 문단은 본문·법적 고지로 본다. 다만 120자 미만의 짧은 문단이 빈 줄을 건너 본문과 이어 붙어
 * 길어진 것이면(`DATE OF BOARD MEETING` + 본문) 그 문단 하나가 제목이다. 줄마다 재귀하지 않으므로 건너뛸 줄이
 * 수만 개여도 호출 스택이 늘지 않는다.
 */
function findHeadlineText(
    lines: readonly string[],
    longParagraph: LongParagraph
): string | null {
    // 제목은 문서 앞쪽에 있다 — 건너뛸 문단이 수만 개인 입력에서도 문단마다 이어 붙이기를 다시 하지 않게 앞쪽만 본다.
    for (const { from, end } of paragraphSpans(lines).slice(
        0,
        HEADLINE_SCAN_PARAGRAPHS
    )) {
        const offset = lines
            .slice(from, end)
            .findIndex(
                (line, i) =>
                    !isSkippableStart(line.trim()) &&
                    !isRegistrantName(lines, from + i)
            );
        if (offset === -1) continue;
        const candidate = paragraphCandidate(
            lines,
            { from, start: from + offset, end },
            longParagraph
        );
        const usable =
            candidate === null || !CONTACT_INFO.test(candidate)
                ? candidate
                : titleBeforeContact(lines, from + offset, end);
        // 표지 조각(`Exhibit 99.1`)뿐이라 지우고 나면 10자가 안 되는 후보는 다음 문단으로 넘어간다.
        if (
            usable !== null &&
            cleanHeadline(usable).length >= HEADLINE_MIN_CHARS
        )
            return usable;
    }
    return null;
}

/**
 * 연락처가 섞인 후보: 시작 줄부터 연락처 줄 앞까지가 Title Case 제목이면 그것을 쓰고(`Acme Announces Strong Results` ⏎
 * `Call (212) 555-1234 …`), 아니면 담당자 블록(`Brandi Martina` ⏎ `AMD Communications` ⏎ `(512) …`)이라 `null`.
 */
function titleBeforeContact(
    lines: readonly string[],
    start: number,
    end: number
): string | null {
    const span = lines.slice(start, end).map(line => line.trim());
    const contact = span.findIndex(line => CONTACT_INFO.test(line));
    const title = span
        .slice(0, contact === -1 ? span.length : contact)
        .join(' ');
    return isTitleCase(title) ? title : null;
}

/** 문단(`from`~`end`) 안의 시작 줄 `start`. 시작 줄 앞의 줄들은 건너뛸 줄(양식·상투 문구)이다. */
interface ParagraphSpan {
    from: number;
    start: number;
    end: number;
}

/** 문단 하나에서 `start`줄부터 뽑은 제목 후보. 본문 문단이면(그리고 `skip`이면) `null`. */
function paragraphCandidate(
    lines: readonly string[],
    { from, start, end }: ParagraphSpan,
    longParagraph: LongParagraph
): string | null {
    const probe = collect(lines, start, BODY_PARAGRAPH_MAX_CHARS + 1);
    if (probe.length <= BODY_PARAGRAPH_MAX_CHARS)
        return collect(lines, start, HEADLINE_MAX_CHARS);
    const own = paragraphText(lines, start, end);
    if (own.length < BLANK_LINE_STOP_MIN_CHARS && !SENTENCE_TAIL.test(own))
        return own;
    // 제목 줄 바로 뒤에 빈 줄 없이 요점 줄들이 이어진 보도자료(`SoFi Reports …` ⏎ `Adjusted Net Revenue up 44% …`).
    // 문단 첫 줄일 때만 — 상투 줄을 건너뛴 뒤의 줄은 면책 고지의 둘째 줄(`Limited and The Stock Exchange …`)일 수 있다.
    const first = lines[start].trim();
    if (
        start === from &&
        first.length <= HEADLINE_MAX_CHARS &&
        isTitleCase(first)
    )
        return first;
    return longParagraph === 'firstSentence' ? firstSentence(own) : null;
}

/**
 * 네 글자 이상 단어의 60% 이상이 대문자·숫자로 시작하고 문장처럼 끝나지 않는 줄. 줄바꿈으로 잘린 본문 조각
 * (`For our interim reporting with the Hong Kong Stock`)은 소문자 단어가 많아 걸러진다.
 */
function isTitleCase(line: string): boolean {
    if (SENTENCE_TAIL.test(line)) return false;
    const words = line.split(/\s+/).filter(word => word.length >= 4);
    if (words.length < TITLE_CASE_MIN_WORDS) return false;
    const capitalized = words.filter(word => /^[\p{Lu}\d$“"(]/u.test(word));
    return capitalized.length / words.length >= TITLE_CASE_MIN_RATIO;
}

/** 앞쪽 문단들의 (시작 줄, 평문). */
function leadParagraphs(
    lines: readonly string[]
): (Paragraph & { text: string })[] {
    return paragraphSpans(lines)
        .slice(0, LEAD_PARAGRAPHS)
        .map(span => ({
            ...span,
            text: paragraphText(lines, span.from, span.end),
        }));
}

/** 홍콩 상장사 공고는 `(Stock Code: …)` 문단 뒤부터 본다. 그 앞은 면책·의결권 고지와 회사명(한자 병기)이다. */
function afterStockCode(lines: readonly string[]): readonly string[] {
    const hit = leadParagraphs(lines).find(p => STOCK_CODE.test(p.text));
    if (hit === undefined) return lines;
    const closing = lines
        .slice(hit.from, hit.end)
        .findIndex(line => CLOSING_PAREN.test(line.trim()));
    return lines.slice(closing === -1 ? hit.end : hit.from + closing + 1);
}

/**
 * 주주 서한: 인사말(`Dear Shareholder:`) 앞에 날짜줄만 있는 문단(레터헤드)이 있으면, 주소가 제목으로 뽑히지 않게
 * 인사말 다음 문단의 첫 문장을 제목 대용으로 쓴다. 레터헤드가 아니면(`Letter to Shareholders` 제목) `null`.
 */
function letterOpening(lines: readonly string[]): string | null {
    const paragraphs = leadParagraphs(lines);
    const salutation = paragraphs.findIndex(p => SALUTATION.test(p.text));
    if (salutation <= 0) return null;
    const hasDateOnly = paragraphs
        .slice(0, salutation)
        .some(p => DATELINE.exec(p.text)?.[0] === p.text);
    const opening = paragraphs[salutation + 1];
    return hasDateOnly && opening !== undefined
        ? firstSentence(opening.text)
        : null;
}

/** 줄 안에 남은 `Exhibit 99.1` 토큰과 그 앞에 붙어 있던 쪽 번호(`Q3 2026 Update 1 Exhibit 99.1`의 `1`)를 지운다. */
function cleanHeadline(raw: string): string {
    const withoutTokens = raw.replace(INLINE_EXHIBIT, ' ');
    const withoutPage =
        withoutTokens === raw
            ? withoutTokens
            : withoutTokens.replace(TRAILING_PAGE_NUMBER, '');
    return withoutCjk(withoutPage.replace(IDENTIFICATION_NOTE, '')).replace(
        /\s*\*+$/,
        ''
    );
}

/**
 * 보도자료·첨부 평문(`htmlToText` 결과)에서 제목을 뽑는다.
 *
 * 1. 맨 앞의 첨부 표지 찌꺼기를 걷어 낸다(`stripExhibitPreamble`). 홍콩 상장사 공고면 `(Stock Code: …)` 문단 뒤부터 본다.
 * 2. 주주 서한(레터헤드 + `Dear Shareholder:`)이면 인사말 다음 문단의 첫 문장을 쓴다.
 * 3. 시작 줄을 고른다: 양식·페이지 표지(`FF301`, `Page 1 of 10`, `v 1.2.1`), 목차, 불릿, 상투 문구, 한자뿐인 줄, 체크
 *    표시, 상장 표기와 그 앞의 회사명은 건너뛰고, 이어 붙였을 때 300자를 넘는 문단(본문·법적 고지)은 문단째
 *    건너뛴다 — 120자 미만의 짧은 문단이 본문과 이어 붙어 길어진 경우만 그 문단 하나가 제목이다.
 * 4. 시작 줄부터 다음 줄들을 공백 하나로 이어 붙이다가 날짜줄(`October 26, 2026`, `SHANGHAI, China, Sept. 1, 2026` —
 *    본문 문장 속 날짜는 아니다)·불릿·양식 필드(`To : …`)·목차 줄, 120자를 채운 뒤의 빈 줄, 200자 중 가장 먼저 오는
 *    곳에서 멈춘다(부제는 제목에 붙고 본문 첫 불릿에서 끊긴다).
 * 5. 줄 안의 `Exhibit 99.1` 토큰과 그 앞의 쪽 번호, 한자 병기, 끝의 `*`를 지우고 200자 안에서 단어 경계로 자른다.
 *    10자 미만이면 `null`.
 */
export function extractHeadline(text: string): string | null {
    return extractWith(text, 'skip');
}

/**
 * 제목 줄이 따로 없는 본문(6-K 표지 안의 설명, 서명란 뒤 본문)용: `extractHeadline`과 같되, 짧은 제목 후보가 없으면
 * 첫 본문 문단의 첫 문장을 제목 대용으로 쓴다(`This is to report 1) the changes in …`).
 */
export function extractLeadHeadline(text: string): string | null {
    return extractWith(text, 'firstSentence');
}

function extractWith(
    text: string,
    longParagraph: LongParagraph
): string | null {
    const lines = afterStockCode(stripExhibitPreamble(text).split('\n'));
    const raw = letterOpening(lines) ?? findHeadlineText(lines, longParagraph);
    if (raw === null) return null;
    const headline = cutAtWordBoundary(cleanHeadline(raw));
    return headline.length >= HEADLINE_MIN_CHARS ? headline : null;
}
