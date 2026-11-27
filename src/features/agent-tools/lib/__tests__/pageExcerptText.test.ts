import { describe, expect, it } from 'vitest';
import {
    cutAtSentenceEnd,
    EXCERPT_MAX_CHARS,
    extractPageExcerpt,
    extractQueryTerms,
    findPublishedAt,
} from '@/features/agent-tools/lib/pageExcerptText';

const page = (body: string, head = '') =>
    `<!doctype html><html><head><title>t</title>${head}</head><body>${body}</body></html>`;

describe('extractQueryTerms', () => {
    it('takes ASCII words of 2+ chars and Hangul bigrams, lower-cased and de-duplicated', () => {
        const terms = extractQueryTerms('NVDA 금리 인상 nvda a');
        expect(terms).toEqual(expect.arrayContaining(['nvda', '금리', '인상']));
        expect(terms.filter(t => t === 'nvda')).toHaveLength(1);
        expect(terms).not.toContain('a');
    });

    it('splits a longer Hangul run into overlapping bigrams', () => {
        expect(extractQueryTerms('삼성전자')).toEqual(['삼성', '성전', '전자']);
    });

    it('ignores a single Hangul syllable and caps the list', () => {
        expect(extractQueryTerms('가 나')).toEqual([]);
        const many = Array.from({ length: 80 }, (_, i) => `word${i}x`).join(
            ' '
        );
        expect(extractQueryTerms(many)).toHaveLength(30);
    });
});

describe('cutAtSentenceEnd', () => {
    it('returns short text unchanged', () => {
        expect(cutAtSentenceEnd('짧은 문장입니다.', 100)).toBe(
            '짧은 문장입니다.'
        );
    });

    it('cuts at the last sentence end inside the limit', () => {
        const text = `${'가'.repeat(60)}했다. ${'나'.repeat(60)}`;
        expect(cutAtSentenceEnd(text, 80)).toBe(`${'가'.repeat(60)}했다.`);
    });

    it('cuts at a word boundary with an ellipsis when no late sentence end exists', () => {
        const text = `${'word '.repeat(40)}end`;
        const out = cutAtSentenceEnd(text, 50);
        expect(out.endsWith('…')).toBe(true);
        expect(out.length).toBeLessThanOrEqual(51);
    });
});

describe('extractPageExcerpt', () => {
    const para = (text: string) => `<p>${text}</p>`;

    it('prefers the paragraphs that carry the query terms when the page is longer than the limit', () => {
        const filler = (n: number) =>
            para(
                `${n}번 문단은 날씨와 스포츠 이야기를 길게 이어 가는 내용입니다. `.repeat(
                    8
                )
            );
        const html = page(
            Array.from({ length: 10 }, (_, n) => filler(n)).join('') +
                para(
                    '연방준비제도는 이번 회의에서 기준금리를 동결했다고 밝혔다. 시장은 안도했다.'
                ) +
                filler(10)
        );
        const excerpt = extractPageExcerpt(
            html,
            extractQueryTerms('기준금리 동결')
        );
        expect(excerpt).toContain('기준금리를 동결');
        expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
        // The relevant paragraph sits after the first filler paragraphs, in document order.
        expect(excerpt.indexOf('기준금리를 동결')).toBeGreaterThan(0);
    });

    it('fills from the top of the page when no query term matches', () => {
        const html = page(
            para(
                '첫 문단은 질의와 무관하지만 문서 앞쪽이라 먼저 채워집니다 정말로요.'
            ) +
                para(
                    '둘째 문단도 질의와 무관하지만 길이는 충분히 길게 쓰여 있습니다.'
                )
        );
        const excerpt = extractPageExcerpt(html, ['zzzz']);
        expect(excerpt.split('\n')[0]).toContain('첫 문단');
    });

    it('drops nav, header, footer, aside, form, script and style content', () => {
        const html = page(
            '<header><p>HEADER-NOISE this header paragraph is long enough to count as text</p></header>' +
                '<nav><p>NAV-NOISE this navigation paragraph is long enough to count as text</p></nav>' +
                '<script>var x = "SCRIPT-NOISE this script text is long enough to count as text";</script>' +
                '<style>.a{content:"STYLE-NOISE"}</style>' +
                '<aside><p>ASIDE-NOISE this aside paragraph is long enough to count as text</p></aside>' +
                '<form><p>FORM-NOISE this form paragraph is long enough to count as text</p></form>' +
                para(
                    'Nvidia reported quarterly revenue of 57 billion dollars, beating analyst expectations.'
                ) +
                '<footer><p>FOOTER-NOISE this footer paragraph is long enough to count as text</p></footer>'
        );
        const excerpt = extractPageExcerpt(html, ['nvidia']);
        expect(excerpt).toContain('Nvidia reported quarterly revenue');
        expect(excerpt).not.toMatch(/NOISE/);
    });

    it('prefers <article> over the rest of the page when it has enough text', () => {
        const html = page(
            para(
                'Sidebar teaser paragraph that is long enough but belongs outside the article body.'
            ) +
                `<article>${para('The central bank held rates steady on Wednesday and signalled patience on cuts.').repeat(4)}</article>`
        );
        const excerpt = extractPageExcerpt(html, ['rates']);
        expect(excerpt).toContain('central bank held rates');
        expect(excerpt).not.toContain('Sidebar teaser');
    });

    it('falls back to <main>, then to the whole page, when the container is too short', () => {
        const withMain = page(
            para(
                'Outside paragraph about quarterly guidance that is long enough to be counted.'
            ) +
                `<main>${para('Main body paragraph about guidance that is long enough to count here.').repeat(6)}</main>`
        );
        expect(extractPageExcerpt(withMain, ['guidance'])).toContain(
            'Main body'
        );
        const tinyArticle = page(
            '<article><p>too short</p></article>' +
                para(
                    'Whole page paragraph about guidance that is long enough to be counted.'
                )
        );
        expect(extractPageExcerpt(tinyArticle, ['guidance'])).toContain(
            'Whole page'
        );
    });

    it('keeps the page when a chrome tag is never closed instead of swallowing the rest', () => {
        const html = page(
            '<form action="/search"><input name="q">' +
                para(
                    'Body paragraph that follows an unclosed form element and must still be read.'
                )
        );
        expect(extractPageExcerpt(html, ['paragraph'])).toContain(
            'Body paragraph'
        );
    });

    it('handles nested chrome tags of the same name', () => {
        const html = page(
            '<nav><nav><p>INNER-NOISE inner navigation paragraph long enough to count.</p></nav>' +
                '<p>OUTER-NOISE outer navigation paragraph long enough to count too.</p></nav>' +
                para(
                    'Real article paragraph that sits after the nested navigation blocks.'
                )
        );
        const excerpt = extractPageExcerpt(html, ['article']);
        expect(excerpt).toContain('Real article paragraph');
        expect(excerpt).not.toMatch(/NOISE/);
    });

    it('never exceeds the excerpt limit and cuts at a sentence end', () => {
        const sentence = '이 문장은 시장 전망에 대한 긴 설명을 담고 있습니다. ';
        const html = page(
            Array.from({ length: 30 }, () => para(sentence.repeat(6))).join('')
        );
        const excerpt = extractPageExcerpt(
            html,
            extractQueryTerms('시장 전망')
        );
        expect(excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
        expect(excerpt.length).toBeGreaterThan(EXCERPT_MAX_CHARS * 0.5);
        expect(/[.]$/.test(excerpt)).toBe(true);
    });

    it('returns an empty string when the page has no readable paragraph', () => {
        expect(extractPageExcerpt(page('<div>hi</div>'), ['hi'])).toBe('');
        expect(extractPageExcerpt('', [])).toBe('');
    });

    it('stays linear on a cap-sized page of unclosed tags', () => {
        const html = page('<nav>'.repeat(60_000) + '<p>x'.repeat(60_000));
        const started = performance.now();
        extractPageExcerpt(html, ['x']);
        expect(performance.now() - started).toBeLessThan(1_500);
    });
});

describe('findPublishedAt', () => {
    it('reads article:published_time', () => {
        const html = page(
            '',
            '<meta property="article:published_time" content="2026-11-20T09:30:00+09:00">'
        );
        expect(findPublishedAt(html)).toBe('2026-11-20T00:30:00.000Z');
    });

    it('reads itemprop and name variants and single-quoted attributes', () => {
        expect(
            findPublishedAt(
                page('', "<meta itemprop='datePublished' content='2026-11-19'>")
            )
        ).toBe('2026-11-19T00:00:00.000Z');
        expect(
            findPublishedAt(
                page('', '<meta name="pubdate" content="2026-11-18T01:00:00Z">')
            )
        ).toBe('2026-11-18T01:00:00.000Z');
    });

    it('falls back to JSON-LD datePublished', () => {
        const html = page(
            '',
            '<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-11-17T12:00:00Z"}</script>'
        );
        expect(findPublishedAt(html)).toBe('2026-11-17T12:00:00.000Z');
    });

    it('returns null for a missing or unparseable date and ignores unrelated meta tags', () => {
        expect(findPublishedAt(page(''))).toBeNull();
        expect(
            findPublishedAt(
                page(
                    '',
                    '<meta property="article:published_time" content="soon">'
                )
            )
        ).toBeNull();
        expect(
            findPublishedAt(
                page('', '<meta property="og:title" content="2026-11-20">')
            )
        ).toBeNull();
    });
});
