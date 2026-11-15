/** `EX-99.1`, `Exhibit 99.1`, `ionq-ex99_1.htm` 같은 첨부 표지 토큰. */
const EXHIBIT_TOKEN =
    /^(?:EX-?\s*99(?:\.\d+)?|Exhibit\s+99(?:\.\d+)?|[\w.-]+\.html?)(?=\s|$)\s*/i;
/** 첨부 표지 뒤에 붙는 SGML 문서 순번(`EX-99.1 3 ionq-ex99_1.htm`의 `3`). */
const DOCUMENT_SEQUENCE = /^\d{1,2}(?=\s)\s*/;
/** `PRESS RELEASE OF <회사> ISSUED ON OCTOBER 27, 2026` 표지 문구. */
const COVER_CAPTION =
    /^PRESS RELEASE OF\b.*?\bISSUED ON\s+[A-Za-z]+\s+\d{1,2},?\s*\d{4}\s*/i;
const BARE_SEQUENCE = /^\d{1,2}$/;

/** 한 줄 앞에 연달아 붙을 수 있는 표지 토큰 수의 상한(= 반복 횟수). 재귀 대신 이 횟수만큼 한 단계씩 벗긴다. */
const MAX_LEADING_MARKERS = 20;

interface StripState {
    rest: string;
    afterExhibit: boolean;
}

/** 표지 토큰·문구·순번 중 맨 앞의 하나를 벗긴다. 벗길 것이 없으면 같은 상태를 돌려준다. */
function stripOnce(state: StripState): StripState {
    const { rest, afterExhibit } = state;
    const caption = COVER_CAPTION.exec(rest);
    if (caption)
        return { rest: rest.slice(caption[0].length).trim(), afterExhibit };
    const token = EXHIBIT_TOKEN.exec(rest);
    if (token)
        return { rest: rest.slice(token[0].length).trim(), afterExhibit: true };
    const sequence = afterExhibit ? DOCUMENT_SEQUENCE.exec(rest) : null;
    if (sequence)
        return {
            rest: rest.slice(sequence[0].length).trim(),
            afterExhibit: true,
        };
    return state;
}

/** 줄 앞에 붙은 첨부 표지·표지 문구·파일명 토큰을 더 이상 줄지 않을 때까지 벗긴다(순번은 표지 뒤에서만). */
function stripLeadingMarkers(line: string): string {
    return Array.from({ length: MAX_LEADING_MARKERS }).reduce<StripState>(
        stripOnce,
        { rest: line.trim(), afterExhibit: false }
    ).rest;
}

function isPreambleLine(line: string): boolean {
    const trimmed = line.trim();
    return (
        trimmed === '' ||
        BARE_SEQUENCE.test(trimmed) ||
        stripLeadingMarkers(trimmed) === ''
    );
}

/**
 * 첨부 문서 맨 앞의 SGML 헤더 찌꺼기와 표지 문구를 걷어 낸다: 빈 줄, `EX-99.1`/`Exhibit 99.1` 표지, 한두 자리
 * 순번, 파일명, `PRESS RELEASE OF … ISSUED ON …` — 그 밖의 첫 줄이 나올 때까지. 본문 첫 줄 앞에 표지 토큰이 같은
 * 줄로 붙어 있어도(`EX-99.1 3 x.htm Exhibit 99.1 제목…`) 토큰만 벗기고 나머지를 남긴다. 전부 표지면 빈 문자열.
 */
export function stripExhibitPreamble(text: string): string {
    const lines = text.split('\n');
    const start = lines.findIndex(line => !isPreambleLine(line));
    if (start === -1) return '';
    return [stripLeadingMarkers(lines[start]), ...lines.slice(start + 1)].join(
        '\n'
    );
}
