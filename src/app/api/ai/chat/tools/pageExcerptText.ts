import { htmlToText } from '@/entities/company-filings/lib/htmlToText';

/** 한 발췌의 최대 길이(문자). 상위 2개 결과에 붙으므로 결과 전체 상한(`WEB_SEARCH_RESULT_MAX_CHARS`)의 한 축이다. */
export const EXCERPT_MAX_CHARS = 1_800;
/** 문단으로 칠 최소 길이 — 메뉴 항목·버튼 문구·날짜 줄이 발췌를 채우지 못하게 한다. */
const MIN_PARAGRAPH_CHARS = 30;
/** 점수를 매길 문단 수와 문단당 글자 수 상한(제3자 입력, SERVER.md#SA-23). */
const MAX_PARAGRAPHS = 400;
const MAX_SCORED_CHARS = 2_000;
const MAX_TERMS = 30;
/** 본문(`article`/`main`)으로 인정하는 최소 평문 길이. 이보다 짧으면 페이지 전체로 되돌아간다. */
const MIN_CONTAINER_TEXT_CHARS = 200;
/** 발행 시각을 찾는 앞부분 길이. 메타 태그와 JSON-LD는 문서 앞쪽에 있다. */
const METADATA_SCAN_CHARS = 200_000;

/** 내용째 버리는 태그: 본문이 아닌 틀과 스크립트. */
const DROPPED_TAGS: ReadonlySet<string> = new Set([
    'script',
    'style',
    'noscript',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g;

/**
 * 질의에서 문단 점수에 쓸 낱말을 뽑는다: 두 글자 이상 ASCII 단어, 한글은 연속 구간의 2-gram(형태소 분석 없이
 * 조사가 붙은 어절도 맞추려는 값싼 근사). 소문자, 중복 제거, 최대 {@link MAX_TERMS}개.
 */
export function extractQueryTerms(query: string): string[] {
    const ascii =
        query.toLowerCase().match(/[a-z0-9][a-z0-9.&-]*[a-z0-9]/g) ?? [];
    const bigrams = (query.match(/[가-힣]+/g) ?? []).flatMap(run =>
        run.length < 2
            ? []
            : Array.from({ length: run.length - 1 }, (_, i) =>
                  run.slice(i, i + 2)
              )
    );
    return [...new Set([...ascii, ...bigrams])].slice(0, MAX_TERMS);
}

/**
 * 틀 태그(`DROPPED_TAGS`)를 내용째 걷어낸다. 태그 하나씩 앞으로만 훑는 선형 스캔이다. 닫히지 않은 틀 태그
 * (`<form>`이 닫히지 않은 헐거운 마크업)는 그 뒤를 전부 삼키지 않도록, 열린 자리부터 끝까지를 그대로 되살린다.
 */
function dropChrome(html: string): string {
    const state = { out: [] as string[], last: 0, tag: '', depth: 0, from: 0 };
    for (const m of html.matchAll(TAG_RE)) {
        const name = m[2].toLowerCase();
        const closing = m[1] === '/';
        const selfClosing = m[0].endsWith('/>');
        if (state.tag === '') {
            if (!DROPPED_TAGS.has(name) || closing || selfClosing) continue;
            state.out.push(html.slice(state.last, m.index));
            state.tag = name;
            state.depth = 1;
            state.from = m.index;
        } else if (name === state.tag && !selfClosing) {
            state.depth += closing ? -1 : 1;
            if (state.depth === 0) {
                state.tag = '';
                state.last = m.index + m[0].length;
            }
        }
    }
    state.out.push(html.slice(state.tag === '' ? state.last : state.from));
    return state.out.join('');
}

/** `<tag ...>`부터 마지막 `</tag>`까지의 구간. 없으면 null. 여는 태그와 닫는 태그를 `indexOf`로만 찾는다. */
function containerSpan(
    html: string,
    lower: string,
    tag: string
): string | null {
    const openRe = new RegExp(`<${tag}(?=[\\s>/])`);
    const open = lower.search(openRe);
    if (open === -1) return null;
    const close = lower.lastIndexOf(`</${tag}`);
    return close > open ? html.slice(open, close) : null;
}

function plainTextOf(html: string): string {
    const stripped = dropChrome(html);
    const lower = stripped.toLowerCase();
    const candidates = ['article', 'main'].map(tag =>
        containerSpan(stripped, lower, tag)
    );
    for (const span of candidates) {
        if (span === null) continue;
        const text = htmlToText(span);
        if (text.length >= MIN_CONTAINER_TEXT_CHARS) return text;
    }
    return htmlToText(stripped);
}

/** 문장을 끝내는 표지와, 자를 때 표지까지 포함하려고 더하는 길이. */
const SENTENCE_ENDINGS: ReadonlyArray<readonly [string, number]> = [
    ['. ', 1],
    ['다.', 2],
    ['요.', 2],
    ['! ', 1],
    ['? ', 1],
    ['。', 1],
];

/** `max` 안에서 문장 끝으로 자른다. 문장 끝이 앞쪽 40% 안에만 있으면 단어 경계에서 자르고 말줄임표를 붙인다. */
export function cutAtSentenceEnd(text: string, max: number): string {
    if (text.length <= max) return text;
    const head = text.slice(0, max);
    const cut = Math.max(
        ...SENTENCE_ENDINGS.map(([mark, keep]) => {
            const at = head.lastIndexOf(mark);
            return at === -1 ? -1 : at + keep;
        })
    );
    if (cut >= max * 0.4) return head.slice(0, cut).trim();
    const space = head.lastIndexOf(' ');
    return `${(space > max * 0.4 ? head.slice(0, space) : head).trim()}…`;
}

/**
 * 페이지 HTML에서 질의와 가장 관련 있는 문단들을 문서 순서로 이어 최대 {@link EXCERPT_MAX_CHARS}자로 돌려준다.
 * 질의 낱말이 하나도 맞지 않으면 문서 앞쪽 문단부터 채운다. 읽을 만한 문단이 없으면 빈 문자열.
 */
export function extractPageExcerpt(
    html: string,
    queryTerms: readonly string[]
): string {
    const paragraphs = plainTextOf(html)
        .split(/\n+/)
        .map(p => p.trim())
        .filter(p => p.length >= MIN_PARAGRAPH_CHARS)
        .slice(0, MAX_PARAGRAPHS);
    const scored = paragraphs.map((text, index) => {
        const probe = text.slice(0, MAX_SCORED_CHARS).toLowerCase();
        return {
            text,
            index,
            score: queryTerms.filter(term => probe.includes(term)).length,
        };
    });
    const ranked = [...scored].sort(
        (a, b) => b.score - a.score || a.index - b.index
    );
    const picked = ranked.reduce<{
        chosen: typeof scored;
        used: number;
    }>(
        (acc, p) => {
            const room = EXCERPT_MAX_CHARS - acc.used - 1;
            if (room < MIN_PARAGRAPH_CHARS) return acc;
            const text = cutAtSentenceEnd(p.text, room);
            return {
                chosen: [...acc.chosen, { ...p, text }],
                used: acc.used + text.length + 1,
            };
        },
        { chosen: [], used: 0 }
    );
    return picked.chosen
        .sort((a, b) => a.index - b.index)
        .map(p => p.text)
        .join('\n');
}

const PUBLISHED_META_KEYS: ReadonlySet<string> = new Set([
    'article:published_time',
    'og:article:published_time',
    'datepublished',
    'pubdate',
    'publishdate',
    'date',
    'dc.date.issued',
    'dc.date',
]);

function attr(tag: string, name: string): string | null {
    const m = new RegExp(
        `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
        'i'
    ).exec(tag);
    return m === null ? null : (m[1] ?? m[2] ?? null);
}

function toIso(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const ms = Date.parse(value.trim());
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** 메타 태그(`article:published_time` 등)나 JSON-LD `datePublished`에서 발행 시각(ISO)을 찾는다. 없으면 null. */
export function findPublishedAt(html: string): string | null {
    const head = html.slice(0, METADATA_SCAN_CHARS);
    for (const m of head.matchAll(/<meta\b[^<>]*>/gi)) {
        const key = (
            attr(m[0], 'property') ??
            attr(m[0], 'name') ??
            attr(m[0], 'itemprop') ??
            ''
        ).toLowerCase();
        if (!PUBLISHED_META_KEYS.has(key)) continue;
        const iso = toIso(attr(m[0], 'content'));
        if (iso !== null) return iso;
    }
    return toIso(/"datePublished"\s*:\s*"([^"]{4,40})"/.exec(head)?.[1]);
}
