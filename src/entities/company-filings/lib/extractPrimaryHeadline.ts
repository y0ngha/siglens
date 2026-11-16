import { cutAtWordBoundary, HEADLINE_MIN_CHARS } from './cutAtWordBoundary';
import { extractLeadHeadline } from './extractHeadline';
import { firstSentence } from './firstSentence';

const SKIPPED_ITEM = '9.01';
/** `Item 8.01. Other Events.`, `Item 8.01`(번호만 있는 줄). */
const ITEM_HEADING = /^Item\s+(\d{1,2}\.\d{2})\b[.:\s–—-]*(.*)$/i;
function itemNumber(line: string): string | null {
    return ITEM_HEADING.exec(line)?.[1] ?? null;
}

/** 항목 제목 뒤에서 제목 줄·본문·본문 끝(빈 줄)을 찾는 줄 수의 상한. 본문 첫 문단이 이보다 길면 여기서 끊는다. */
const ITEM_SCAN_MAX_LINES = 200;

/**
 * `from` 다음 줄부터 최대 `ITEM_SCAN_MAX_LINES`줄 안에서 `matches`인 첫 줄의 인덱스(없으면 -1). 남은 줄 전체를
 * 복사(`slice(from + 1)`)하거나 0번 줄부터 다시 훑으면 항목 수 × 줄 수가 된다 — 항목 제목이 빽빽한 256KB
 * 문서에서 초 단위가 걸려(SERVER.md#SA-23) 길이를 정한 구간만 본다.
 */
function indexAfter(
    lines: readonly string[],
    from: number,
    matches: (line: string) => boolean
): number {
    const offset = lines
        .slice(from + 1, from + 1 + ITEM_SCAN_MAX_LINES)
        .findIndex(matches);
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
    // 빈 줄이 구간 안에 없으면 구간 끝에서 자른다 — 문서 끝까지 이어 붙이면 항목마다 문서 전체를 다시 만든다.
    return lines
        .slice(first, blank === -1 ? first + ITEM_SCAN_MAX_LINES : blank)
        .join(' ');
}

/** 6-K 표지의 첨부 목록 줄(`99.1 Press release dated …`)에서 설명을 뽑는다. */
const EXHIBIT_INDEX_LINE = /^(?:Exhibit\s+)?99\.\d+\s*[—–:\-.]?\s*(.{15,})$/i;
/** 표 칸이 줄로 풀려 번호와 설명이 다른 줄인 첨부 목록(`99.1` ⏎ `Announcement—Date of Board Meeting`). */
const EXHIBIT_NUMBER_LINE = /^(?:Exhibit\s+)?99\.\d+$/i;
const EXHIBIT_DESCRIPTION_MIN_CHARS = 15;
/** 번호 줄 뒤에서 설명 줄을 찾는 줄 수(빈 줄 몇 개를 건너뛸 만큼). */
const EXHIBIT_DESCRIPTION_LOOKAHEAD_LINES = 4;

function exhibitIndexDescription(lines: readonly string[]): string | null {
    for (const [index, line] of lines.entries()) {
        const description = EXHIBIT_INDEX_LINE.exec(line)?.[1];
        if (description !== undefined) return description.trim();
        if (!EXHIBIT_NUMBER_LINE.test(line)) continue;
        // 바로 뒤 몇 줄만 본다 — 나머지 전체를 복사해 찾으면 `99.1` 줄이 많은 256KB 입력에서 제곱 시간이 된다.
        const next = lines
            .slice(index + 1, index + 1 + EXHIBIT_DESCRIPTION_LOOKAHEAD_LINES)
            .find(candidate => candidate !== '');
        if (
            next !== undefined &&
            next.length >= EXHIBIT_DESCRIPTION_MIN_CHARS &&
            !SIGNATURES.test(next)
        )
            return next;
    }
    return null;
}

const SIGNATURES = /^SIGNATURES?$/i;
/** 6-K 표지의 마지막 양식 체크 줄(`Form 20-F x Form 40-F o`). 그 뒤부터 서명란 앞까지가 표지 안의 설명이다. */
const FORM_40F = /Form\s+40-F/i;
/** 서명란 칸: `By`·`Name`·`Title`·`Date` 칸, 칸 구분 조각, `/s/` 서명 줄. */
const SIGNATURE_FIELD = /^(?:By|Name|Title|Date)\b|^[:|]$|\/s\//i;
/** 서명자 직함 줄(`Senior Vice President and Chief Financial Officer`). */
const ROLE_TAIL =
    /\b(?:Officer|Director|President|Secretary|Counsel|Treasurer|Controller|Chairman|Chairperson|Manager|Attorney-in-Fact|CEO|CFO)\.?$/i;
const SIGNER = /\/s\/\s*(.+)$/;
/** `/s/` 서명 줄을 찾는 `SIGNATURES` 뒤 줄 수, 그 뒤 서명란으로 건너뛸 줄 수의 상한. */
const SIGNATURE_BLOCK_MAX_LINES = 15;

/** 서명란 다음 줄의 위치(서명 줄이 없으면 -1). 서명자 이름·직함·`Name`/`Title`/`Date` 칸을 건너뛴다. */
function afterSignatureBlock(
    lines: readonly string[],
    heading: number
): number {
    const signedOffset = lines
        .slice(heading + 1, heading + 1 + SIGNATURE_BLOCK_MAX_LINES)
        .findIndex(line => SIGNER.test(line));
    if (signedOffset === -1) return -1;
    const signed = heading + 1 + signedOffset;
    const signer = SIGNER.exec(lines[signed])?.[1]?.trim() ?? '';
    const restOffset = lines
        .slice(signed + 1, signed + 1 + SIGNATURE_BLOCK_MAX_LINES)
        .findIndex(
            line =>
                line !== '' &&
                line !== signer &&
                !SIGNATURE_FIELD.test(line) &&
                !ROLE_TAIL.test(line)
        );
    return restOffset === -1 ? -1 : signed + 1 + restOffset;
}

/**
 * Item 항목도 첨부 목록도 없는 6-K 주 문서(TSMC 이사회 결의, 주총 결과): 표지 체크 줄과 서명란 사이의 설명,
 * 그것이 없으면 서명란 뒤 본문에서 제목을 뽑는다. 6-K 표지(`Form 40-F` 체크 줄)가 아니면 `null`.
 */
function foreignIssuerBody(lines: readonly string[]): string | null {
    const heading = lines.findIndex(line => SIGNATURES.test(line));
    if (heading === -1) return null;
    const coverEnd = lines
        .slice(0, heading)
        .findLastIndex(line => FORM_40F.test(line));
    if (coverEnd === -1) return null;
    const cover = extractLeadHeadline(
        lines.slice(coverEnd + 1, heading).join('\n')
    );
    if (cover !== null) return cover;
    const body = afterSignatureBlock(lines, heading);
    return body === -1
        ? null
        : extractLeadHeadline(lines.slice(body).join('\n'));
}

/**
 * 보도자료 첨부가 없는 8-K 주 문서의 제목 대용: 9.01이 아닌 첫 `Item N.NN` 항목의 **본문 첫 문장**.
 * 항목 제목(`Other Events.`)은 항목 라벨과 겹쳐 정보가 없으므로 건너뛴다 — 제목이 같은 줄에 있든 다음 줄에 있든.
 * 문장은 `Inc.`·`Corp.`·`U.S.` 같은 약어의 마침표에서는 끝나지 않고, 200자 안에서 단어 경계로 자른다.
 * 조건에 맞는 항목이 없으면 6-K 표지의 첨부 목록 줄(`99.1 Press release …`)의 설명, 그것도 없으면 6-K 주 문서 본문
 * (표지 체크 줄과 서명란 사이의 설명, 아니면 서명란 뒤 본문)의 제목이나 첫 문장, 그것도 없으면 `null`.
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
    const cut = description === null ? '' : cutAtWordBoundary(description);
    if (cut.length >= HEADLINE_MIN_CHARS) return cut;
    // 첨부가 없는 6-K는 본문이 주 문서 안에 있다(표지 설명 또는 서명란 뒤).
    return foreignIssuerBody(lines);
}
