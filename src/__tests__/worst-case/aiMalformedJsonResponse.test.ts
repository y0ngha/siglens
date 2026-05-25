import {
    parseJsonResponse,
    stripMarkdownCodeBlock,
} from '@/entities/llm-provider/lib/parseJsonResponse';

describe('parseJsonResponse malformed JSON handling', () => {
    it('parses valid JSON directly', () => {
        const result = parseJsonResponse('{"key": "value"}', 'test');
        expect(result).toEqual({ key: 'value' });
    });

    it('strips markdown code fence before parsing', () => {
        const wrapped = '```json\n{"key": "value"}\n```';
        const result = parseJsonResponse(wrapped, 'test');
        expect(result).toEqual({ key: 'value' });
    });

    it('strips code fence without json language tag', () => {
        const wrapped = '```\n{"key": "value"}\n```';
        const result = parseJsonResponse(wrapped, 'test');
        expect(result).toEqual({ key: 'value' });
    });

    it('repairs trailing comma via jsonrepair', () => {
        const broken = '{"key": "value",}';
        const result = parseJsonResponse(broken, 'test');
        expect(result).toEqual({ key: 'value' });
    });

    it('repairs unquoted keys via jsonrepair', () => {
        const broken = '{key: "value"}';
        const result = parseJsonResponse(broken, 'test');
        expect(result).toEqual({ key: 'value' });
    });

    it('throws for completely invalid non-JSON-shaped text', () => {
        expect(() =>
            parseJsonResponse('This is just plain text', 'test')
        ).toThrow('Failed to parse test response as JSON');
    });

    it('throws for truncated JSON that jsonrepair cannot fix', () => {
        expect(() => parseJsonResponse('{{{{{{{{{', 'test')).toThrow(
            'Failed to parse test response as JSON'
        );
    });

    it('preserves cause in thrown error', () => {
        let caught: unknown;
        try {
            parseJsonResponse('not json at all!!!', 'analysis');
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(Error);
        expect((caught as Error).message).toContain(
            'Failed to parse analysis response'
        );
    });

    it('handles empty string input', () => {
        expect(() => parseJsonResponse('', 'test')).toThrow(
            'Failed to parse test response'
        );
    });

    it('parses array JSON', () => {
        const result = parseJsonResponse('[1, 2, 3]', 'test');
        expect(result).toEqual([1, 2, 3]);
    });

    it('handles JSON inside markdown with extra whitespace', () => {
        const input = '  ```json\n  {"a": 1}  \n```  ';
        const result = parseJsonResponse(input, 'test');
        expect(result).toEqual({ a: 1 });
    });
});

describe('stripMarkdownCodeBlock', () => {
    it('returns trimmed text when no code block present', () => {
        expect(stripMarkdownCodeBlock('  hello  ')).toBe('hello');
    });

    it('extracts content from fenced block', () => {
        expect(stripMarkdownCodeBlock('```\ninner\n```')).toBe('inner');
    });

    it('extracts content from json-tagged block', () => {
        expect(stripMarkdownCodeBlock('```json\n{"a":1}\n```')).toBe('{"a":1}');
    });
});
