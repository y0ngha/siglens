import { describe, expect, it } from 'vitest';
import {
    stripStoredWebSearchContent,
    stripWebSearchBodies,
    WEB_SEARCH_BODIES_OMITTED_KEY,
    WEB_SEARCH_KEPT_FIELDS,
    type WebSearchResultItem,
} from '@/shared/api/web/webSearchResult';

const full: Required<WebSearchResultItem> = {
    title: 'Title',
    url: 'https://example.com/a',
    snippet: 'snippet body',
    age: '2 days ago',
    excerpt: 'page body',
    excerptStatus: 'robots',
    publishedAt: '2026-11-20T00:00:00.000Z',
};

type Stripped = { results: Array<Record<string, unknown>> } & Record<
    string,
    unknown
>;

describe('stripWebSearchBodies', () => {
    it('keeps only title and url of each result and nothing at the top level but the marker', () => {
        const out = stripWebSearchBodies({
            asOf: '2026-11-22T00:00:00.000Z',
            source: 'Brave Search',
            cached: true,
            results: [full],
        }) as Stripped;
        expect(out).toEqual({
            results: [{ title: 'Title', url: 'https://example.com/a' }],
            [WEB_SEARCH_BODIES_OMITTED_KEY]: true,
        });
    });

    it('drops a field that is not on the kept list, including one added later', () => {
        const out = stripWebSearchBodies({
            results: [{ ...full, futureBody: 'new text field' }],
        }) as Stripped;
        expect(Object.keys(out.results[0]).sort()).toEqual(
            [...WEB_SEARCH_KEPT_FIELDS].sort()
        );
    });

    it('is idempotent and does not mutate its input', () => {
        const input = { results: [full] };
        const once = stripWebSearchBodies(input);
        expect(stripWebSearchBodies(once)).toEqual(once);
        expect(input.results[0].snippet).toBe('snippet body');
    });

    it('removes the preview of a truncation envelope, which holds snippets verbatim', () => {
        const out = stripWebSearchBodies({
            truncated: true,
            preview: '{"results":[{"snippet":"secret"',
        });
        expect(out).toEqual({ [WEB_SEARCH_BODIES_OMITTED_KEY]: true });
        expect(JSON.stringify(out)).not.toContain('secret');
    });

    it('passes error results and non-objects through untouched', () => {
        const error = { error: 'search_failed', status: 503 };
        expect(stripWebSearchBodies(error)).toBe(error);
        expect(stripWebSearchBodies(null)).toBeNull();
        expect(stripWebSearchBodies('text')).toBe('text');
        expect(stripWebSearchBodies({ results: 'nope' })).toEqual({
            results: 'nope',
        });
    });

    it('keeps non-object result entries as they are', () => {
        const out = stripWebSearchBodies({ results: [null, 'x'] }) as Stripped;
        expect(out.results).toEqual([null, 'x']);
    });
});

describe('stripStoredWebSearchContent', () => {
    const stored = JSON.stringify({
        asOf: '2026-11-22T00:00:00.000Z',
        results: [full, { ...full, title: 'Other', url: 'https://b.example' }],
    });

    it('rewrites a stored result to titles and urls only', () => {
        const out = stripStoredWebSearchContent(stored);
        expect(out).not.toBeNull();
        expect(JSON.parse(out as string)).toEqual({
            results: [
                { title: 'Title', url: 'https://example.com/a' },
                { title: 'Other', url: 'https://b.example' },
            ],
            [WEB_SEARCH_BODIES_OMITTED_KEY]: true,
        });
        expect(out).not.toContain('snippet');
        expect(out).not.toContain('page body');
    });

    it('returns null for its own output, so a second pass changes nothing', () => {
        const once = stripStoredWebSearchContent(stored) as string;
        expect(stripStoredWebSearchContent(once)).toBeNull();
    });

    it('carries the marker the SQL predicate looks for as a plain substring', () => {
        expect(stripStoredWebSearchContent(stored)).toContain(
            `"${WEB_SEARCH_BODIES_OMITTED_KEY}":true`
        );
    });

    it('returns null for error results, non-JSON text and non-result objects', () => {
        expect(
            stripStoredWebSearchContent('{"error":"search_failed"}')
        ).toBeNull();
        expect(stripStoredWebSearchContent('not json {')).toBeNull();
        expect(stripStoredWebSearchContent('"plain string"')).toBeNull();
    });

    it('rewrites a truncation envelope without its preview', () => {
        const out = stripStoredWebSearchContent(
            JSON.stringify({ truncated: true, preview: '{"snippet":"x"' })
        );
        expect(JSON.parse(out as string)).toEqual({
            [WEB_SEARCH_BODIES_OMITTED_KEY]: true,
        });
    });
});
