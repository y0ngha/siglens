/** 표 셀 사이를 잇는 임시 구분자. 본문에 실제로 있는 `|`를 건드리지 않으려고 제어 문자를 쓴다. */
const CELL = '\u0001';
const CELL_SEPARATOR = ' | ';

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
    amp: '&',
    nbsp: ' ',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    ldquo: '“',
    rdquo: '”',
    lsquo: '‘',
    rsquo: '’',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    reg: '®',
    trade: '™',
    middot: '·',
    bull: '•',
    euro: '€',
    pound: '£',
    yen: '¥',
    cent: '¢',
    copy: '©',
    deg: '°',
    times: '×',
    divide: '÷',
    sect: '§',
    para: '¶',
    laquo: '«',
    raquo: '»',
    minus: '−',
    ensp: ' ',
    emsp: ' ',
    thinsp: ' ',
    shy: '',
};

/** 폭 없는 문자(zero-width space·joiner, word joiner, BOM)와 소프트 하이픈. 제목·본문에 보이지 않는 잡음을 남긴다. */
const INVISIBLE = /[\u200b-\u200d\u2060\ufeff\u00ad]/g;

function codePointToString(code: number): string {
    const valid =
        Number.isInteger(code) &&
        code > 0 &&
        code <= 0x10ffff &&
        !(code >= 0xd800 && code <= 0xdfff);
    if (!valid) return '';
    // U+00A0(nbsp)는 일반 공백으로 접는다 — 아래 공백 정리가 한 번에 처리한다.
    return code === 0xa0 ? ' ' : String.fromCodePoint(code);
}

function decodeEntities(text: string): string {
    return text.replace(
        /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g,
        (whole, dec?: string, hex?: string, name?: string) => {
            if (dec !== undefined) return codePointToString(Number(dec));
            if (hex !== undefined)
                return codePointToString(Number.parseInt(hex, 16));
            return NAMED_ENTITIES[name ?? ''] ?? whole;
        }
    );
}

/** 표 행 안에서는 단락·줄바꿈이 행을 쪼개지 않도록 공백으로 바꾼다(셀 하나가 `<td><p>…</p></td>`인 표가 흔하다). */
function flattenRow(row: string): string {
    // 행은 `</tr>`로 끝나므로 `[^>]`여도 제곱 시간이 되지는 않는다. 그래도 태그 속성은 이 파일 전체에서
    // `[^<>]` 한 가지 꼴만 쓴다(SERVER.md#SA-23) — 꼴이 섞이면 다음 수정에서 안전한 쪽을 가려 쓰기 어렵다.
    return row.replace(/<\/?(?:p|div|br|li|ul|ol|h[1-6])\b[^<>]*>/gi, ' ');
}

function tidyLine(line: string): string {
    const collapsed = line
        .replace(INVISIBLE, '')
        .replace(/[ \t\r\f\v]+/g, ' ')
        .trim();
    if (!collapsed.includes(CELL)) return collapsed;
    return collapsed
        .split(CELL)
        .map(cell => cell.trim())
        .filter(cell => cell !== '')
        .join(CELL_SEPARATOR);
}

/** 내용째 버리는 블록 하나: 여는 패턴(선형 탐색용), 실제 닫는 태그 패턴, 열고 닫는 전체 패턴. */
interface NoiseBlock {
    open: RegExp;
    close: RegExp;
    block: RegExp;
}

const COMMENT_BLOCK: NoiseBlock = {
    open: /<!--/,
    close: /-->/g,
    block: /<!--[\s\S]*?-->/g,
};

const NOISE_BLOCKS: readonly NoiseBlock[] = [
    'script',
    'style',
    'head',
    'ix:header',
].map(tag => ({
    open: new RegExp(`<${tag}\\b`, 'i'),
    close: new RegExp(`<\\/${tag}\\s*>`, 'gi'),
    block: new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'),
}));

const ROW_CLOSE = /<\/tr\s*>/gi;
const ROW_BLOCK = /<tr\b[\s\S]*?<\/tr\s*>/gi;

/**
 * `text`에서 **실제** 닫는 태그(`close` 패턴 전체)가 마지막으로 끝나는 위치. 없으면 0.
 *
 * 게으른 `여는 태그 … 닫는 태그` 정규식은 마지막 닫는 태그 **뒤**에 여는 태그가 많이 남아 있으면 여는 태그마다
 * 입력 끝까지 훑고 실패해 제곱 시간이 된다(256KB 입력에서 수십 초 — 공시 본문은 제출자가 쓴 신뢰할 수 없는
 * 입력이다). 정규식을 닫는 태그가 있는 구간에만 적용하면 여는 태그마다 가장 가까운 닫는 태그에서 멈춰 선형이다.
 *
 * 닫는 태그는 접두사(`</script`)가 아니라 블록 정규식과 **같은 패턴**(`</script\s*>`)으로 찾는다 — 접두사로
 * 찾으면 `</scriptx>`·`</track>`·`</header>` 같은 다른 태그가 구간 끝으로 잡혀, 그 구간 안에 진짜 닫는 태그가
 * 없는 채로 정규식이 돌아 다시 제곱 시간이 된다.
 */
function closedSpanEnd(text: string, close: RegExp): number {
    const last = [...text.matchAll(close)].at(-1);
    return last === undefined ? 0 : last.index + last[0].length;
}

/** 닫는 태그가 있는 구간에만 `pattern`을 적용하고 나머지는 그대로 둔다({@link closedSpanEnd}). */
function replaceClosedBlocks(
    text: string,
    pattern: RegExp,
    close: RegExp,
    replacement: (match: string) => string
): string {
    const end = closedSpanEnd(text, close);
    return end === 0
        ? text
        : text.slice(0, end).replace(pattern, replacement) + text.slice(end);
}

/**
 * 블록을 내용째 버린다. 마지막 닫는 태그 뒤에 닫히지 않은 여는 태그가 있으면 그 뒤는 전부 블록 내용이므로
 * (브라우저도 그렇게 읽는다 — head 상한에서 잘린 `<script>` 등) 함께 버린다.
 */
function dropBlocks(text: string, noise: NoiseBlock): string {
    const end = closedSpanEnd(text, noise.close);
    const head = text.slice(0, end).replace(noise.block, ' ');
    const tail = text.slice(end);
    const unclosed = tail.search(noise.open);
    return head + (unclosed === -1 ? tail : tail.slice(0, unclosed));
}

/**
 * 공시 HTML을 모델이 읽을 평문으로 바꾼다. 정규식 기반이라 완전한 파서는 아니지만, EDGAR 보도자료·8-K 본문은
 * 단순한 마크업이라 충분하다. 스크립트·스타일·주석·`<head>`·인라인 XBRL 숨김 헤더(`ix:header`, 날짜·ID 같은
 * 기계용 값이 본문처럼 보인다)는 내용째 버리고, 표는 셀을 ` | `로 잇는 한 줄로 편다(구분자뿐인 행은 사라진다).
 */
export function htmlToText(html: string): string {
    const withoutNoise = NOISE_BLOCKS.reduce(
        (text, block) => dropBlocks(text, block),
        dropBlocks(html, COMMENT_BLOCK)
    );
    const marked = replaceClosedBlocks(
        withoutNoise,
        ROW_BLOCK,
        ROW_CLOSE,
        flattenRow
    )
        .replace(/<\/t[dh]\s*>/gi, CELL)
        .replace(/<br\b[^<>]*>/gi, '\n')
        .replace(
            /<\/(?:tr|p|div|li|h[1-6]|table|ul|ol|section|article)\s*>/gi,
            '\n'
        );
    // `[^<>]`: `[^>]`로 두면 닫히지 않은 `<`가 많은 입력에서 `<`마다 끝까지 다시 훑어 제곱 시간이 된다.
    const stripped = decodeEntities(marked.replace(/<[^<>]*>/g, ''));
    return stripped
        .split('\n')
        .flatMap(line => {
            const tidy = tidyLine(line);
            // 구분자뿐인 표 행은 빈 줄(= 문단 구분)이 아니라 아예 없는 줄로 둔다.
            return tidy === '' && line.includes(CELL) ? [] : [tidy];
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
